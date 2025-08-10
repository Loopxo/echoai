import * as vscode from 'vscode';

export class ContextManager {
    private workspaceContext: any = null;

    constructor(private outputChannel: vscode.OutputChannel) {
        this.initializeWorkspaceContext();
    }

    private async initializeWorkspaceContext(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        this.outputChannel.appendLine(`Initializing workspace context for: ${rootPath}`);

        this.workspaceContext = {
            rootPath,
            files: new Map(),
            projectStructure: await this.analyzeProjectStructure(rootPath),
            recentChanges: []
        };
    }

    private async analyzeProjectStructure(rootPath: string): Promise<any> {
        // Basic project structure analysis
        return {
            type: 'unknown',
            language: [],
            patterns: {},
            directories: {}
        };
    }

    buildCurrentContext(): any {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
        
        const editor = vscode.window.activeTextEditor;
        const files: any[] = [];

        if (editor) {
            const cursor = editor.selection.active;
            const selection = !editor.selection.isEmpty ? {
                start: { line: editor.selection.start.line, character: editor.selection.start.character },
                end: { line: editor.selection.end.line, character: editor.selection.end.character }
            } : undefined;

            files.push({
                uri: editor.document.uri.toString(),
                content: editor.document.getText(),
                language: editor.document.languageId,
                cursor: { line: cursor.line, character: cursor.character },
                selection
            });
        }

        return {
            files,
            activeFile: editor?.document.uri.toString(),
            workspaceRoot,
            gitBranch: undefined,
            recentChanges: []
        };
    }

    getWorkspaceContext(): any {
        return this.workspaceContext;
    }

    dispose(): void {
        // Cleanup
    }
}