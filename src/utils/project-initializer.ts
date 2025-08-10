import { executeBatchOperations, createReactAppScaffold, ProjectScaffold } from './batch-editor.js';
import { analyzeRepository } from './repo-analyzer.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export interface ProjectInitializationResult {
  success: boolean;
  projectPath: string;
  scaffold: ProjectScaffold;
  filesCreated: number;
  dependencies: string[];
  nextSteps: string[];
  errors: string[];
}

export async function initializeProject(
  projectType: string,
  projectName: string,
  targetDirectory: string,
  options: {
    installDependencies?: boolean;
    runBuild?: boolean;
    openInEditor?: boolean;
    analyzeAfterCreation?: boolean;
  } = {}
): Promise<ProjectInitializationResult> {
  
  console.log(`🚀 Initializing ${projectType} project: "${projectName}"`);
  console.log(`📍 Target directory: ${targetDirectory}`);
  
  const result: ProjectInitializationResult = {
    success: false,
    projectPath: join(targetDirectory, projectName),
    scaffold: {} as ProjectScaffold,
    filesCreated: 0,
    dependencies: [],
    nextSteps: [],
    errors: []
  };

  try {
    // Create project scaffold based on type
    let scaffold: ProjectScaffold;
    
    switch (projectType.toLowerCase()) {
      case 'react':
      case 'react app':
      case 'react todo':
      case 'todo app':
        scaffold = createReactAppScaffold(projectName, targetDirectory);
        break;
      default:
        throw new Error(`Unsupported project type: ${projectType}`);
    }
    
    result.scaffold = scaffold;

    // Ensure target directory exists
    if (!existsSync(targetDirectory)) {
      mkdirSync(targetDirectory, { recursive: true });
    }

    // Execute batch operations to create all files
    console.log('\n📝 Creating project files...');
    const batchResults = await executeBatchOperations(
      scaffold.files,
      targetDirectory,
      true // Show preview
    );

    result.filesCreated = batchResults.filter(r => r.success).length;
    const failedOps = batchResults.filter(r => !r.success && !r.skipped);
    
    if (failedOps.length > 0) {
      result.errors.push(...failedOps.map(op => op.message));
    }

    // Install dependencies if requested
    if (options.installDependencies && result.filesCreated > 0) {
      await installDependencies(result.projectPath, scaffold, result);
    }

    // Analyze the created project
    if (options.analyzeAfterCreation && result.filesCreated > 0) {
      console.log('\n🔍 Analyzing created project...');
      const analysis = await analyzeRepository(result.projectPath, false);
      console.log(`✅ Project analysis complete: ${analysis.totalFiles} files, ${analysis.projectType}`);
      
      if (analysis.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        analysis.recommendations.forEach(rec => console.log(`   • ${rec}`));
      }
    }

    // Generate next steps
    result.nextSteps = generateNextSteps(scaffold, options);
    
    result.success = result.filesCreated > 0 && result.errors.length === 0;
    
    // Print success summary
    if (result.success) {
      console.log('\n🎉 Project initialization complete!');
      console.log(`📁 Project location: ${result.projectPath}`);
      console.log(`📄 Files created: ${result.filesCreated}`);
      
      if (result.nextSteps.length > 0) {
        console.log('\n🚀 Next steps:');
        result.nextSteps.forEach((step, index) => {
          console.log(`   ${index + 1}. ${step}`);
        });
      }
    } else {
      console.log('\n❌ Project initialization failed');
      result.errors.forEach(error => console.log(`   • ${error}`));
    }

    return result;

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ Project initialization failed:', error);
    return result;
  }
}

