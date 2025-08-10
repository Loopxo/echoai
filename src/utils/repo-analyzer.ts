import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

export interface FileAnalysis {
  path: string;
  relativePath: string;
  type: 'config' | 'source' | 'test' | 'docs' | 'assets' | 'build';
  language?: string;
  size: number;
  dependencies?: string[];
  exports?: string[];
  imports?: string[];
  functions?: string[];
  classes?: string[];
  errors?: string[];
}

export interface RepoAnalysis {
  projectRoot: string;
  projectType: string;
  framework?: string;
  language: string;
  totalFiles: number;
  totalSize: number;
  structure: {
    source: FileAnalysis[];
    config: FileAnalysis[];
    tests: FileAnalysis[];
    docs: FileAnalysis[];
    assets: FileAnalysis[];
    build: FileAnalysis[];
  };
  dependencies: {
    production: string[];
    development: string[];
    peer: string[];
  };
  buildCommands: string[];
  testCommands: string[];
  entryPoints: string[];
  potentialIssues: string[];
  recommendations: string[];
}

export async function analyzeRepository(rootPath: string, deep: boolean = false): Promise<RepoAnalysis> {
  console.log('🔍 Analyzing repository structure...');
  
  const analysis: RepoAnalysis = {
    projectRoot: rootPath,
    projectType: 'Unknown',
    language: 'Mixed',
    totalFiles: 0,
    totalSize: 0,
    structure: {
      source: [],
      config: [],
      tests: [],
      docs: [],
      assets: [],
      build: []
    },
    dependencies: {
      production: [],
      development: [],
      peer: []
    },
    buildCommands: [],
    testCommands: [],
    entryPoints: [],
    potentialIssues: [],
    recommendations: []
  };

  // Analyze package.json first
  const packageJsonPath = join(rootPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      analysis.projectType = determineProjectType(packageJson);
      analysis.framework = detectFramework(packageJson);
      
      // Extract dependencies
      analysis.dependencies.production = Object.keys(packageJson.dependencies || {});
      analysis.dependencies.development = Object.keys(packageJson.devDependencies || {});
      analysis.dependencies.peer = Object.keys(packageJson.peerDependencies || {});
      
      // Extract commands
      const scripts = packageJson.scripts || {};
      analysis.buildCommands = extractCommands(scripts, ['build', 'compile', 'bundle']);
      analysis.testCommands = extractCommands(scripts, ['test', 'jest', 'vitest', 'cypress']);
      
      // Entry points
      if (packageJson.main) analysis.entryPoints.push(packageJson.main);
      if (packageJson.module) analysis.entryPoints.push(packageJson.module);
      if (packageJson.types) analysis.entryPoints.push(packageJson.types);
    } catch (error) {
      analysis.potentialIssues.push('Invalid package.json format');
    }
  }

  // Analyze file structure
  const files = await scanDirectory(rootPath, rootPath);
  
  for (const file of files) {
    const fileAnalysis = await analyzeFile(file, rootPath, deep);
    if (fileAnalysis) {
      // Fix the property access for tests vs test
      if (fileAnalysis.type === 'test') {
        analysis.structure.tests.push(fileAnalysis);
      } else {
        analysis.structure[fileAnalysis.type].push(fileAnalysis);
      }
      analysis.totalFiles++;
      analysis.totalSize += fileAnalysis.size;
    }
  }

  // Determine primary language
  analysis.language = determinePrimaryLanguage(files);
  
  // Generate recommendations
  analysis.recommendations = generateRecommendations(analysis);
  
  console.log(`✅ Repository analysis complete: ${analysis.totalFiles} files analyzed`);
  return analysis;
}

async function scanDirectory(dirPath: string, rootPath: string, maxDepth: number = 4): Promise<string[]> {
  const files: string[] = [];
  const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '__pycache__'];
  
  function scanRecursive(currentPath: string, depth: number): void {
    if (depth > maxDepth) return;
    
    try {
      const items = readdirSync(currentPath);
      
      for (const item of items) {
        if (item.startsWith('.') && !['.',  '..', '.env', '.gitignore', '.eslintrc', '.prettierrc'].some(allowed => item.startsWith(allowed))) {
          continue;
        }
        
        const fullPath = join(currentPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!excludeDirs.includes(item)) {
            scanRecursive(fullPath, depth + 1);
          }
        } else if (stat.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }
  
  scanRecursive(dirPath, 0);
  return files;
}

async function analyzeFile(filePath: string, rootPath: string, deep: boolean): Promise<FileAnalysis | null> {
  try {
    const stat = statSync(filePath);
    const relativePath = relative(rootPath, filePath);
    const ext = extname(filePath);
    
    const analysis: FileAnalysis = {
      path: filePath,
      relativePath: relativePath,
      type: determineFileType(relativePath, ext),
      language: determineLanguage(ext),
      size: stat.size,
      dependencies: [],
      exports: [],
      imports: [],
      functions: [],
      classes: [],
      errors: []
    };

    // Deep analysis for source files
    if (deep && analysis.type === 'source' && stat.size < 100000) { // Skip very large files
      try {
        const content = readFileSync(filePath, 'utf-8');
        
        // Extract imports/requires
        analysis.imports = extractImports(content, analysis.language || '');
        
        // Extract exports
        analysis.exports = extractExports(content, analysis.language || '');
        
        // Extract functions and classes (basic detection)
        if (analysis.language === 'typescript' || analysis.language === 'javascript') {
          analysis.functions = extractFunctions(content);
          analysis.classes = extractClasses(content);
        }
      } catch (error) {
        analysis.errors?.push(`Failed to analyze content: ${error}`);
      }
    }

    return analysis;
  } catch (error) {
    return null;
  }
}

function determineProjectType(packageJson: any): string {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps.react || deps['@types/react']) return 'React Application';
  if (deps.vue || deps['@vue/cli']) return 'Vue.js Application';
  if (deps.angular || deps['@angular/core']) return 'Angular Application';
  if (deps.next) return 'Next.js Application';
  if (deps.nuxt) return 'Nuxt.js Application';
  if (deps.svelte) return 'Svelte Application';
  if (deps.express || deps.fastify || deps.koa) return 'Node.js Backend';
  if (deps.electron) return 'Electron Application';
  if (packageJson.type === 'module' || deps.typescript) return 'Modern JavaScript/TypeScript Project';
  
  return 'Node.js Project';
}

