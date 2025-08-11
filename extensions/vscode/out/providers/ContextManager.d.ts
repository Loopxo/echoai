import * as vscode from 'vscode';
export declare class ContextManager {
    private outputChannel;
    private workspaceContext;
    constructor(outputChannel: vscode.OutputChannel);
    private initializeWorkspaceContext;
    private analyzeProjectStructure;
    buildCurrentContext(): any;
    getWorkspaceContext(): any;
    dispose(): void;
}
//# sourceMappingURL=ContextManager.d.ts.map