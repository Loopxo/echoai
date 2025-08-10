import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

export interface ProjectContext {
  workingDirectory: string;
  projectName: string;
  projectType: string;
  framework?: string;
  language?: string;
  filesCount: number;
  gitRepo?: boolean;
}

export function getProjectContext(): ProjectContext {
  const cwd = process.cwd();
  const projectName = basename(cwd);
  
  // Detect project type and language
  const { projectType, framework, language } = detectProjectType(cwd);
  
  // Count files in project
  const filesCount = countProjectFiles(cwd);
  
  // Check if it's a git repository
  const gitRepo = existsSync(join(cwd, '.git'));

  return {
    workingDirectory: cwd,
    projectName,
    projectType,
    framework,
    language,
    filesCount,
    gitRepo
  };
}

function detectProjectType(directory: string): { projectType: string; framework?: string; language?: string } {
  // Check for package.json (Node.js/JavaScript/TypeScript)
  if (existsSync(join(directory, 'package.json'))) {
    const packageJson = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf-8'));
    
    // Detect framework
    let framework: string | undefined;
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.react || deps['@types/react']) framework = 'React';
    else if (deps.vue || deps['@vue/cli']) framework = 'Vue.js';
    else if (deps.angular || deps['@angular/core']) framework = 'Angular';
    else if (deps.next || deps['next']) framework = 'Next.js';
    else if (deps.express) framework = 'Express.js';
    else if (deps.svelte) framework = 'Svelte';
    
    const hasTypeScript = deps.typescript || existsSync(join(directory, 'tsconfig.json'));
    
    return {
      projectType: 'Node.js Project',
      framework,
      language: hasTypeScript ? 'TypeScript' : 'JavaScript'
    };
  }

  // Check for Python projects
  if (existsSync(join(directory, 'requirements.txt')) || 
      existsSync(join(directory, 'pyproject.toml')) ||
      existsSync(join(directory, 'setup.py')) ||
      existsSync(join(directory, 'Pipfile'))) {
    return {
      projectType: 'Python Project',
      language: 'Python'
    };
  }

  // Check for Rust projects
  if (existsSync(join(directory, 'Cargo.toml'))) {
    return {
      projectType: 'Rust Project',
      language: 'Rust'
    };
  }

  // Check for Go projects
  if (existsSync(join(directory, 'go.mod'))) {
    return {
      projectType: 'Go Project', 
      language: 'Go'
    };
  }

  // Check for Java projects
  if (existsSync(join(directory, 'pom.xml')) || existsSync(join(directory, 'build.gradle'))) {
    return {
      projectType: existsSync(join(directory, 'pom.xml')) ? 'Maven Project' : 'Gradle Project',
      language: 'Java'
    };
  }

  // Check for C/C++ projects
  if (existsSync(join(directory, 'CMakeLists.txt')) || existsSync(join(directory, 'Makefile'))) {
    return {
      projectType: 'C/C++ Project',
      language: 'C/C++'
    };
  }

  // Generic detection based on file extensions
  const files = readdirSync(directory);
  const extensions = files.map(f => f.split('.').pop()).filter(Boolean);
  
  if (extensions.includes('py')) {
    return { projectType: 'Python Project', language: 'Python' };
  } else if (extensions.includes('js') || extensions.includes('ts')) {
    return { projectType: 'JavaScript/TypeScript Project', language: 'JavaScript/TypeScript' };
  } else if (extensions.includes('rs')) {
    return { projectType: 'Rust Project', language: 'Rust' };
  } else if (extensions.includes('go')) {
    return { projectType: 'Go Project', language: 'Go' };
  } else if (extensions.includes('java')) {
    return { projectType: 'Java Project', language: 'Java' };
  } else if (extensions.includes('c') || extensions.includes('cpp') || extensions.includes('cc')) {
    return { projectType: 'C/C++ Project', language: 'C/C++' };
  }

  return { projectType: 'General Project' };
}

function countProjectFiles(directory: string): number {
  let count = 0;
  const excludeDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', 'target'];
  
  function countRecursive(dir: string): void {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        if (excludeDirs.includes(item)) continue;
        
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          countRecursive(fullPath);
        } else {
          count++;
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
  }
  
  countRecursive(directory);
  return count;
}

export async function findRelevantFiles(query: string, directory: string): Promise<string[]> {
  const relevantFiles: string[] = [];
  const searchTerms = query.toLowerCase().split(/\s+/);
  
  function searchRecursive(dir: string, maxDepth: number = 3): void {
    if (maxDepth <= 0) return;
    
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        if (['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', 'target'].includes(item)) continue;
        
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Include directories in search results if they match query terms
          const dirName = item.toLowerCase();
          const relativePath = fullPath.replace(directory, '').toLowerCase();
          
          const isDirRelevant = searchTerms.some(term => 
            dirName.includes(term) || relativePath.includes(term) || 
            term.includes(dirName) || term.includes('folder') || term.includes('directory')
          );
          
          if (isDirRelevant) {
            relevantFiles.push(fullPath + '/');  // Add trailing slash to indicate directory
          }
          
          searchRecursive(fullPath, maxDepth - 1);
        } else if (stat.isFile()) {
          // Check if filename or path contains search terms
          const relativePath = fullPath.replace(directory, '').toLowerCase();
          const fileName = item.toLowerCase();
          
          const isRelevant = searchTerms.some(term => 
            fileName.includes(term) || relativePath.includes(term)
          );
          
          if (isRelevant) {
            relevantFiles.push(fullPath);
          }
          
          // Limit to prevent too many results
          if (relevantFiles.length >= 15) return;
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
  }
  
  searchRecursive(directory);
  return relevantFiles.slice(0, 15); // Increased limit to include directories
}