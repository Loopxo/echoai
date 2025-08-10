import * as vscode from 'vscode';

export interface CodeContext {
    currentFunction?: string;
    currentClass?: string;
    imports: string[];
    variables: string[];
    nearbyCode: string;
    documentType: string;
}

export class CodeContextExtractor {
    extractRelevantContext(
        document: vscode.TextDocument,
        position: vscode.Position,
        maxTokens: number = 500
    ): string {
        const context = this.analyzeContext(document, position);
        
        // Build context string prioritizing most relevant information
        let contextParts: string[] = [];
        let totalLength = 0;
        
        // Add imports (highest priority for understanding dependencies)
        if (context.imports.length > 0) {
            const importsStr = context.imports.join('\n');
            if (totalLength + importsStr.length < maxTokens) {
                contextParts.push('// Imports:');
                contextParts.push(importsStr);
                totalLength += importsStr.length + 12;
            }
        }
        
        // Add current class context
        if (context.currentClass && totalLength < maxTokens * 0.7) {
            const classStr = `// Current class: ${context.currentClass}`;
            if (totalLength + classStr.length < maxTokens) {
                contextParts.push(classStr);
                totalLength += classStr.length;
            }
        }
        
        // Add current function context
        if (context.currentFunction && totalLength < maxTokens * 0.8) {
            const funcStr = `// Current function: ${context.currentFunction}`;
            if (totalLength + funcStr.length < maxTokens) {
                contextParts.push(funcStr);
                totalLength += funcStr.length;
            }
        }
        
        // Add nearby variables
        if (context.variables.length > 0 && totalLength < maxTokens * 0.9) {
            const varsStr = `// Variables in scope: ${context.variables.join(', ')}`;
            if (totalLength + varsStr.length < maxTokens) {
                contextParts.push(varsStr);
                totalLength += varsStr.length;
            }
        }
        
        // Add surrounding code (fill remaining space)
        const remainingTokens = maxTokens - totalLength - 50; // Buffer
        if (remainingTokens > 100) {
            const nearbyCode = this.trimToLength(context.nearbyCode, remainingTokens);
            if (nearbyCode.trim()) {
                contextParts.push('// Surrounding code:');
                contextParts.push(nearbyCode);
            }
        }
        
        return contextParts.join('\n');
    }
    
    private analyzeContext(document: vscode.TextDocument, position: vscode.Position): CodeContext {
        const text = document.getText();
        const lines = text.split('\n');
        const currentLine = position.line;
        
        return {
            currentFunction: this.findCurrentFunction(lines, currentLine),
            currentClass: this.findCurrentClass(lines, currentLine),
            imports: this.extractImports(lines, document.languageId),
            variables: this.extractVariables(lines, currentLine, document.languageId),
            nearbyCode: this.extractNearbyCode(lines, currentLine, 10),
            documentType: document.languageId
        };
    }
    
