const vscode = acquireVsCodeApi();
const chatDiv = document.getElementById('chat');
const promptArea = document.getElementById('prompt');

const sessionsContainer = document.getElementById('sessions-container');
const sessionsMainTitle = document.getElementById('sessions-main-title');
const activeSessionHeader = document.getElementById('active-session-header');
const activeSessionTitle = document.getElementById('active-session-title');
const backToSessionsBtn = document.getElementById('back-to-sessions-btn');
const sessionsList = document.getElementById('sessions-list');

const attachBtn = document.getElementById('attach-file-btn');
const fileBadge = document.getElementById('attached-file-badge');
const fileNameText = document.getElementById('file-name-text');

const stopBtn = document.getElementById('stop');
const sendBtn = document.getElementById('send');

let currentAttachedFiles = [];

backToSessionsBtn.addEventListener('click', () => {
    chatDiv.innerHTML = '';
    chatDiv.style.display = 'none';
    activeSessionHeader.style.display = 'none';
    activeSessionTitle.innerText = '';

    vscode.postMessage({ type: 'selectSession', sessionId: null });
    vscode.postMessage({ type: 'requestSessionsUpdate' });

    sessionsMainTitle.style.display = 'block';
    sessionsList.style.display = 'flex';
    sessionsContainer.style.display = 'flex';

    // 🌟 NUEVO: Avisar al backend que volvimos al inicio para que re-inyecte el archivo activo por defecto
    vscode.postMessage({ type: 'webviewReady' });
});


// 🛠️ CORRECCIÓN 1: El front-end ahora sabe si hay texto seleccionado en el editor antes de enviar

function sendMessage() {
    const text = promptArea.value.trim();
    if (text || currentAttachedFiles.length > 0) {

        // 1. Despachar PRIMERO la instrucción con los archivos intactos
        vscode.postMessage({
            type: 'askLlama',
            value: text,
            attachedFiles: currentAttachedFiles
        });

        promptArea.value = '';
        promptArea.rows = 2;

        // 2. LIMPIAR DESPUÉS (Se ejecuta un milisegundo después para no romper la petición asíncrona)
        setTimeout(() => {
            currentAttachedFiles = currentAttachedFiles.filter(file => !file.isManual);
            renderAllBadges();
        }, 50);
    }
}


// Escuchas para el botón de agregar y remover archivos
attachBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'openFilePicker' });
});

function renderAllBadges() {
    const filesContainer = document.getElementById('attached-files-container');
    if (!filesContainer) return;

    filesContainer.innerHTML = ''; // Limpiar la caja para evitar duplicar elementos visuales

    currentAttachedFiles.forEach((file, index) => {
        const badge = document.createElement('div');
        badge.className = 'attached-file-badge';

        const textSpan = document.createElement('span');
        textSpan.innerText = `📄 ${file.name}`;
        badge.appendChild(textSpan);

        // 🛠️ VALIDACIÓN ESTRICTA: La equis solo nace si la propiedad isManual es verdadera
        if (file.isManual === true) {
            const removeBtn = document.createElement('div');
            removeBtn.className = 'remove-file-btn';
            removeBtn.innerText = '×';
            removeBtn.title = 'Quitar archivo';

            removeBtn.onclick = () => {
                currentAttachedFiles.splice(index, 1); // Quitar del array
                renderAllBadges(); // Redibujar la cuadrícula flexible hacia arriba
            };
            badge.appendChild(removeBtn);
        }

        filesContainer.appendChild(badge);
    });
}



document.getElementById('send').addEventListener('click', sendMessage);

stopBtn.addEventListener('click', () => {
    // Enviar señal al backend para abortar la petición HTTP activa
    vscode.postMessage({ type: 'stopGeneration' });
});

promptArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

let currentAssistantBubble = null;
let currentAssistantText = "";

