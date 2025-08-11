"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextManager = void 0;
const vscode = __importStar(require("vscode"));
class ContextManager {
    outputChannel;
    workspaceContext = null;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        this.initializeWorkspaceContext();
    }
    async initializeWorkspaceContext() {
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
    async analyzeProjectStructure(rootPath) {
        // Basic project structure analysis
        return {
            type: 'unknown',
            language: [],
            patterns: {},
            directories: {}
        };
    }
    buildCurrentContext() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
        const editor = vscode.window.activeTextEditor;
        const files = [];
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
    getWorkspaceContext() {
        return this.workspaceContext;
    }
    dispose() {
        // Cleanup
    }
}
exports.ContextManager = ContextManager;
//# sourceMappingURL=ContextManager.js.map