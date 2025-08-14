import inquirer from 'inquirer';
import { echoPermission, echoSuccess, echoWarning } from './echo-sound.js';

export interface PermissionRequest {
  action: string;
  description: string;
  files?: string[];
  risk: 'low' | 'medium' | 'high';
  autoApprove?: boolean;
  timeout?: number; // seconds
}

export interface PermissionResponse {
  approved: boolean;
  remember?: boolean;
  reason?: string;
}

export class PermissionManager {
  private autoApprovedActions: Set<string> = new Set();
  private soundEnabled: boolean = true;

  constructor(soundEnabled: boolean = true) {
    this.soundEnabled = soundEnabled;
  }

  async requestPermission(request: PermissionRequest): Promise<PermissionResponse> {
    // Check if this action is auto-approved
    if (request.autoApprove || this.autoApprovedActions.has(request.action)) {
      return { approved: true };
    }

    // Play Echo permission sound
    if (this.soundEnabled) {
      await echoPermission();
      console.log('🔔 *Echo asking for permission*');
    }

    console.log(`\n🤖 Echo AI needs permission to proceed:`);
    console.log(`📋 Action: ${request.action}`);
    console.log(`📝 Description: ${request.description}`);
    
    if (request.files && request.files.length > 0) {
      console.log(`📁 Files affected:`);
      request.files.forEach(file => console.log(`   • ${file}`));
    }

    // Risk indicator
    const riskEmojis = { low: '🟢', medium: '🟡', high: '🔴' };
    console.log(`${riskEmojis[request.risk]} Risk level: ${request.risk.toUpperCase()}`);

    if (request.risk === 'high') {
      console.log('⚠️  HIGH RISK: This action may make significant changes to your project');
    }

    const choices = [
      { name: '✅ Yes, proceed', value: 'approve' },
      { name: '❌ No, cancel', value: 'deny' },
    ];

    // Add remember option for non-high risk actions
    if (request.risk !== 'high') {
      choices.push({ name: '✅ Yes, and remember for similar actions', value: 'approve_remember' });
    }

    let response: any;
    
    if (request.timeout) {
      // Timeout functionality
      response = await this.promptWithTimeout(choices, request.timeout);
      if (!response) {
        console.log(`\n⏰ Permission request timed out after ${request.timeout} seconds. Defaulting to DENY for safety.`);
        if (this.soundEnabled) await echoWarning();
        return { approved: false, reason: 'timeout' };
      }
    } else {
      response = await inquirer.prompt([
        {
          type: 'list',
          name: 'decision',
          message: 'Do you want to proceed?',
          choices,
          default: 'deny' // Default to deny for safety
        }
      ]);
    }

    const approved = response.decision === 'approve' || response.decision === 'approve_remember';
    
    if (response.decision === 'approve_remember') {
      this.autoApprovedActions.add(request.action);
      console.log(`✅ Permission granted and remembered for "${request.action}"`);
    }

    if (approved) {
      if (this.soundEnabled) await echoSuccess();
      console.log('✅ Permission granted. Proceeding...\n');
    } else {
      if (this.soundEnabled) await echoWarning();
      console.log('❌ Permission denied. Operation cancelled.\n');
    }

    return {
      approved,
      remember: response.decision === 'approve_remember',
      reason: approved ? 'user_approved' : 'user_denied'
    };
  }

  private async promptWithTimeout(choices: any[], timeoutSeconds: number): Promise<any> {
    return new Promise((resolve) => {
      let answered = false;
      
      // Set timeout
      const timeout = setTimeout(() => {
        if (!answered) {
          answered = true;
          resolve(null);
        }
      }, timeoutSeconds * 1000);

      // Ask question
      inquirer.prompt([
        {
          type: 'list',
          name: 'decision',
          message: `Do you want to proceed? (Auto-deny in ${timeoutSeconds}s)`,
          choices,
          default: 'deny'
        }
      ]).then((response) => {
        if (!answered) {
          answered = true;
          clearTimeout(timeout);
          resolve(response);
        }
      });
    });
  }

  clearAutoApprovals(): void {
    this.autoApprovedActions.clear();
    console.log('🧹 Cleared all auto-approved permissions');
  }

  getAutoApprovedActions(): string[] {
    return Array.from(this.autoApprovedActions);
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  // Convenience methods for common permission types
  async requestFileEdit(filePath: string, description: string): Promise<PermissionResponse> {
    return this.requestPermission({
      action: 'edit_file',
      description: `Edit file: ${description}`,
      files: [filePath],
      risk: 'medium'
    });
  }

  async requestFileCreate(filePath: string, description: string): Promise<PermissionResponse> {
    return this.requestPermission({
      action: 'create_file',
      description: `Create file: ${description}`,
      files: [filePath],
      risk: 'low'
    });
  }

  async requestMultipleFiles(files: string[], description: string): Promise<PermissionResponse> {
    return this.requestPermission({
      action: 'edit_multiple_files',
      description,
      files,
      risk: files.length > 5 ? 'high' : 'medium'
    });
  }

  async requestCommandExecution(command: string, description: string): Promise<PermissionResponse> {
    return this.requestPermission({
      action: 'execute_command',
      description: `Execute command: ${command}\n${description}`,
      risk: 'high',
      timeout: 30 // 30 second timeout for command execution
    });
  }

  async requestDependencyInstall(packages: string[], description: string): Promise<PermissionResponse> {
    return this.requestPermission({
      action: 'install_dependencies',
      description: `Install packages: ${packages.join(', ')}\n${description}`,
      risk: 'medium',
      timeout: 60 // 60 second timeout for dependency installation
    });
  }

  async requestProjectStructureChange(description: string): Promise<PermissionResponse> {
    return this.requestPermission({
      action: 'modify_project_structure',
      description,
      risk: 'high'
    });
  }
}

// Global permission manager
export const permissionManager = new PermissionManager();

// Convenience functions
export async function askPermission(request: PermissionRequest): Promise<PermissionResponse> {
  return permissionManager.requestPermission(request);
}

export async function askFileEdit(filePath: string, description: string): Promise<PermissionResponse> {
  return permissionManager.requestFileEdit(filePath, description);
}

export async function askFileCreate(filePath: string, description: string): Promise<PermissionResponse> {
  return permissionManager.requestFileCreate(filePath, description);
}

export async function askCommandExecution(command: string, description: string): Promise<PermissionResponse> {
  return permissionManager.requestCommandExecution(command, description);
}