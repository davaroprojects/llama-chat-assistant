export interface ProjectComponent {
    type?: string;
    triggers: string[];
    calls?: string[];
}

export interface WorkspaceGraph {
    [filePath: string]: ProjectComponent;
}
