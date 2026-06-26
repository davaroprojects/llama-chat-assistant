export interface RepositoryChunk {
    id: string;
    relativePath: string;
    fileName: string;
    extension: string;
    folder: string;
    language: string;
    fileType: string;
    className: string;
    methodName: string;
    projectType: string;
    chunkIndex: number;
    chunkCount: number;
    chunkStart: number;
    chunkEnd: number;
    content: string;
    keywordEntities: string;
}
