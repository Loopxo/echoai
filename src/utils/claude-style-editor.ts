import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createFile, editFile } from './file-operations.js';
import inquirer from 'inquirer';
import { diffChars } from 'diff';
import { shouldAutoApprove, setAutoApproveEdits, setAutoApproveCreations } from './session-state.js';

export interface EditOperation {
  type: 'create' | 'edit';
  filePath: string;
  originalContent?: string;
  newContent: string;
  changes?: string;
  approved?: boolean;
}

export interface EditInstruction {
  operation: 'replace' | 'insert' | 'delete' | 'add_function' | 'modify_function';
  target?: string; // What to find/replace
  replacement?: string; // What to replace it with
  position?: 'beginning' | 'end' | 'after' | 'before';
  reference?: string; // Reference point for position
}

export async function handleClaudeStyleEdit(
  filePath: string, 
  instructions: EditInstruction[], 
  newContent?: string
): Promise<EditOperation> {
  const fileExists = existsSync(filePath);
  
  if (!fileExists) {
    // File doesn't exist - create it
    console.log(`\n📝 Creating new file: ${filePath.replace(process.cwd(), '.')}`);
    
    if (newContent) {
      // Check if auto-approval is enabled for file creation
      if (shouldAutoApprove('create')) {
        console.log('🚀 Auto-creating file (session setting enabled)');
        const result = createFile(filePath, newContent);
        return {
          type: 'create',
          filePath,
          newContent,
          approved: true
        };
      }

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Create this new file?',
          choices: [
            { name: '✅ Yes', value: 'yes' },
            { name: '✅ Yes, don\'t ask me again this session', value: 'yes_always' },
            { name: '❌ No, tell me what to do differently', value: 'no_feedback' },
          ],
        },
      ]);

      if (action === 'yes' || action === 'yes_always') {
        if (action === 'yes_always') {
          setAutoApproveCreations(true);
        }
        
        const result = createFile(filePath, newContent);
        return {
          type: 'create',
          filePath,
          newContent,
          approved: true
        };
      } else {
        // Ask for feedback
        const { feedback } = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'What would you like me to do differently?',
          },
        ]);
        
        console.log(`📝 User feedback: ${feedback}`);
        console.log('💡 You can provide this feedback to improve the next attempt.');
        
        return {
          type: 'create',
          filePath,
          newContent: newContent || '',
          approved: false
        };
      }
    }
  } else {
    // File exists - edit it
    const originalContent = readFileSync(filePath, 'utf-8');
    console.log(`\n📝 Editing existing file: ${filePath.replace(process.cwd(), '.')}`);
    console.log(`📊 Current file size: ${originalContent.length} characters`);
    
    let modifiedContent = originalContent;
    
    // Apply edit instructions
    for (const instruction of instructions) {
      modifiedContent = applyEditInstruction(modifiedContent, instruction);
    }
    
    if (newContent && newContent !== originalContent) {
      modifiedContent = newContent;
    }
    
    // Show diff preview like Claude Code
    if (originalContent !== modifiedContent) {
      console.log('\n🔄 Proposed changes:');
      showDiff(originalContent, modifiedContent);
      
      // Check if auto-approval is enabled for edits
      if (shouldAutoApprove('edit')) {
        console.log('🚀 Auto-applying changes (session setting enabled)');
        writeFileSync(filePath, modifiedContent, 'utf-8');
        console.log(`✅ Changes applied to ${filePath.replace(process.cwd(), '.')}`);
        return {
          type: 'edit',
          filePath,
          originalContent,
          newContent: modifiedContent,
          approved: true
        };
      }
      
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Apply these changes?',
          choices: [
            { name: '✅ Yes', value: 'yes' },
            { name: '✅ Yes, don\'t ask me again this session', value: 'yes_always' },
            { name: '❌ No, tell me what to do differently', value: 'no_feedback' },
          ],
        },
      ]);

      if (action === 'yes' || action === 'yes_always') {
        if (action === 'yes_always') {
          setAutoApproveEdits(true);
        }
        
        writeFileSync(filePath, modifiedContent, 'utf-8');
        console.log(`✅ Changes applied to ${filePath.replace(process.cwd(), '.')}`);
        return {
          type: 'edit',
          filePath,
          originalContent,
          newContent: modifiedContent,
          approved: true
        };
      } else {
        // Ask for feedback
        const { feedback } = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'What would you like me to do differently with this edit?',
          },
        ]);
        
        console.log(`📝 User feedback: ${feedback}`);
        console.log('💡 You can provide this feedback in your next request for better results.');
        
        return {
          type: 'edit',
          filePath,
          originalContent,
          newContent: modifiedContent,
          approved: false
        };
      }
    } else {
      console.log('ℹ️  No changes needed - file is already up to date');
      return {
        type: 'edit',
        filePath,
        originalContent,
        newContent: originalContent,
        approved: true
      };
    }
  }
  
  return {
    type: fileExists ? 'edit' : 'create',
    filePath,
    originalContent: fileExists ? readFileSync(filePath, 'utf-8') : undefined,
    newContent: newContent || '',
    approved: false
  };
}

