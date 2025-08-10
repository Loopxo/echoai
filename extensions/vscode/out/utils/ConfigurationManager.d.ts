import * as vscode from 'vscode';
export declare class ConfigurationManager {
    private readonly SECTION;
    get<T>(key: string, defaultValue: T): T;
    set<T>(key: string, value: T, target?: vscode.ConfigurationTarget): Promise<void>;
    resetToDefaults(): Promise<void>;
    onDidChange(listener: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable;
    getProviderConfig(): {
        provider: string;
        model: string;
        maxTokens: number;
        temperature: number;
    };
    getPerformanceConfig(): {
        completionDelay: number;
        maxContextSize: number;
        enableCaching: boolean;
        cacheDuration: number;
    };
    getFeatureFlags(): {
        enableInlineCompletion: boolean;
        enableErrorDetection: boolean;
        enableCodeActions: boolean;
        enableStatusBar: boolean;
    };
    validateConfiguration(): string[];
    migrateConfiguration(): Promise<void>;
}
//# sourceMappingURL=ConfigurationManager.d.ts.map