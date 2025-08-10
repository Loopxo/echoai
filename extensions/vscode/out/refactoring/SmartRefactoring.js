"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartRefactoring = void 0;
class SmartRefactoring {
    echoProvider;
    refactoringEngine;
    architecturalRefactoring;
    activeSessions = new Map();
    sessionHistory = [];
    // Learning from user preferences
    userPreferences = {
        preferredComplexity: 'medium',
        riskTolerance: 'medium',
        goals: [],
        patterns: []
    };
    constructor(echoProvider, refactoringEngine, architecturalRefactoring) {
        this.echoProvider = echoProvider;
        this.refactoringEngine = refactoringEngine;
        this.architecturalRefactoring = architecturalRefactoring;
    }
    async startSmartRefactoringSession(document, goals) {
        const sessionId = this.generateSessionId();
        // Analyze current code
        const opportunities = await this.refactoringEngine.analyzeRefactoringOpportunities(document);
        const architecturalAnalysis = await this.architecturalRefactoring.analyzeArchitecture();
        // Generate AI insights
        const aiInsights = await this.generateAIInsights(document, opportunities, architecturalAnalysis);
        // Set default goals if none provided
        const defaultGoals = goals || await this.generateDefaultGoals(document, opportunities, architecturalAnalysis);
        const session = {
            id: sessionId,
            startTime: Date.now(),
            operations: opportunities,
            results: [],
            context: document,
            goals: defaultGoals,
            progress: {
                completed: 0,
                total: opportunities.length
            },
            aiInsights
        };
        this.activeSessions.set(sessionId, session);
        return sessionId;
    }
    async getRefactoringWizardSteps(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        const steps = [
            {
                id: 'analysis',
                name: 'Code Analysis',
                description: 'Analyze current code structure and identify opportunities',
                type: 'analysis',
                completed: true,
                data: {
                    opportunities: session.operations.length,
                    insights: session.aiInsights.length,
                    goals: session.goals.length
                },
                nextSteps: ['goal_setting'],
                canSkip: false
            },
            {
                id: 'goal_setting',
                name: 'Set Refactoring Goals',
                description: 'Define what you want to achieve with this refactoring session',
                type: 'goal_setting',
                completed: false,
                data: { goals: session.goals },
                nextSteps: ['operation_selection'],
                canSkip: true
            },
            {
                id: 'operation_selection',
                name: 'Select Operations',
                description: 'Choose which refactoring operations to perform',
                type: 'operation_selection',
                completed: false,
                data: { operations: session.operations.slice(0, 10) }, // Top 10 operations
                nextSteps: ['preview'],
                canSkip: false
            },
            {
                id: 'preview',
                name: 'Preview Changes',
                description: 'Review the proposed changes before execution',
                type: 'preview',
                completed: false,
                nextSteps: ['execution'],
                canSkip: false
            },
            {
                id: 'execution',
                name: 'Execute Refactoring',
                description: 'Apply the selected refactoring operations',
                type: 'execution',
                completed: false,
                nextSteps: ['review'],
                canSkip: false
            },
            {
                id: 'review',
                name: 'Review Results',
                description: 'Evaluate the refactoring results and measure improvements',
                type: 'review',
                completed: false,
                nextSteps: [],
                canSkip: true
            }
        ];
        return steps;
    }
    async executeWizardStep(sessionId, stepId, data) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        switch (stepId) {
            case 'goal_setting':
                return await this.executeGoalSetting(session, data);
            case 'operation_selection':
                return await this.executeOperationSelection(session, data);
            case 'preview':
                return await this.executePreview(session, data);
            case 'execution':
                return await this.executeRefactoring(session, data);
            case 'review':
                return await this.executeReview(session, data);
            default:
                throw new Error(`Unknown step: ${stepId}`);
        }
    }
    async generateRefactoringPreview(operation, context) {
        const beforeCode = context.getText();
        // Use AI to generate preview
        const prompt = `Generate a preview of this ${operation.type} refactoring:

Operation: ${operation.name}
Description: ${operation.description}

Current code:
${beforeCode}

Please provide:
1. The refactored code
2. A brief explanation of changes
3. Estimated impact on complexity
4. Potential risks

Format as JSON:
{
  "afterCode": "refactored code here",
  "explanation": "brief explanation",
  "complexityChange": {"before": 10, "after": 7},
  "risks": ["risk 1", "risk 2"]
}

Only return JSON, no other text.`;
        try {
            const response = await this.echoProvider.getCompletion(prompt, '', context.languageId, 2000);
            const previewData = JSON.parse(response);
            // Calculate impacts
            const beforeComplexity = this.calculateComplexity(beforeCode);
            const afterComplexity = this.calculateComplexity(previewData.afterCode);
            const beforeReadability = this.calculateReadability(beforeCode);
            const afterReadability = this.calculateReadability(previewData.afterCode);
            return {
                operation,
                beforeCode,
                afterCode: previewData.afterCode,
                diffHtml: await this.generateDiffHtml(beforeCode, previewData.afterCode),
                impacts: {
                    filesChanged: 1,
                    linesChanged: this.countChangedLines(beforeCode, previewData.afterCode),
                    complexity: { before: beforeComplexity, after: afterComplexity },
                    readability: { before: beforeReadability, after: afterReadability }
                },
                risks: previewData.risks || [],
                recommendations: await this.generateRecommendations(operation, previewData.afterCode)
            };
        }
        catch (error) {
            console.error('Preview generation failed:', error);
            // Fallback to basic preview
            return {
                operation,
                beforeCode,
                afterCode: beforeCode, // No change as fallback
                diffHtml: '<p>Preview generation failed</p>',
                impacts: {
                    filesChanged: 1,
                    linesChanged: 0,
                    complexity: { before: 0, after: 0 },
                    readability: { before: 0, after: 0 }
                },
                risks: ['Preview generation failed'],
                recommendations: []
            };
        }
    }
    async getAIRefactoringRecommendations(document) {
        const insights = [];
        const prompt = `Analyze this ${document.languageId} code and provide intelligent refactoring recommendations:

Code:
${document.getText()}

Please provide specific, actionable recommendations for:
1. Code smells and how to fix them
2. Performance improvements
3. Readability enhancements
4. Modern syntax opportunities
5. Design pattern applications

Format as JSON array:
[{
  "type": "opportunity",
  "confidence": 85,
  "message": "Extract method opportunity in function X",
  "actionable": true,
  "relatedGoals": ["reduce_complexity"]
}]

Only return JSON, no other text.`;
        try {
            const response = await this.echoProvider.getCompletion(prompt, '', document.languageId, 1500);
            const recommendations = JSON.parse(response);
            recommendations.forEach((rec) => {
                insights.push({
                    type: rec.type || 'suggestion',
                    confidence: rec.confidence || 70,
                    message: rec.message,
                    actionable: rec.actionable || false,
                    relatedGoals: rec.relatedGoals || []
                });
            });
        }
        catch (error) {
            console.error('AI recommendations failed:', error);
            // Fallback recommendations
            insights.push({
                type: 'suggestion',
                confidence: 50,
                message: 'Consider breaking down large functions into smaller, focused methods',
                actionable: true,
                relatedGoals: ['reduce_complexity', 'improve_readability']
            });
        }
        return insights;
    }
    async optimizeRefactoringSequence(operations) {
        // Use AI to optimize the sequence of refactoring operations
        const prompt = `Optimize the sequence of these refactoring operations for best results:

Operations:
${operations.map((op, i) => `${i + 1}. ${op.name} (${op.type}, complexity: ${op.complexity}, risk: ${op.riskLevel})`).join('\n')}

Consider:
1. Dependencies between operations
2. Risk management (low risk first)
3. Impact maximization
4. Logical grouping

Return the optimal sequence as JSON array of operation indices:
[3, 1, 5, 2, 4]

Only return JSON array, no other text.`;
        try {
            const response = await this.echoProvider.getCompletion(prompt, '', 'analysis', 800);
            const sequence = JSON.parse(response);
            // Reorder operations based on AI recommendation
            return sequence.map((index) => operations[index - 1]).filter(Boolean);
        }
        catch (error) {
            console.error('Sequence optimization failed:', error);
            // Fallback to risk-based ordering
            return operations.sort((a, b) => {
                const riskOrder = { low: 1, medium: 2, high: 3 };
                const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
                if (riskDiff !== 0)
                    return riskDiff;
                // Secondary sort by impact (estimated time as proxy)
                return a.estimatedTime - b.estimatedTime;
            });
        }
    }
    async generateAIInsights(document, opportunities, architecturalAnalysis) {
        const insights = [];
        // High-priority opportunities
        const highPriorityOps = opportunities.filter(op => op.riskLevel === 'low' && (op.complexity === 'simple' || op.complexity === 'medium')).slice(0, 3);
        highPriorityOps.forEach(op => {
            insights.push({
                type: 'opportunity',
                confidence: 90,
                message: `Quick win: ${op.description}`,
                actionable: true,
                operation: op,
                relatedGoals: ['improve_readability']
            });
        });
        // Architectural insights
        if (architecturalAnalysis.metrics.coupling > 70) {
            insights.push({
                type: 'warning',
                confidence: 95,
                message: 'High coupling detected. Consider architectural refactoring to improve maintainability.',
                actionable: true,
                relatedGoals: ['apply_patterns']
            });
        }
        // Performance insights
        const performanceOps = opportunities.filter(op => op.type === 'optimize_performance');
        if (performanceOps.length > 0) {
            insights.push({
                type: 'suggestion',
                confidence: 80,
                message: `${performanceOps.length} performance optimization opportunities found.`,
                actionable: true,
                relatedGoals: ['improve_performance']
            });
        }
        return insights;
    }
    async generateDefaultGoals(document, opportunities, architecturalAnalysis) {
        const goals = [];
        // Complexity reduction goal
        if (architecturalAnalysis.metrics.complexity > 10) {
            goals.push({
                type: 'reduce_complexity',
                priority: 'high',
                description: 'Reduce code complexity to improve maintainability',
                measurable: true,
                target: Math.max(5, architecturalAnalysis.metrics.complexity * 0.7),
                currentValue: architecturalAnalysis.metrics.complexity
            });
        }
        // Readability improvement goal
        goals.push({
            type: 'improve_readability',
            priority: 'medium',
            description: 'Improve code readability through better naming and structure',
            measurable: false
        });
        // Modernization goal for JavaScript/TypeScript
        if (document.languageId === 'javascript' || document.languageId === 'typescript') {
            const modernizationOps = opportunities.filter(op => op.type === 'modernize_syntax');
            if (modernizationOps.length > 0) {
                goals.push({
                    type: 'modernize_code',
                    priority: 'low',
                    description: 'Modernize code syntax and patterns',
                    measurable: true,
                    target: modernizationOps.length,
                    currentValue: 0
                });
            }
        }
        return goals;
    }
    async executeGoalSetting(session, data) {
        if (data && data.goals) {
            session.goals = data.goals;
        }
        return {
            id: 'goal_setting',
            name: 'Set Refactoring Goals',
            description: 'Define what you want to achieve with this refactoring session',
            type: 'goal_setting',
            completed: true,
            data: { goals: session.goals },
            nextSteps: ['operation_selection'],
            canSkip: true
        };
    }
    async executeOperationSelection(session, data) {
        if (data && data.selectedOperations) {
            session.operations = data.selectedOperations;
            session.progress.total = session.operations.length;
        }
        return {
            id: 'operation_selection',
            name: 'Select Operations',
            description: 'Choose which refactoring operations to perform',
            type: 'operation_selection',
            completed: true,
            data: { selectedOperations: session.operations },
            nextSteps: ['preview'],
            canSkip: false
        };
    }
    async executePreview(session, data) {
        const previews = await Promise.all(session.operations.slice(0, 5).map(op => this.generateRefactoringPreview(op, session.context)));
        return {
            id: 'preview',
            name: 'Preview Changes',
            description: 'Review the proposed changes before execution',
            type: 'preview',
            completed: true,
            data: { previews },
            nextSteps: ['execution'],
            canSkip: false
        };
    }
    async executeRefactoring(session, data) {
        const context = await this.refactoringEngine.buildRefactoringContext(session.context);
        for (const operation of session.operations) {
            session.progress.currentOperation = operation;
            try {
                const result = await this.refactoringEngine.executeRefactoring(operation, context);
                session.results.push(result);
                session.progress.completed++;
            }
            catch (error) {
                console.error(`Refactoring failed for ${operation.name}:`, error);
            }
        }
        return {
            id: 'execution',
            name: 'Execute Refactoring',
            description: 'Apply the selected refactoring operations',
            type: 'execution',
            completed: true,
            data: { results: session.results },
            nextSteps: ['review'],
            canSkip: false
        };
    }
    async executeReview(session, data) {
        const successCount = session.results.filter(r => r.success).length;
        const improvements = this.measureImprovements(session);
        // Move to history
        this.sessionHistory.push(session);
        this.activeSessions.delete(session.id);
        return {
            id: 'review',
            name: 'Review Results',
            description: 'Evaluate the refactoring results and measure improvements',
            type: 'review',
            completed: true,
            data: {
                successCount,
                totalOperations: session.results.length,
                improvements,
                duration: Date.now() - session.startTime
            },
            nextSteps: [],
            canSkip: true
        };
    }
    measureImprovements(session) {
        const successful = session.results.filter(r => r.success);
        return {
            operationsCompleted: successful.length,
            avgConfidence: successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length,
            totalTime: successful.reduce((sum, r) => sum + r.executionTime, 0),
            filesChanged: new Set(successful.flatMap(r => r.affectedFiles.map(f => f.toString()))).size
        };
    }
    generateSessionId() {
        return `refactor_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    calculateComplexity(code) {
        // Simple complexity calculation
        const lines = code.split('\n').filter(line => line.trim()).length;
        const complexity = (code.match(/if|for|while|switch|catch/g) || []).length;
        return Math.round((complexity / lines) * 100);
    }
    calculateReadability(code) {
        // Simple readability score
        const lines = code.split('\n').filter(line => line.trim()).length;
        const comments = (code.match(/\/\/|\/\*|\*/g) || []).length;
        const avgLineLength = code.length / lines;
        let score = 100;
        if (avgLineLength > 80)
            score -= 20;
        if (comments / lines < 0.1)
            score -= 15;
        return Math.max(0, score);
    }
    countChangedLines(before, after) {
        const beforeLines = before.split('\n');
        const afterLines = after.split('\n');
        let changes = Math.abs(beforeLines.length - afterLines.length);
        const minLength = Math.min(beforeLines.length, afterLines.length);
        for (let i = 0; i < minLength; i++) {
            if (beforeLines[i] !== afterLines[i]) {
                changes++;
            }
        }
        return changes;
    }
    async generateDiffHtml(before, after) {
        // Generate HTML diff - simplified implementation
        return `<div class="diff">
            <div class="before"><pre>${before}</pre></div>
            <div class="after"><pre>${after}</pre></div>
        </div>`;
    }
    async generateRecommendations(operation, code) {
        return [
            'Test the refactored code thoroughly',
            'Review the changes with team members',
            'Update documentation if necessary'
        ];
    }
    // Public methods
    getActiveSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }
    getSessionHistory() {
        return [...this.sessionHistory];
    }
    getUserPreferences() {
        return { ...this.userPreferences };
    }
    updateUserPreferences(preferences) {
        Object.assign(this.userPreferences, preferences);
    }
}
exports.SmartRefactoring = SmartRefactoring;
//# sourceMappingURL=SmartRefactoring.js.map