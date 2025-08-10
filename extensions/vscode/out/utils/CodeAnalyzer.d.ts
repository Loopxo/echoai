export interface FunctionInfo {
    name: string;
    signature: string;
    startLine: number;
    endLine: number;
    parameters: string[];
    returnType?: string;
    docstring?: string;
}
export interface ClassInfo {
    name: string;
    methods: FunctionInfo[];
    properties: string[];
    startLine: number;
    endLine: number;
}
export declare class CodeAnalyzer {
    extractFunctions(code: string, languageId: string): FunctionInfo[];
    private extractJSFunctions;
    private extractPythonFunctions;
    private extractJavaFunctions;
    private extractGenericFunctions;
    private parseParameters;
    private findFunctionEnd;
    private findPythonFunctionEnd;
    private findJavaMethodEnd;
    private getIndentLevel;
    extractClasses(code: string, languageId: string): ClassInfo[];
    private extractJSClasses;
    private extractPythonClasses;
    private extractJavaClasses;
    private extractProperties;
    analyzeComplexity(code: string): {
        cyclomaticComplexity: number;
        linesOfCode: number;
        cognitiveComplexity: number;
    };
}
//# sourceMappingURL=CodeAnalyzer.d.ts.map