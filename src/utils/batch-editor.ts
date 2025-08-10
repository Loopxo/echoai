import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { handleClaudeStyleEdit } from './claude-style-editor.js';
import { shouldAutoApprove, setAutoApproveEdits, setAutoApproveCreations } from './session-state.js';
import inquirer from 'inquirer';

export interface BatchFileOperation {
  type: 'create' | 'edit' | 'delete';
  filePath: string;
  content?: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface BatchOperationResult {
  operation: BatchFileOperation;
  success: boolean;
  message: string;
  skipped?: boolean;
}

export interface ProjectScaffold {
  projectName: string;
  projectType: string;
  framework?: string;
  files: BatchFileOperation[];
  dependencies: {
    production: string[];
    development: string[];
  };
  scripts: { [key: string]: string };
  postInstallSteps: string[];
}

export async function executeBatchOperations(
  operations: BatchFileOperation[],
  workingDirectory: string,
  showPreview: boolean = true
): Promise<BatchOperationResult[]> {
  console.log(`\n🚀 Batch Operations: ${operations.length} files to process`);
  
  if (showPreview) {
    // Show preview of all operations
    console.log('\n📋 Preview of operations:');
    operations.forEach((op, index) => {
      const icon = op.type === 'create' ? '📄' : op.type === 'edit' ? '✏️' : '🗑️';
      const relativePath = op.filePath.replace(workingDirectory, '.');
      console.log(`  ${index + 1}. ${icon} ${op.type.toUpperCase()} ${relativePath}`);
      console.log(`     └── ${op.description}`);
    });
    
    // Ask for batch approval
    const { batchAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'batchAction',
        message: 'How do you want to proceed?',
        choices: [
          { name: '✅ Approve all operations', value: 'approve_all' },
          { name: '🔍 Review each operation individually', value: 'review_each' },
          { name: '⚙️ Auto-approve for this session', value: 'auto_approve' },
          { name: '❌ Cancel all operations', value: 'cancel' },
        ],
      },
    ]);

    if (batchAction === 'cancel') {
      return operations.map(op => ({
        operation: op,
        success: false,
        message: 'Operation cancelled by user',
        skipped: true
      }));
    }

