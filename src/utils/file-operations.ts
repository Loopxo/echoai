import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

export interface FileOperation {
  type: 'create' | 'edit' | 'read';
  filePath: string;
  content?: string;
  success: boolean;
  message: string;
}

export function createFile(filePath: string, content: string): FileOperation {
  try {
    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Check if file already exists
    if (existsSync(filePath)) {
      return {
        type: 'create',
        filePath,
        content,
        success: false,
        message: `File already exists: ${filePath}. Use edit operation to modify it.`
      };
    }

    writeFileSync(filePath, content, 'utf-8');
    return {
      type: 'create',
      filePath,
      content,
      success: true,
      message: `Successfully created file: ${filePath}`
    };
  } catch (error) {
    return {
      type: 'create',
      filePath,
      content,
      success: false,
      message: `Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export function editFile(filePath: string, content: string): FileOperation {
  try {
    if (!existsSync(filePath)) {
      return {
        type: 'edit',
        filePath,
        content,
        success: false,
        message: `File does not exist: ${filePath}. Use create operation to make a new file.`
      };
    }

    writeFileSync(filePath, content, 'utf-8');
    return {
      type: 'edit',
      filePath,
      content,
      success: true,
      message: `Successfully edited file: ${filePath}`
    };
  } catch (error) {
    return {
      type: 'edit',
      filePath,
      content,
      success: false,
      message: `Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export function readFile(filePath: string): FileOperation {
  try {
    if (!existsSync(filePath)) {
      return {
        type: 'read',
        filePath,
        success: false,
        message: `File does not exist: ${filePath}`
      };
    }

    const content = readFileSync(filePath, 'utf-8');
    return {
      type: 'read',
      filePath,
      content,
      success: true,
      message: `Successfully read file: ${filePath}`
    };
  } catch (error) {
    return {
      type: 'read',
      filePath,
      success: false,
      message: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export function parseFileOperationFromAI(aiResponse: string, workingDirectory: string): FileOperation[] {
  const operations: FileOperation[] = [];
  
  // Look for code blocks with file creation/editing instructions
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  
  // More specific regex patterns for different file creation formats
  const patterns = [
    /create\s+(?:a\s+)?(?:new\s+)?file\s+called\s+[`'"]*([^\s`'"\n:]+(?:\.\w+)?)[`'"]*\s+(?:inside|in)\s+(?:the\s+)?([^\s\n:]+)\s+folder/gi,
    /create\s+(?:a\s+)?(?:new\s+)?file\s+called\s+[`'"]*([^\s`'"\n:]+(?:\.\w+)?)[`'"]/gi,
    /create\s+(?:a\s+)?(?:new\s+)?file\s+called\s+([^\s`'"\n:]+(?:\.\w+)?)/gi,
    /create\s+[`'"]*([^\s`'"\n:]+(?:\.\w+)?)[`'"]*\s+(?:file\s+)?(?:inside|in)\s+(?:the\s+)?([^\s\n:]+)/gi,
    /save\s+(?:as|to)\s+[`'"]*([^\s`'"\n:]+(?:\.\w+)?)[`'"]*/gi,
    /write\s+(?:to\s+)?[`'"]*([^\s`'"\n:]+(?:\.\w+)?)[`'"]*/gi
  ];
  
  let codeBlocks: Array<{ content: string; language: string }> = [];
  let match;
  
  // Extract all code blocks first
  while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
    codeBlocks.push({
      language: match[1] || '',
      content: match[2] ? match[2].trim() : ''
    });
  }
  
  // If we have code blocks, look for file creation instructions
  if (codeBlocks.length > 0) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0; // Reset regex
      const createMatch = pattern.exec(aiResponse);
      if (createMatch && createMatch[1]) {
        let fileName = createMatch[1].trim();
        let directory = '';
        
        // Handle different capture group patterns
        if (createMatch[2]) {
          directory = createMatch[2].trim().replace(/[`'"]/g, ''); // Remove quotes/backticks
        }
        
        // Clean filename of backticks and quotes
        fileName = fileName.replace(/[`'"]/g, '');
        
        // Use the first code block for now (could be enhanced to match specific blocks)
        const codeBlock = codeBlocks[0];
        if (!codeBlock) continue;
        
        // If no extension and we detected language, add appropriate extension
        if (!fileName.includes('.') && codeBlock.language) {
          const extensions: { [key: string]: string } = {
            'typescript': '.ts',
            'javascript': '.js', 
            'python': '.py',
            'rust': '.rs',
            'go': '.go',
            'java': '.java',
            'cpp': '.cpp',
            'c': '.c'
          };
          
          if (extensions[codeBlock.language.toLowerCase()]) {
            fileName += extensions[codeBlock.language.toLowerCase()];
          }
        }
        
        // Construct full path
        let fullPath: string;
        if (directory) {
          fullPath = join(workingDirectory, directory, fileName);
        } else {
          fullPath = join(workingDirectory, fileName);
        }
        
        operations.push(createFile(fullPath, codeBlock.content));
        break; // Only process the first match to avoid duplicates
      }
    }
  }
  
  return operations;
}