"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeAnalyzer = void 0;
class CodeAnalyzer {
    extractFunctions(code, languageId) {
        const functions = [];
        const lines = code.split('\n');
        switch (languageId) {
            case 'typescript':
            case 'javascript':
                return this.extractJSFunctions(lines);
            case 'python':
                return this.extractPythonFunctions(lines);
            case 'java':
                return this.extractJavaFunctions(lines);
            default:
                return this.extractGenericFunctions(lines);
        }
    }
    extractJSFunctions(lines) {
        const functions = [];
        const functionPatterns = [
            /^\s*(export\s+)?(async\s+)?function\s+(\w+)\s*\((.*?)\)(\s*:\s*\w+)?/,
            /^\s*(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\((.*?)\)\s*=>/,
            /^\s*(\w+)\s*:\s*(async\s+)?\((.*?)\)\s*=>/,
            /^\s*(\w+)\s*\((.*?)\)\s*\{/
        ];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pattern of functionPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const functionName = match[3] || match[2] || match[1];
                    const params = this.parseParameters(match[4] || match[3] || match[2] || '');
                    functions.push({
                        name: functionName,
                        signature: line.trim(),
                        startLine: i + 1,
                        endLine: this.findFunctionEnd(lines, i),
                        parameters: params,
                        returnType: match[5]?.replace(':', '').trim()
                    });
                    break;
                }
            }
        }
        return functions;
    }
    extractPythonFunctions(lines) {
        const functions = [];
        const functionPattern = /^\s*def\s+(\w+)\s*\((.*?)\)(\s*->\s*\w+)?:/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(functionPattern);
            if (match) {
                const functionName = match[1];
                const params = this.parseParameters(match[2]);
                const returnType = match[3]?.replace('->', '').trim();
                // Look for docstring
                let docstring = '';
                if (i + 1 < lines.length && lines[i + 1].trim().startsWith('"""')) {
                    let docEnd = i + 1;
                    while (docEnd < lines.length && !lines[docEnd].includes('"""', 3)) {
                        docEnd++;
                    }
                    docstring = lines.slice(i + 1, docEnd + 1).join('\n');
                }
                functions.push({
                    name: functionName,
                    signature: line.trim(),
                    startLine: i + 1,
                    endLine: this.findPythonFunctionEnd(lines, i),
                    parameters: params,
                    returnType,
                    docstring
                });
            }
        }
        return functions;
    }
    extractJavaFunctions(lines) {
        const functions = [];
        const methodPattern = /^\s*(public|private|protected)?\s*(static)?\s*(\w+)\s+(\w+)\s*\((.*?)\)/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(methodPattern);
            if (match) {
                const returnType = match[3];
                const methodName = match[4];
                const params = this.parseParameters(match[5]);
                functions.push({
                    name: methodName,
                    signature: line.trim(),
                    startLine: i + 1,
                    endLine: this.findJavaMethodEnd(lines, i),
                    parameters: params,
                    returnType
                });
            }
        }
        return functions;
    }
    extractGenericFunctions(lines) {
        const functions = [];
        const genericPattern = /^\s*(\w+)\s*\([^)]*\)\s*[{]/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(genericPattern);
            if (match) {
                functions.push({
                    name: match[1],
                    signature: line.trim(),
                    startLine: i + 1,
                    endLine: this.findFunctionEnd(lines, i),
                    parameters: []
                });
            }
        }
        return functions;
    }
    parseParameters(paramString) {
        if (!paramString.trim())
            return [];
        const params = paramString.split(',').map(p => p.trim());
        return params.filter(p => p.length > 0);
    }
    findFunctionEnd(lines, startLine) {
        let braceCount = 0;
        let foundOpenBrace = false;
        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            for (const char of line) {
                if (char === '{') {
                    braceCount++;
                    foundOpenBrace = true;
                }
                else if (char === '}') {
                    braceCount--;
                    if (foundOpenBrace && braceCount === 0) {
                        return i + 1;
                    }
                }
            }
        }
        return startLine + 10; // Default fallback
    }
    findPythonFunctionEnd(lines, startLine) {
        const functionIndent = this.getIndentLevel(lines[startLine]);
        for (let i = startLine + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '')
                continue;
            const currentIndent = this.getIndentLevel(line);
            if (currentIndent <= functionIndent) {
                return i;
            }
        }
        return lines.length;
    }
    findJavaMethodEnd(lines, startLine) {
        return this.findFunctionEnd(lines, startLine);
    }
    getIndentLevel(line) {
        let indent = 0;
        for (const char of line) {
            if (char === ' ')
                indent++;
            else if (char === '\t')
                indent += 4;
            else
                break;
        }
        return indent;
    }
    extractClasses(code, languageId) {
        const classes = [];
        const lines = code.split('\n');
        switch (languageId) {
            case 'typescript':
            case 'javascript':
                return this.extractJSClasses(lines);
            case 'python':
                return this.extractPythonClasses(lines);
            case 'java':
                return this.extractJavaClasses(lines);
            default:
                return [];
        }
    }
    extractJSClasses(lines) {
        const classes = [];
        const classPattern = /^\s*(export\s+)?class\s+(\w+)/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(classPattern);
            if (match) {
                const className = match[2];
                const endLine = this.findFunctionEnd(lines, i);
                const classCode = lines.slice(i, endLine).join('\n');
                const methods = this.extractFunctions(classCode, 'javascript');
                const properties = this.extractProperties(classCode);
                classes.push({
                    name: className,
                    methods,
                    properties,
                    startLine: i + 1,
                    endLine
                });
            }
        }
        return classes;
    }
    extractPythonClasses(lines) {
        const classes = [];
        const classPattern = /^\s*class\s+(\w+)/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(classPattern);
            if (match) {
                const className = match[1];
                const endLine = this.findPythonFunctionEnd(lines, i);
                const classCode = lines.slice(i, endLine).join('\n');
                const methods = this.extractFunctions(classCode, 'python');
                const properties = this.extractProperties(classCode);
                classes.push({
                    name: className,
                    methods,
                    properties,
                    startLine: i + 1,
                    endLine
                });
            }
        }
        return classes;
    }
    extractJavaClasses(lines) {
        const classes = [];
        const classPattern = /^\s*(public|private)?\s*class\s+(\w+)/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(classPattern);
            if (match) {
                const className = match[2];
                const endLine = this.findFunctionEnd(lines, i);
                const classCode = lines.slice(i, endLine).join('\n');
                const methods = this.extractFunctions(classCode, 'java');
                const properties = this.extractProperties(classCode);
                classes.push({
                    name: className,
                    methods,
                    properties,
                    startLine: i + 1,
                    endLine
                });
            }
        }
        return classes;
    }
    extractProperties(code) {
        const properties = [];
        const lines = code.split('\n');
        // Simple property extraction (can be enhanced)
        for (const line of lines) {
            const propMatch = line.match(/^\s*(private|public|protected)?\s*(\w+):/);
            if (propMatch) {
                properties.push(propMatch[2]);
            }
        }
        return properties;
    }
    analyzeComplexity(code) {
        const lines = code.split('\n').filter(line => line.trim() !== '');
        const linesOfCode = lines.length;
        // Simple complexity analysis
        let cyclomaticComplexity = 1; // Base complexity
        let cognitiveComplexity = 0;
        const complexityPatterns = [
            /\b(if|else if|while|for|switch|case|catch)\b/g,
            /\?.*:/g, // Ternary operator
            /&&|\|\|/g // Logical operators
        ];
        for (const line of lines) {
            for (const pattern of complexityPatterns) {
                const matches = line.match(pattern);
                if (matches) {
                    cyclomaticComplexity += matches.length;
                    cognitiveComplexity += matches.length;
                }
            }
        }
        return {
            cyclomaticComplexity,
            linesOfCode,
            cognitiveComplexity
        };
    }
}
exports.CodeAnalyzer = CodeAnalyzer;
//# sourceMappingURL=CodeAnalyzer.js.map