function detectFramework(packageJson: any): string | undefined {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps.react) return 'React';
  if (deps.vue) return 'Vue.js';
  if (deps.angular) return 'Angular';
  if (deps.next) return 'Next.js';
  if (deps.nuxt) return 'Nuxt.js';
  if (deps.svelte) return 'Svelte';
  if (deps.express) return 'Express';
  if (deps.fastify) return 'Fastify';
  if (deps.electron) return 'Electron';
  
  return undefined;
}

function determineFileType(relativePath: string, extension: string): 'config' | 'source' | 'test' | 'docs' | 'assets' | 'build' {
  const path = relativePath.toLowerCase();
  
  // Config files
  if (path.includes('config') || ['.json', '.yml', '.yaml', '.toml', '.ini'].includes(extension) ||
      ['package.json', 'tsconfig.json', '.eslintrc', '.prettierrc', 'webpack.config'].some(config => path.includes(config))) {
    return 'config';
  }
  
  // Test files
  if (path.includes('test') || path.includes('spec') || path.includes('__tests__') || 
      ['.test.', '.spec.'].some(test => path.includes(test))) {
    return 'test';
  }
  
  // Documentation
  if (['.md', '.txt', '.rst'].includes(extension) || path.includes('readme') || path.includes('docs')) {
    return 'docs';
  }
  
  // Build outputs
  if (path.includes('dist') || path.includes('build') || path.includes('.next') || 
      ['.map', '.d.ts'].includes(extension)) {
    return 'build';
  }
  
  // Assets
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'].includes(extension)) {
    return 'assets';
  }
  
  // Source code
  return 'source';
}

function determineLanguage(extension: string): string {
  const languageMap: { [key: string]: string } = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.vue': 'vue',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.html': 'html',
    '.json': 'json',
    '.yml': 'yaml',
    '.yaml': 'yaml'
  };
  
  return languageMap[extension] || 'text';
}

function determinePrimaryLanguage(filePaths: string[]): string {
  const languageCounts: { [key: string]: number } = {};
  
  for (const filePath of filePaths) {
    const ext = extname(filePath);
    const lang = determineLanguage(ext);
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;
  }
  
  // Remove non-programming languages for primary determination
  delete languageCounts.text;
  delete languageCounts.json;
  delete languageCounts.css;
  delete languageCounts.html;
  
  const sortedLangs = Object.entries(languageCounts).sort(([,a], [,b]) => b - a);
  return sortedLangs[0]?.[0] || 'Mixed';
}

function extractCommands(scripts: any, keywords: string[]): string[] {
  const commands: string[] = [];
  
  for (const [key, value] of Object.entries(scripts)) {
    if (typeof value === 'string' && keywords.some(keyword => key.includes(keyword))) {
      commands.push(`npm run ${key}`);
    }
  }
  
  return commands;
}

function extractImports(content: string, language: string): string[] {
  const imports: string[] = [];
  
  if (language === 'typescript' || language === 'javascript') {
    // ES6 imports
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) imports.push(match[1]);
    }
    
    // CommonJS requires
    const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      if (match[1]) imports.push(match[1]);
    }
  }
  
  return imports;
}

function extractExports(content: string, language: string): string[] {
  const exports: string[] = [];
  
  if (language === 'typescript' || language === 'javascript') {
    // Named exports
    const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      if (match[1]) exports.push(match[1]);
    }
    
    // Default exports (simplified)
    if (content.includes('export default')) {
      exports.push('default');
    }
  }
  
  return exports;
}

function extractFunctions(content: string): string[] {
  const functions: string[] = [];
  
  // Function declarations and expressions
  const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function))/g;
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    const funcName = match[1] || match[2];
    if (funcName) functions.push(funcName);
  }
  
  return functions;
}

function extractClasses(content: string): string[] {
  const classes: string[] = [];
  
  const classRegex = /class\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    if (match[1]) classes.push(match[1]);
  }
  
  return classes;
}

function generateRecommendations(analysis: RepoAnalysis): string[] {
  const recommendations: string[] = [];
  
  // TypeScript recommendations
  if (analysis.language === 'javascript' && analysis.totalFiles > 10) {
    recommendations.push('Consider migrating to TypeScript for better type safety');
  }
  
  // Testing recommendations
  if (analysis.testCommands.length === 0) {
    recommendations.push('Add testing framework (Jest, Vitest, or similar)');
  }
  
  // Build recommendations
  if (analysis.buildCommands.length === 0 && analysis.projectType.includes('Application')) {
    recommendations.push('Add build scripts for production deployment');
  }
  
  // ESLint/Prettier recommendations
  const hasLinting = analysis.dependencies.development.some(dep => 
    dep.includes('eslint') || dep.includes('prettier')
  );
  if (!hasLinting) {
    recommendations.push('Add ESLint and Prettier for code quality');
  }
  
  // Performance recommendations
  if (analysis.totalSize > 10000000) { // 10MB
    recommendations.push('Consider code splitting and bundle optimization');
  }
  
  return recommendations;
}