async function installDependencies(
  projectPath: string, 
  scaffold: ProjectScaffold, 
  result: ProjectInitializationResult
): Promise<void> {
  console.log('\n📦 Installing dependencies...');
  
  try {
    // Check if npm is available using which/where command
    try {
      await execAsync(process.platform === 'win32' ? 'where npm' : 'which npm');
    } catch {
      result.errors.push('npm is not installed or not in PATH');
      console.log('❌ npm not found. Please install Node.js and npm, then run "npm install" manually.');
      return;
    }
    
    console.log('   • Running npm install...');
    
    // Use spawn for better error handling on different platforms
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const npmProcess = spawn('npm', ['install'], { 
        cwd: projectPath,
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true // Important for Windows compatibility
      });
      
      let stdout = '';
      let stderr = '';
      
      npmProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      npmProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      npmProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Dependencies installed successfully');
          result.dependencies = [
            ...scaffold.dependencies.production,
            ...scaffold.dependencies.development
          ];
          resolve();
        } else {
          const errorMsg = `npm install failed with code ${code}`;
          result.errors.push(errorMsg);
          if (stderr) result.errors.push(`npm stderr: ${stderr.trim()}`);
          console.log('❌ Failed to install dependencies. You can run "npm install" manually.');
          resolve(); // Don't reject, just continue without deps
        }
      });
      
      // Timeout after 2 minutes
      setTimeout(() => {
        npmProcess.kill();
        result.errors.push('npm install timeout (2 minutes)');
        console.log('❌ npm install timed out. You can run "npm install" manually.');
        resolve();
      }, 120000);
    });
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Failed to install dependencies: ${errorMsg}`);
    console.log('❌ Failed to install dependencies. You can run "npm install" manually.');
  }
}

function generateNextSteps(scaffold: ProjectScaffold, options: any): string[] {
  const steps: string[] = [];
  
  // Navigation step
  steps.push(`cd ${scaffold.projectName}`);
  
  // Install dependencies if not done automatically
  if (!options.installDependencies) {
    steps.push('npm install');
  }
  
  // Development server
  steps.push('npm run dev');
  
  // Optional steps
  steps.push('Open http://localhost:5173 in your browser');
  
  if (scaffold.projectType.includes('React')) {
    steps.push('Edit src/App.js to customize your todo app');
    steps.push('Add more components in src/components/');
  }
  
  return steps;
}

// Enhanced AI prompt integration for project creation
export function parseProjectCreationRequest(prompt: string): {
  shouldCreateProject: boolean;
  projectType?: string;
  projectName?: string;
  location?: string;
  features?: string[];
} {
  const lowerPrompt = prompt.toLowerCase();
  
  // Detect project creation intent  
  const creationKeywords = [
    'create react app',
    'create todo app',
    'create a todo',
    'create project',
    'initialize project',
    'setup project',
    'generate app',
    'build app',
    'make app',
    'create app',
    'build a',
    'make a',
    'app called',
    'project called'
  ];
  
  const shouldCreate = creationKeywords.some(keyword => lowerPrompt.includes(keyword));
  
  if (!shouldCreate) {
    return { shouldCreateProject: false };
  }
  
  // Extract project type
  let projectType = 'react'; // default
  if (lowerPrompt.includes('todo')) projectType = 'react todo';
  if (lowerPrompt.includes('react')) projectType = 'react';
  
  // Extract project name
  let projectName = 'todo-app';
  const namePatterns = [
    /(?:called|named)\s+([a-zA-Z0-9-_]+)/,
    /(?:app\s+called|project\s+called|called)\s+([a-zA-Z0-9-_]+)/,
    /"([^"]+)"/,
    /'([^']+)'/
  ];
  
  // Words to exclude from project names (common English words/prepositions)
  const excludeWords = [
    'app', 'react', 'todo', 'for', 'simple', 'a', 'an', 'the', 'with', 'in', 'on', 'at',
    'by', 'from', 'to', 'of', 'and', 'or', 'but', 'so', 'as', 'if', 'when', 'where',
    'how', 'why', 'what', 'which', 'who', 'inside', 'folder', 'directory'
  ];
  
  for (const pattern of namePatterns) {
    const match = prompt.match(pattern);
    if (match && match[1] && !excludeWords.includes(match[1].toLowerCase())) {
      projectName = match[1];
      break;
    }
  }
  
  // If no good name found, create meaningful default based on content
  if (excludeWords.includes(projectName.toLowerCase()) || projectName === 'todo-app') {
    if (lowerPrompt.includes('todo')) {
      projectName = 'my-todo-app';
    } else {
      projectName = 'my-react-app';
    }
  }
  
  // Extract location
  let location = './';
  const locationPatterns = [
    /(?:in|inside)\s+([\w\/.-]+)\s+(?:folder|directory)/,
    /(?:inside|in)\s+([\w\/.-]+)/
  ];
  
  for (const pattern of locationPatterns) {
    const match = prompt.match(pattern);
    if (match && match[1] && !match[1].includes('test')) {
      location = match[1];
      break;
    }
  }
  
  // If specifically mentions test folder
  if (lowerPrompt.includes('test folder') || lowerPrompt.includes('inside test')) {
    location = './test';
  }
  
  return {
    shouldCreateProject: true,
    projectType,
    projectName,
    location,
    features: lowerPrompt.includes('todo') ? ['todo-list', 'add-items', 'delete-items', 'mark-complete'] : []
  };
}