    private findCurrentFunction(lines: string[], currentLine: number): string | undefined {
        // Look backwards for function declaration
        for (let i = currentLine; i >= 0; i--) {
            const line = lines[i];
            
            // JavaScript/TypeScript function patterns
            const jsFunctionMatch = line.match(/^\s*(export\s+)?(async\s+)?function\s+(\w+)|^\s*(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/);
            if (jsFunctionMatch) {
                return jsFunctionMatch[3] || jsFunctionMatch[5];
            }
            
            // Python function pattern
            const pyFunctionMatch = line.match(/^\s*def\s+(\w+)\s*\(/);
            if (pyFunctionMatch) {
                return pyFunctionMatch[1];
            }
            
            // Java/C# method pattern
            const javaMethodMatch = line.match(/^\s*(public|private|protected)?\s*(static)?\s*\w+\s+(\w+)\s*\(/);
            if (javaMethodMatch) {
                return javaMethodMatch[3];
            }
            
            // Arrow function pattern
            const arrowFunctionMatch = line.match(/^\s*(\w+)\s*=\s*\([^)]*\)\s*=>/);
            if (arrowFunctionMatch) {
                return arrowFunctionMatch[1];
            }
        }
        
        return undefined;
    }
    
    private findCurrentClass(lines: string[], currentLine: number): string | undefined {
        // Look backwards for class declaration
        for (let i = currentLine; i >= 0; i--) {
            const line = lines[i];
            
            // JavaScript/TypeScript class pattern
            const jsClassMatch = line.match(/^\s*(export\s+)?class\s+(\w+)/);
            if (jsClassMatch) {
                return jsClassMatch[2];
            }
            
            // Python class pattern
            const pyClassMatch = line.match(/^\s*class\s+(\w+)/);
            if (pyClassMatch) {
                return pyClassMatch[1];
            }
            
            // Java class pattern
            const javaClassMatch = line.match(/^\s*(public|private)?\s*class\s+(\w+)/);
            if (javaClassMatch) {
                return javaClassMatch[2];
            }
        }
        
        return undefined;
    }
    
    private extractImports(lines: string[], languageId: string): string[] {
        const imports: string[] = [];
        
        for (const line of lines) {
            let importMatch;
            
            switch (languageId) {
                case 'typescript':
                case 'javascript':
                    importMatch = line.match(/^\s*(import.*from\s+['"][^'"]+['"]|import\s+['"][^'"]+['"])/);
                    if (importMatch) imports.push(line.trim());
                    
                    const requireMatch = line.match(/^\s*const\s+.*=\s*require\s*\(/);
                    if (requireMatch) imports.push(line.trim());
                    break;
                    
                case 'python':
                    importMatch = line.match(/^\s*(import\s+\w+|from\s+\w+\s+import)/);
                    if (importMatch) imports.push(line.trim());
                    break;
                    
                case 'java':
                    importMatch = line.match(/^\s*import\s+[a-zA-Z_][a-zA-Z0-9_.]*;/);
                    if (importMatch) imports.push(line.trim());
                    break;
                    
                case 'csharp':
                    importMatch = line.match(/^\s*using\s+[a-zA-Z_][a-zA-Z0-9_.]*;/);
                    if (importMatch) imports.push(line.trim());
                    break;
            }
        }
        
        return imports.slice(0, 20); // Limit to most relevant imports
    }
    
    private extractVariables(lines: string[], currentLine: number, languageId: string): string[] {
        const variables: string[] = [];
        const seenVars = new Set<string>();
        
        // Look in a window around the current line
        const startLine = Math.max(0, currentLine - 20);
        const endLine = Math.min(lines.length - 1, currentLine + 5);
        
        for (let i = startLine; i <= endLine; i++) {
            const line = lines[i];
            let varMatches: string[] = [];
            
            switch (languageId) {
                case 'typescript':
                case 'javascript':
                    // Variable declarations
                    const jsVarMatches = line.match(/\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
                    if (jsVarMatches) {
                        varMatches = jsVarMatches.map(m => m.split(/\s+/)[1]);
                    }
                    
                    // Function parameters
                    const paramMatch = line.match(/function\s+\w+\s*\(([^)]*)\)/);
                    if (paramMatch && paramMatch[1]) {
                        const params = paramMatch[1].split(',').map(p => p.trim().split(/\s+/)[0]);
                        varMatches.push(...params);
                    }
                    break;
                    
                case 'python':
                    // Variable assignments
                    const pyVarMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
                    if (pyVarMatch) varMatches.push(pyVarMatch[1]);
                    
                    // Function parameters
                    const pyParamMatch = line.match(/def\s+\w+\s*\(([^)]*)\)/);
                    if (pyParamMatch && pyParamMatch[1]) {
                        const params = pyParamMatch[1].split(',').map(p => p.trim().split(':')[0]);
                        varMatches.push(...params);
                    }
                    break;
                    
                case 'java':
                    // Variable declarations
                    const javaVarMatch = line.match(/\b(?:int|String|boolean|double|float|long|char|byte|short)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
                    if (javaVarMatch) {
                        varMatches = javaVarMatch.map(m => m.split(/\s+/)[1]);
                    }
                    break;
            }
            
            // Add unique variables
            for (const varName of varMatches) {
                if (varName && varName.length > 0 && !seenVars.has(varName)) {
                    seenVars.add(varName);
                    variables.push(varName);
                }
            }
        }
        
        return variables.slice(0, 15); // Limit to most relevant variables
    }
    
    private extractNearbyCode(lines: string[], currentLine: number, windowSize: number): string {
        const startLine = Math.max(0, currentLine - windowSize);
        const endLine = Math.min(lines.length - 1, currentLine + windowSize);
        
        const relevantLines = lines.slice(startLine, endLine + 1);
        
        // Filter out empty lines and comments for more relevant context
        const filteredLines = relevantLines.filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('#');
        });
        
        return filteredLines.join('\n');
    }
    
    private trimToLength(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        
        // Try to break at word boundaries
        const truncated = text.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        
        if (lastSpace > maxLength * 0.8) {
            return text.substring(0, lastSpace) + '...';
        }
        
        return truncated + '...';
    }
    
    extractMethodSignatures(document: vscode.TextDocument): string[] {
        const text = document.getText();
        const signatures: string[] = [];
        
        // Extract all method/function signatures for better completion context
        const lines = text.split('\n');
        
        for (const line of lines) {
            // JavaScript/TypeScript functions
            const jsFunctionMatch = line.match(/^\s*(export\s+)?(async\s+)?function\s+\w+\s*\([^)]*\)/);
            if (jsFunctionMatch) {
                signatures.push(line.trim());
                continue;
            }
            
            // Arrow functions
            const arrowFunctionMatch = line.match(/^\s*const\s+\w+\s*=\s*\([^)]*\)\s*=>/);
            if (arrowFunctionMatch) {
                signatures.push(line.trim());
                continue;
            }
            
            // Python functions
            const pyFunctionMatch = line.match(/^\s*def\s+\w+\s*\([^)]*\)/);
            if (pyFunctionMatch) {
                signatures.push(line.trim());
                continue;
            }
            
            // Java methods
            const javaMethodMatch = line.match(/^\s*(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\([^)]*\)/);
            if (javaMethodMatch) {
                signatures.push(line.trim());
            }
        }
        
        return signatures.slice(0, 10); // Limit for performance
    }
}