function applyEditInstruction(content: string, instruction: EditInstruction): string {
  switch (instruction.operation) {
    case 'replace':
      if (instruction.target && instruction.replacement !== undefined) {
        return content.replace(instruction.target, instruction.replacement);
      }
      break;
      
    case 'insert':
      if (instruction.replacement && instruction.position && instruction.reference) {
        const lines = content.split('\n');
        const refIndex = lines.findIndex(line => line.includes(instruction.reference!));
        
        if (refIndex !== -1) {
          if (instruction.position === 'after') {
            lines.splice(refIndex + 1, 0, instruction.replacement);
          } else if (instruction.position === 'before') {
            lines.splice(refIndex, 0, instruction.replacement);
          }
          return lines.join('\n');
        }
      }
      break;
      
    case 'add_function':
      if (instruction.replacement) {
        // Add function at the end
        return content + '\n\n' + instruction.replacement;
      }
      break;
  }
  
  return content;
}

function showDiff(original: string, modified: string): void {
  const diff = diffChars(original, modified);
  let output = '';
  
  diff.forEach((part) => {
    if (part.added) {
      output += `\x1b[32m+ ${part.value}\x1b[0m`; // Green for additions
    } else if (part.removed) {
      output += `\x1b[31m- ${part.value}\x1b[0m`; // Red for deletions
    } else {
      // Show context (first and last few chars of unchanged parts)
      if (part.value.length > 100) {
        const start = part.value.substring(0, 50);
        const end = part.value.substring(part.value.length - 50);
        output += `${start}...${end}`;
      } else {
        output += part.value;
      }
    }
  });
  
  console.log(output);
}

export function parseEditInstructions(aiResponse: string): {
  instructions: EditInstruction[];
  hasFileOperations: boolean;
  targetFile?: string;
  newContent?: string;
} {
  const instructions: EditInstruction[] = [];
  let targetFile: string | undefined;
  let newContent: string | undefined;
  let hasFileOperations = false;
  
  // Look for edit instructions - more comprehensive patterns
  const editPatterns = [
    /edit\s+(?:the\s+)?([^\s]+)(?:\s+file)?/gi,
    /modify\s+(?:the\s+)?([^\s]+)(?:\s+file)?/gi,
    /update\s+(?:the\s+)?([^\s]+)(?:\s+file)?/gi,
    /change\s+(?:the\s+)?([^\s]+)(?:\s+file)?/gi,
    /edit\s+([^\s]+)\s+file/gi,
    /Let's\s+edit\s+(?:the\s+)?([^\s]+)/gi,
  ];
  
  for (const pattern of editPatterns) {
    pattern.lastIndex = 0; // Reset regex state
    const match = pattern.exec(aiResponse);
    if (match && match[1]) {
      targetFile = match[1].replace(/[`'"*]/g, '').trim();
      hasFileOperations = true;
      break;
    }
  }
  
  // Look for code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
    if (match[2]) {
      newContent = match[2].trim();
      hasFileOperations = true;
    }
  }
  
  // Look for specific replace instructions
  const replacePattern = /replace\s+[`'"]*([^`'"]+)[`'"]*\s+with\s+[`'"]*([^`'"]+)[`'"]/gi;
  const replaceMatch = replacePattern.exec(aiResponse);
  if (replaceMatch) {
    instructions.push({
      operation: 'replace',
      target: replaceMatch[1],
      replacement: replaceMatch[2]
    });
    hasFileOperations = true;
  }
  
  return {
    instructions,
    hasFileOperations,
    targetFile,
    newContent
  };
}