window.addEventListener('message', event => {
    const message = event.data;

    // Captura del archivo automático del editor (Viene de clics o selecciones en VS Code)
    if (message.type === 'codeSelectionCaptured') {
        // Conservar intactos todos los archivos manuales agregados con el botón (+)
        currentAttachedFiles = currentAttachedFiles.filter(file => file.isManual === true);

        currentAttachedFiles.unshift({
            name: message.name,
            content: message.content,
            isManual: false
        });

        renderAllBadges();
    }

    // 🛠️ NUEVO: El backend avisa que el usuario cerró todas las pestañas de código
    else if (message.type === 'clearActiveEditorContext') {
        currentAttachedFiles = currentAttachedFiles.filter(file => file.isManual);
        renderAllBadges();
    }

    // ... (Dentro del bloque de escucha de mensajes, añade este caso)
    if (message.type === 'restoreActiveChat') {
        // 1. Alternar pantallas: ocultar lista de sesiones y encender el área de chat
        sessionsContainer.style.display = 'none';
        sessionsList.style.display = 'none';

        activeSessionTitle.innerText = message.title;
        activeSessionHeader.style.display = 'flex';
        chatDiv.style.display = 'flex';

        // 2. Limpiar la pantalla antes de reconstruir para evitar duplicados
        chatDiv.innerHTML = '';

        // 3. Iterar por cada mensaje histórico de la sesión y renderizarlo
        message.messages.forEach(msg => {
            if (msg.role === 'user') {
                let textoAVisualizar = "";
                let archivosAsociados = [];
                let esFormatoNuevo = false;

                // 🛡️ COMPROBACIÓN ATÓMICA DE FORMATO:
                // Si el backend guardó el objeto puro, msg.content vendrá como un Objeto de JS directo
                if (msg.content && typeof msg.content === 'object') {
                    textoAVisualizar = msg.content.text || "";
                    archivosAsociados = msg.content.filesMetadata || [];
                    esFormatoNuevo = true;
                }
                // Si viene como string, validamos si parece un JSON estructurado de texto plano
                else if (typeof msg.content === 'string') {
                    const cleanStr = msg.content.trim();
                    if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
                        try {
                            const parsed = JSON.parse(cleanStr);
                            textoAVisualizar = parsed.text || "";
                            archivosAsociados = parsed.filesMetadata || [];
                            esFormatoNuevo = true;
                        } catch (e) {
                            esFormatoNuevo = false;
                        }
                    }
                }

                // 🌟 RENDERIZADO FORMATO NUEVO (Limpio y Desempacado)
                if (esFormatoNuevo) {
                    if (textoAVisualizar) {
                        const userContainer = document.createElement('div');
                        userContainer.className = 'message-container user';
                        userContainer.innerHTML = `<div class="message"><span>${textoAVisualizar}</span></div>`;
                        chatDiv.appendChild(userContainer);
                    }

                    if (archivosAsociados.length > 0) {
                        archivosAsociados.forEach(fileObj => {
                            const fileName = fileObj.name || 'archivo';
                            const badge = document.createElement('div');
                            badge.className = 'attached-file-badge';
                            badge.style.margin = "4px 0 8px auto"; // Alineado a la derecha con la burbuja
                            badge.innerHTML = `<span>📄 ${fileName}</span>`;
                            chatDiv.appendChild(badge);
                        });
                    }
                }
                // 🔄 RESPALDO FORMATO ANTIGUO (Si es una conversación vieja en texto plano, mantiene tus reglas anteriores)
                else {
                    const rawText = msg.content;

                    if (rawText.includes('[Archivo Adjunto:')) {
                        const match = rawText.match(/\[Archivo Adjunto:\s*(.*?)\]/);
                        const fileName = match ? match[1] : 'archivo';
                        const userQuestion = rawText.split('[Archivo Adjunto:')[0].trim();

                        if (userQuestion) {
                            const userContainer = document.createElement('div');
                            userContainer.className = 'message-container user';
                            userContainer.innerHTML = `<div class="message"><span>${userQuestion}</span></div>`;
                            chatDiv.appendChild(userContainer);
                        }

                        const badge = document.createElement('div');
                        badge.className = 'attached-file-badge';
                        badge.style.margin = "6px 0 12px 0";
                        badge.innerHTML = `<span>📄 ${fileName}</span>`;
                        chatDiv.appendChild(badge);
                    } else {
                        // Texto ordinario antiguo sin adjuntos
                        const container = document.createElement('div');
                        container.className = 'message-container user';
                        container.innerHTML = `<div class="message"><span>${rawText}</span></div>`;
                        chatDiv.appendChild(container);
                    }
                }
            } else if (msg.role === 'assistant') {
                // 🤖 Renderizar mensajes del asistente
                let assistantText = "";
                let assistantTime = "";
                let assistantTokens = "";

                if (msg.content && typeof msg.content === 'string') {
                    const cleanStr = msg.content.trim();
                    if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
                        try {
                            const parsed = JSON.parse(cleanStr);
                            assistantText = parsed.text || "";
                            assistantTime = parsed.time || "";
                            assistantTokens = parsed.tokens || "";
                        } catch (e) {
                            assistantText = msg.content;
                        }
                    } else {
                        assistantText = msg.content;
                    }
                } else if (msg.content && typeof msg.content === 'object') {
                    assistantText = msg.content.text || "";
                    assistantTime = msg.content.time || "";
                    assistantTokens = msg.content.tokens || "";
                }

                if (assistantText) {
                    const assistantContainer = document.createElement('div');
                    assistantContainer.className = 'message-container assistant';
                    const msgBubble = document.createElement('div');
                    msgBubble.className = 'message';
                    msgBubble.innerHTML = `<span>${assistantText}</span>`;
                    assistantContainer.appendChild(msgBubble);
                    chatDiv.appendChild(assistantContainer);

                    // Mostrar tiempo y tokens si existen
                    if (assistantTime || assistantTokens) {
                        const statsContainer = document.createElement('div');
                        statsContainer.style.fontSize = '0.8em';
                        statsContainer.style.color = '#888';
                        statsContainer.style.marginTop = '4px';
                        statsContainer.style.marginBottom = '12px';
                        let statsText = '';
                        if (assistantTime) statsText += `⏱️ ${assistantTime}s`;
                        if (assistantTokens) statsText += ` | 🔢 ${assistantTokens} tokens`;
                        statsContainer.textContent = statsText;
                        chatDiv.appendChild(statsContainer);
                    }
                }
            }

        });

        chatDiv.scrollTop = chatDiv.scrollHeight;
    }

    // ... (El resto de tus condicionales como renderSessionsList, addMessage, etc., continúan abajo de forma normal)


    else if (message.type === 'renderSessionsList') {
        sessionsList.innerHTML = '';

        message.sessions.forEach(session => {
            const card = document.createElement('div');
            card.className = 'session-card';

            card.innerHTML = `
                <div class="session-card-body">
                    <div class="session-card-title">${session.title}</div>
                    <div class="session-card-time">${session.relativeTime}</div>
                </div>
                <div class="delete-session-button" title="Eliminar sesión permanentemente">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>
                    </svg>
                </div>
            `;

            card.onclick = () => {
                sessionsMainTitle.style.display = 'none';
                sessionsList.style.display = 'none';

                activeSessionTitle.innerText = session.title;
                activeSessionHeader.style.display = 'flex';
                chatDiv.style.display = 'flex';

                chatDiv.innerHTML = '';
                vscode.postMessage({ type: 'selectSession', sessionId: session.id });
            };

            const deleteBtn = card.querySelector('.delete-session-button');
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                card.style.opacity = '0';
                card.style.transform = 'translateX(-10px)';
                card.style.transition = 'all 0.2s ease';

                setTimeout(() => {
                    vscode.postMessage({ type: 'deleteSession', sessionId: session.id });
                }, 200);
            };

            sessionsList.appendChild(card);
        });

        if (activeSessionHeader.style.display !== 'flex') {
            sessionsMainTitle.style.display = 'block';
            sessionsList.style.display = 'flex';
            sessionsContainer.style.display = 'flex';
            chatDiv.style.display = 'none';
        }
    }

    else if (message.type === 'fileSelected') {
        // Validar si ya existía un archivo manual con el mismo nombre exacto para evitar duplicaciones reales
        const yaExisteManual = currentAttachedFiles.some(file => file.name === message.name && file.isManual === true);

        if (!yaExisteManual) {
            currentAttachedFiles.push({
                name: message.name,
                content: message.content,
                isManual: true // Forzar la propiedad para que gane la equis
            });
            renderAllBadges();
        }
    }

    else if (message.type === 'addMessage') {
        if (message.role === 'user') {
            if (activeSessionHeader.style.display !== 'flex') {
                sessionsContainer.style.display = 'none';
                chatDiv.style.display = 'flex';

                // 🛠️ Limpieza de título ultra-segura sin romper el script
                let cleanTitle = message.text
                    .replace(/\[Código Seleccionado\][\s\S]*?```[\s\S]*?```/g, '')
                    .replace(/\[Archivo Adjunto:.*?\][\s\S]*?```[\s\S]*?```/g, '')
                    .trim();

                const truncatedTitle = cleanTitle.length > 30 ? cleanTitle.substring(0, 27) + '...' : cleanTitle;
                activeSessionTitle.innerText = truncatedTitle || "Nueva conversación";
                activeSessionHeader.style.display = 'flex';
            }

            const rawText = message.text;

            // 1. Mostrar la pregunta del usuario
            if (rawText) {
                const userContainer = document.createElement('div');
                userContainer.className = 'message-container user';
                userContainer.innerHTML = `<div class="message"><span>${rawText}</span></div>`;
                chatDiv.appendChild(userContainer);
            }

            // 2. Mostrar los archivos adjuntos si existen
            if (message.filesMetadata && Array.isArray(message.filesMetadata) && message.filesMetadata.length > 0) {
                message.filesMetadata.forEach(fileObj => {
                    const fileName = fileObj.name || 'archivo';
                    const fileBadgeInChat = document.createElement('div');
                    fileBadgeInChat.className = 'attached-file-badge';
                    fileBadgeInChat.style.margin = "4px 0 8px auto";
                    fileBadgeInChat.innerHTML = `<span>📄 ${fileName}</span>`;
                    chatDiv.appendChild(fileBadgeInChat);
                });
            }

            chatDiv.scrollTop = chatDiv.scrollHeight;
        }
    }

    // ... (Mantén tus eventos de startStreaming, appendToken, endStreaming, errorStreaming idénticos abajo)

    else if (message.type === 'startStreaming') {
        promptArea.disabled = true;
        sendBtn.style.display = 'none';
        stopBtn.style.display = 'flex';

        currentAssistantText = "";
        const container = document.createElement('div');
        container.className = 'message-container assistant';
        const msgBubble = document.createElement('div');
        msgBubble.className = 'message';

        // 🛠️ PUNTUAL: Creamos el contenedor de texto vacío
        currentAssistantBubble = document.createElement('div');
        currentAssistantBubble.style.whiteSpace = "pre-wrap";

        // 🌟 NUEVO: Inyectar la estructura de animación de tres puntos
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';

        msgBubble.appendChild(currentAssistantBubble);
        msgBubble.appendChild(typingIndicator); // Añadir los puntos
        container.appendChild(msgBubble);
        chatDiv.appendChild(container);
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }

    else if (message.type === 'appendToken') {
        if (currentAssistantBubble) {
            let tokenText = message.text;

            if (tokenText.startsWith('{') && tokenText.includes('"text"')) {
                try {
                    const parsed = JSON.parse(tokenText);
                    tokenText = parsed.text;
                } catch (e) { }
            }

            // 🌟 NUEVO: Remover la animación de puntos del mensaje activo al recibir el primer token
            const bubbleNode = currentAssistantBubble.closest('.message');
            const indicator = bubbleNode.querySelector('.typing-indicator');
            if (indicator) {
                indicator.remove();
            }

            currentAssistantText += tokenText;
            currentAssistantBubble.innerText = currentAssistantText;
            chatDiv.scrollTop = chatDiv.scrollHeight;
        }
    }



    else if (message.type === 'endStreaming') {
        // 🛠️ Control de interfaz: Desbloquear texto y restaurar botón Enviar
        promptArea.disabled = false;
        stopBtn.style.display = 'none';
        sendBtn.style.display = 'flex';
        promptArea.focus();

        if (currentAssistantBubble) {
            const bubbleNode = currentAssistantBubble.closest('.message');

            // 🛠️ MODIFICADO: Cambiado a let para permitir el desempaquetado de seguridad
            let finalContent = currentAssistantText.trim();

            // 🛠️ DESEMPAQUETADO DE SEGURIDAD: Previene que el JSON plano toque la pantalla
            if (finalContent.startsWith('{') && finalContent.includes('"text"')) {
                try {
                    const parsedData = JSON.parse(finalContent);
                    finalContent = parsedData.text.trim();
                } catch (e) {
                    // Mantener el texto original si no es un JSON procesable
                }
            }

            bubbleNode.innerHTML = '';

            if (finalContent) {
                const parts = finalContent.split(/(```[\s\S]*?```)/g);
                let ultimoCodigoDetectado = "";
                let tieneCodigo = false;
                let contenidoPintado = false;

                parts.forEach(part => {
                    if (part.startsWith('```') && part.endsWith('```')) {
                        tieneCodigo = true;
                        contenidoPintado = true;
                        let codigoLimpio = part.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
                        ultimoCodigoDetectado = codigoLimpio;

                        const pre = document.createElement('pre');
                        const code = document.createElement('code');
                        code.innerText = codigoLimpio;
                        pre.appendChild(code);
                        bubbleNode.appendChild(pre);
                    } else {
                        const textoNormal = part.trim();
                        if (textoNormal) {
                            contenidoPintado = true;
                            const p = document.createElement('div');
                            p.style.margin = "10px 0";
                            p.style.lineHeight = "1.5";
                            p.innerText = textoNormal;
                            bubbleNode.appendChild(p);
                        }
                    }
                });

                if (!contenidoPintado) {
                    const fallbackDiv = document.createElement('div');
                    fallbackDiv.style.whiteSpace = "pre-wrap";
                    fallbackDiv.innerText = finalContent;
                    bubbleNode.appendChild(fallbackDiv);
                }

                const codigoACopiar = tieneCodigo ? ultimoCodigoDetectado : finalContent;

                const footerRow = document.createElement('div');
                footerRow.className = 'chat-footer-row';

                const copyIconBtn = document.createElement('div');
                copyIconBtn.className = 'copy-icon-button';
                copyIconBtn.title = 'Copiar al portapapeles';

                copyIconBtn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://w3.org">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                `;

                copyIconBtn.onclick = () => {
                    navigator.clipboard.writeText(codigoACopiar).then(() => {
                        copyIconBtn.innerHTML = `
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://w3.org">
                                <path d="M20 6 9 17l-5-5"/>
                            </svg>
                        `;
                        copyIconBtn.classList.add('copied');

                        setTimeout(() => {
                            copyIconBtn.innerHTML = `
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://w3.org">
                                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                                </svg>
                            `;
                            copyIconBtn.classList.remove('copied');
                        }, 2000);
                    }).catch(err => {
                        console.error('Error al copiar: ', err);
                    });
                };
                const statsDiv = document.createElement('div');
                statsDiv.className = 'chat-stats';
                statsDiv.innerText = `${message.time}s  •  ${message.tokens} tokens`;
                footerRow.appendChild(copyIconBtn);
                footerRow.appendChild(statsDiv);
                bubbleNode.appendChild(footerRow);
            } else { bubbleNode.innerText = "⚠️ No se recibieron datos de texto del modelo local."; }
        }
        currentAssistantBubble = null;

        // 🌟 AUTOMATISMO: Solicitar al backend validar el editor activo justo al terminar la respuesta de la IA
        vscode.postMessage({ type: 'requestActiveEditorRefresh' });
    }

    else if (message.type === 'errorStreaming') {
        // 🛠️ Control de interfaz: Desbloquear texto y restaurar botón Enviar tras fallos
        promptArea.disabled = false;
        stopBtn.style.display = 'none';
        sendBtn.style.display = 'flex';
        promptArea.focus();

        const container = document.createElement('div');
        container.className = 'message-container assistant';
        container.innerHTML = `<div class="message" style="color:var(--vscode-errorForeground)">${message.text}</div>`;
        chatDiv.appendChild(container);

        // 🌟 AUTOMATISMO: Solicitar al backend validar el editor activo también si ocurre un error
        vscode.postMessage({ type: 'requestActiveEditorRefresh' });
    }

});

// Notificar al backend que el archivo JavaScript está cargado y listo para recibir datos
vscode.postMessage({ type: 'webviewReady' });
