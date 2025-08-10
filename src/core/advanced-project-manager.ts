import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    category: 'web' | 'mobile' | 'desktop' | 'library' | 'api' | 'fullstack';
    framework?: string;
    language: string[];
    dependencies: {
        runtime: Record<string, string>;
        development: Record<string, string>;
    };
}

export interface ProjectCreationOptions {
    name: string;
    directory: string;
    template: string;
    variables?: Record<string, any>;
}

export class AdvancedProjectManager {
    private templates = new Map<string, ProjectTemplate>();

    constructor() {
        this.initializeDefaultTemplates();
    }

    private initializeDefaultTemplates(): void {
        // React TypeScript Template
        this.templates.set('react-ts', {
            id: 'react-ts',
            name: 'React TypeScript App',
            description: 'Modern React application with TypeScript and Vite',
            category: 'web',
            framework: 'React',
            language: ['typescript'],
            dependencies: {
                runtime: {
                    'react': '^18.2.0',
                    'react-dom': '^18.2.0'
                },
                development: {
                    '@types/react': '^18.2.0',
                    '@types/react-dom': '^18.2.0',
                    '@vitejs/plugin-react': '^4.0.0',
                    'typescript': '^5.0.2',
                    'vite': '^4.4.5'
                }
            }
        });

        // Node.js API Template
        this.templates.set('node-api', {
            id: 'node-api',
            name: 'Node.js REST API',
            description: 'Express.js REST API with TypeScript',
            category: 'api',
            framework: 'Express',
            language: ['typescript'],
            dependencies: {
                runtime: {
                    'express': '^4.18.0',
                    'cors': '^2.8.5'
                },
                development: {
                    '@types/express': '^4.17.0',
                    '@types/cors': '^2.8.0',
                    'typescript': '^5.0.0',
                    'ts-node': '^10.9.0'
                }
            }
        });
    }

    async createProject(options: ProjectCreationOptions): Promise<string> {
        const template = this.templates.get(options.template);
        if (!template) {
            throw new Error(`Template not found: ${options.template}`);
        }

        const projectPath = path.join(options.directory, options.name);
        
        // Create project directory
        await fs.mkdir(projectPath, { recursive: true });

        // Create basic project structure
        await this.createProjectStructure(projectPath, template);
        
        // Create package.json
        await this.createPackageJson(projectPath, template, options.name);

        return projectPath;
    }

    private async createProjectStructure(projectPath: string, template: ProjectTemplate): Promise<void> {
        const directories = ['src', 'docs'];
        
        if (template.category === 'web') {
            directories.push('public');
        }

        for (const dir of directories) {
            await fs.mkdir(path.join(projectPath, dir), { recursive: true });
        }
    }

    private async createPackageJson(projectPath: string, template: ProjectTemplate, projectName: string): Promise<void> {
        const packageJson = {
            name: projectName,
            version: '1.0.0',
            description: template.description,
            main: 'src/index.js',
            scripts: this.getPackageScripts(template),
            dependencies: template.dependencies.runtime,
            devDependencies: template.dependencies.development,
            license: 'MIT'
        };

        await fs.writeFile(
            path.join(projectPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
    }

    private getPackageScripts(template: ProjectTemplate): Record<string, string> {
        const scripts: Record<string, string> = {};

        if (template.framework === 'React') {
            scripts.dev = 'vite';
            scripts.build = 'vite build';
            scripts.preview = 'vite preview';
        } else if (template.framework === 'Express') {
            scripts.start = 'node dist/index.js';
            scripts.dev = 'ts-node src/index.ts';
            scripts.build = 'tsc';
        }

        return scripts;
    }

    getAvailableTemplates(): ProjectTemplate[] {
        return Array.from(this.templates.values());
    }

    getTemplate(id: string): ProjectTemplate | undefined {
        return this.templates.get(id);
    }
}