import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export async function detectProjectType(workspaceRoot: string): Promise<string> {
    const exists = async (absolutePath: string): Promise<boolean> => {
        try {
            await fs.access(absolutePath);
            return true;
        } catch {
            return false;
        }
    };

    if (await exists(path.join(workspaceRoot, 'pom.xml')) || await exists(path.join(workspaceRoot, 'build.gradle'))) {
        return 'java';
    }

    if (await exists(path.join(workspaceRoot, 'package.json'))) {
        return 'node';
    }

    if (await exists(path.join(workspaceRoot, 'pyproject.toml')) || await exists(path.join(workspaceRoot, 'requirements.txt'))) {
        return 'python';
    }

    if (await exists(path.join(workspaceRoot, 'Cargo.toml'))) {
        return 'rust';
    }

    if (await exists(path.join(workspaceRoot, 'go.mod'))) {
        return 'go';
    }

    return 'generic';
}

export function getEcosystemLanguage(language: string, projectType: string): string {
    if (projectType === 'java') {
        if (language === 'xml' || language === 'properties' || language === 'json' || language === 'yaml') {
            return 'java-ecosystem';
        }
        return language === 'java' ? 'java' : 'java-ecosystem';
    }

    if (projectType === 'node') {
        if (language === 'yaml' || language === 'json' || language === 'properties') {
            return 'node-ecosystem';
        }
        return language === 'javascript' || language === 'typescript' ? language : 'node-ecosystem';
    }

    if (projectType === 'python') {
        if (language === 'yaml' || language === 'properties' || language === 'text') {
            return 'python-ecosystem';
        }
        return language === 'python' ? 'python' : 'python-ecosystem';
    }

    return language;
}
