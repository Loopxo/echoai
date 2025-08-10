import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileOperation {
    type: 'create' | 'modify' | 'delete' | 'move' | 'copy';
    path: string;
    content?: string;
    originalContent?: string;
    newPath?: string;
}

export interface DiffPreview {
    operation: FileOperation;
    changes: any[];
    summary: {
        additions: number;
        deletions: number;
        modifications: number;
        linesChanged: number;
    };
    preview: string;
    safety: {
        risk: 'low' | 'medium' | 'high';
        warnings: string[];
        canRevert: boolean;
    };
}

export interface BatchOperation {
    id: string;
    operations: FileOperation[];
    preview: DiffPreview[];
    summary: {
        totalFiles: number;
        totalChanges: number;
        estimatedTime: number;
        conflicts: string[];
    };
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

export class AdvancedFileOperations {
    private operationHistory: BatchOperation[] = [];

    constructor(private backupDir: string = '.echo-backups') {
        this.ensureBackupDir();
    }

    private async ensureBackupDir(): Promise<void> {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
        } catch (error) {
            console.warn('Could not create backup directory:', error);
        }
    }

    async createBatchOperation(operations: FileOperation[]): Promise<BatchOperation> {
        const id = this.generateOperationId();
        const preview = await this.generatePreviews(operations);
        
        const batch: BatchOperation = {
            id,
            operations,
            preview,
            summary: {
                totalFiles: operations.length,
                totalChanges: preview.length,
                estimatedTime: this.estimateExecutionTime(operations),
                conflicts: []
            },
            status: 'pending'
        };

        this.operationHistory.unshift(batch);
        return batch;
    }

    private generateOperationId(): string {
        return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    private async generatePreviews(operations: FileOperation[]): Promise<DiffPreview[]> {
        const previews: DiffPreview[] = [];

        for (const operation of operations) {
            try {
                const preview = await this.generateSinglePreview(operation);
                previews.push(preview);
            } catch (error) {
                previews.push({
                    operation,
                    changes: [],
                    summary: { additions: 0, deletions: 0, modifications: 0, linesChanged: 0 },
                    preview: `Error generating preview: ${error}`,
                    safety: {
                        risk: 'high',
                        warnings: [`Failed to generate preview: ${error}`],
                        canRevert: false
                    }
                });
            }
        }

        return previews;
    }

    private async generateSinglePreview(operation: FileOperation): Promise<DiffPreview> {
        return {
            operation,
            changes: [],
            summary: { additions: 0, deletions: 0, modifications: 0, linesChanged: 0 },
            preview: `Preview for ${operation.type} on ${operation.path}`,
            safety: {
                risk: 'low',
                warnings: [],
                canRevert: true
            }
        };
    }

    private estimateExecutionTime(operations: FileOperation[]): number {
        return operations.length * 100; // 100ms per operation estimate
    }

    async executeBatchOperation(batchId: string): Promise<BatchOperation> {
        const batch = this.operationHistory.find(b => b.id === batchId);
        if (!batch) {
            throw new Error(`Batch operation not found: ${batchId}`);
        }

        batch.status = 'running';

        try {
            for (const operation of batch.operations) {
                await this.executeOperation(operation);
            }
            batch.status = 'completed';
        } catch (error) {
            batch.status = 'failed';
            throw error;
        }

        return batch;
    }

    private async executeOperation(operation: FileOperation): Promise<void> {
        switch (operation.type) {
            case 'create':
                if (operation.content) {
                    await fs.writeFile(operation.path, operation.content);
                }
                break;
            case 'modify':
                if (operation.content) {
                    await fs.writeFile(operation.path, operation.content);
                }
                break;
            case 'delete':
                await fs.unlink(operation.path);
                break;
            case 'move':
                if (operation.newPath) {
                    await fs.rename(operation.path, operation.newPath);
                }
                break;
            case 'copy':
                if (operation.newPath) {
                    await fs.copyFile(operation.path, operation.newPath);
                }
                break;
        }
    }

    getBatchOperation(id: string): BatchOperation | undefined {
        return this.operationHistory.find(b => b.id === id);
    }

    listBatchOperations(): BatchOperation[] {
        return [...this.operationHistory];
    }
}