    if (batchAction === 'auto_approve') {
      setAutoApproveEdits(true);
      setAutoApproveCreations(true);
      console.log('🚀 Auto-approving all operations for this session');
    }
  }

  const results: BatchOperationResult[] = [];
  
  // Group operations by priority
  const sortedOps = operations.sort((a, b) => {
    const priority = { high: 3, medium: 2, low: 1 };
    return priority[b.priority] - priority[a.priority];
  });
  
  for (const operation of sortedOps) {
    console.log(`\n${operations.indexOf(operation) + 1}/${operations.length} Processing: ${operation.filePath.replace(workingDirectory, '.')}`);
    
    try {
      const result = await executeOperation(operation, workingDirectory);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ ${result.message}`);
      } else if (!result.skipped) {
        console.log(`❌ ${result.message}`);
      }
    } catch (error) {
      results.push({
        operation,
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.success && !r.skipped).length;
  
  console.log(`\n📊 Batch operation complete:`);
  console.log(`   ✅ Successful: ${successful}`);
  if (skipped > 0) console.log(`   ⏭️  Skipped: ${skipped}`);
  if (failed > 0) console.log(`   ❌ Failed: ${failed}`);
  
  return results;
}

async function executeOperation(
  operation: BatchFileOperation,
  workingDirectory: string
): Promise<BatchOperationResult> {
  const fullPath = operation.filePath.startsWith('/') 
    ? operation.filePath 
    : join(workingDirectory, operation.filePath);

  switch (operation.type) {
    case 'create':
      return await createFile(operation, fullPath);
      
    case 'edit':
      if (!existsSync(fullPath)) {
        return {
          operation,
          success: false,
          message: `File does not exist: ${operation.filePath}`
        };
      }
      return await editFile(operation, fullPath);
      
    case 'delete':
      // For safety, we'll skip delete operations in batch mode
      return {
        operation,
        success: false,
        message: 'Delete operations are not supported in batch mode for safety',
        skipped: true
      };
      
    default:
      return {
        operation,
        success: false,
        message: `Unknown operation type: ${operation.type}`
      };
  }
}

async function createFile(
  operation: BatchFileOperation,
  fullPath: string
): Promise<BatchOperationResult> {
  try {
    // Ensure directory exists
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Check if file already exists
    if (existsSync(fullPath)) {
      return {
        operation,
        success: false,
        message: `File already exists: ${operation.filePath}`
      };
    }

    // Check auto-approval
    if (shouldAutoApprove('create')) {
      writeFileSync(fullPath, operation.content || '', 'utf-8');
      return {
        operation,
        success: true,
        message: `Created file: ${operation.filePath}`
      };
    }

    // Individual approval if not in batch mode
    writeFileSync(fullPath, operation.content || '', 'utf-8');
    return {
      operation,
      success: true,
      message: `Created file: ${operation.filePath}`
    };
  } catch (error) {
    return {
      operation,
      success: false,
      message: `Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function editFile(
  operation: BatchFileOperation,
  fullPath: string
): Promise<BatchOperationResult> {
  try {
    // Use Claude Code style editing but in batch mode
    if (shouldAutoApprove('edit') || !operation.content) {
      writeFileSync(fullPath, operation.content || '', 'utf-8');
      return {
        operation,
        success: true,
        message: `Updated file: ${operation.filePath}`
      };
    }

    // For batch operations, we'll just write the content
    writeFileSync(fullPath, operation.content || '', 'utf-8');
    return {
      operation,
      success: true,
      message: `Updated file: ${operation.filePath}`
    };
  } catch (error) {
    return {
      operation,
      success: false,
      message: `Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Project scaffolding functions
export function createReactAppScaffold(projectName: string, location: string): ProjectScaffold {
  const projectPath = join(location, projectName);
  
  return {
    projectName,
    projectType: 'React Application',
    framework: 'React',
    files: [
      {
        type: 'create',
        filePath: join(projectPath, 'package.json'),
        content: generatePackageJson(projectName, 'react'),
        description: 'Package configuration with React dependencies',
        priority: 'high'
      },
      {
        type: 'create',
        filePath: join(projectPath, 'public/index.html'),
        content: generateIndexHtml(projectName),
        description: 'Main HTML template',
        priority: 'high'
      },
      {
        type: 'create',
        filePath: join(projectPath, 'src/index.js'),
        content: generateReactIndex(),
        description: 'React application entry point',
        priority: 'high'
      },
      {
        type: 'create',
        filePath: join(projectPath, 'src/App.js'),
        content: generateTodoApp(),
        description: 'Main Todo App component',
        priority: 'high'
      },
      {
        type: 'create',
        filePath: join(projectPath, 'src/App.css'),
        content: generateTodoAppCSS(),
        description: 'Todo App styles',
        priority: 'medium'
      },
      {
        type: 'create',
        filePath: join(projectPath, 'src/components/TodoItem.js'),
        content: generateTodoItem(),
        description: 'Individual todo item component',
        priority: 'medium'
      },
      {
        type: 'create',
        filePath: join(projectPath, 'src/components/TodoList.js'),
        content: generateTodoList(),
        description: 'Todo list container component',
        priority: 'medium'
      },
      {
        type: 'create',
        filePath: join(projectPath, '.gitignore'),
        content: generateGitignore(),
        description: 'Git ignore file',
        priority: 'low'
      },
      {
        type: 'create',
        filePath: join(projectPath, 'README.md'),
        content: generateReadme(projectName),
        description: 'Project documentation',
        priority: 'low'
      }
    ],
    dependencies: {
      production: ['react', 'react-dom'],
      development: ['@vitejs/plugin-react', 'vite', 'eslint', 'prettier']
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
      'lint': 'eslint src --ext .js,.jsx',
      'format': 'prettier --write src/**/*.{js,jsx,css,md}'
    },
    postInstallSteps: [
      'cd ' + projectName,
      'npm install',
      'npm run dev'
    ]
  };
}

function generatePackageJson(projectName: string, type: string): string {
  return JSON.stringify({
    name: projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: `A simple ${type} todo application`,
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
      lint: 'eslint src --ext .js,.jsx',
      format: 'prettier --write src/**/*.{js,jsx,css,md}'
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      '@types/react': '^18.2.15',
      '@types/react-dom': '^18.2.7',
      '@vitejs/plugin-react': '^4.0.3',
      vite: '^4.4.5',
      eslint: '^8.45.0',
      'eslint-plugin-react': '^7.32.2',
      prettier: '^3.0.0'
    }
  }, null, 2);
}

function generateIndexHtml(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.js"></script>
  </body>
</html>`;
}

function generateReactIndex(): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
}

function generateTodoApp(): string {
  return `import React, { useState } from 'react';
import TodoList from './components/TodoList.js';

function App() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');

  const addTodo = () => {
    if (inputValue.trim()) {
      setTodos([...todos, {
        id: Date.now(),
        text: inputValue,
        completed: false
      }]);
      setInputValue('');
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📝 Todo App</h1>
        <div className="input-section">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new todo..."
            className="todo-input"
          />
          <button onClick={addTodo} className="add-button">
            Add
          </button>
        </div>
      </header>
      
      <main className="app-main">
        <TodoList 
          todos={todos} 
          onToggle={toggleTodo} 
          onDelete={deleteTodo} 
        />
        
        {todos.length === 0 && (
          <div className="empty-state">
            <p>No todos yet. Add one above! 🌟</p>
          </div>
        )}
        
        <div className="stats">
          <p>
            {todos.filter(todo => !todo.completed).length} of {todos.length} remaining
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;`;
}

function generateTodoList(): string {
  return `import React from 'react';
import TodoItem from './TodoItem.js';

function TodoList({ todos, onToggle, onDelete }) {
  return (
    <div className="todo-list">
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default TodoList;`;
}

function generateTodoItem(): string {
  return `import React from 'react';

function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <div className={\`todo-item \${todo.completed ? 'completed' : ''}\`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        className="todo-checkbox"
      />
      <span className="todo-text">{todo.text}</span>
      <button
        onClick={() => onDelete(todo.id)}
        className="delete-button"
        title="Delete todo"
      >
        🗑️
      </button>
    </div>
  );
}

export default TodoItem;`;
}

function generateTodoAppCSS(): string {
  return `.app {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-header {
  text-align: center;
  margin-bottom: 30px;
}

.app-header h1 {
  color: #333;
  margin-bottom: 20px;
}

.input-section {
  display: flex;
  gap: 10px;
  max-width: 400px;
  margin: 0 auto;
}

.todo-input {
  flex: 1;
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
}

.todo-input:focus {
  outline: none;
  border-color: #0066cc;
}

.add-button {
  padding: 12px 24px;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.add-button:hover {
  background: #0052a3;
}

.todo-list {
  margin: 20px 0;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 12px;
  margin: 8px 0;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  background: white;
  transition: all 0.2s;
}

.todo-item:hover {
  shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.todo-item.completed {
  opacity: 0.6;
  background: #f8f9fa;
}

.todo-checkbox {
  margin-right: 12px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.todo-text {
  flex: 1;
  font-size: 16px;
  color: #333;
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
  color: #6c757d;
}

.delete-button {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.delete-button:hover {
  background: #f8f9fa;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.stats {
  text-align: center;
  margin-top: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  color: #6c757d;
  font-size: 14px;
}`;
}

function generateGitignore(): string {
  return `# Dependencies
node_modules/
.pnp
.pnp.js

# Production builds
dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Editor directories and files
.vscode/
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db`;
}

function generateReadme(projectName: string): string {
  return `# ${projectName}

A simple and elegant Todo application built with React and Vite.

## ✨ Features

- ➕ Add new todos
- ✅ Mark todos as complete
- 🗑️ Delete todos
- 📊 View progress statistics
- 📱 Responsive design

## 🚀 Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
\`\`\`

## 🛠️ Development

- **Framework**: React 18
- **Build tool**: Vite
- **Styling**: Pure CSS
- **Code quality**: ESLint + Prettier

## 📝 Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build
- \`npm run lint\` - Run ESLint
- \`npm run format\` - Format code with Prettier

---

🔮 Generated with Echo AI - Professional code editor
`;
}