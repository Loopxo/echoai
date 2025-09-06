import {
  PermissionConfig,
  PermissionRequest,
  PermissionResponse,
  PermissionRule,
  SecurityProfile,
  PermissionAuditEntry,
  PermissionLevel,
} from '../types/permissions.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import inquirer from 'inquirer';

export class PermissionManager {
  private currentProfile: SecurityProfile;
  private auditLog: PermissionAuditEntry[] = [];
  private configPath: string;
  private auditPath: string;

  constructor() {
    const echoDir = join(homedir(), '.echo');
    this.configPath = join(echoDir, 'permissions.json');
    this.auditPath = join(echoDir, 'security-audit.json');
    this.currentProfile = this.getDefaultProfile();
    this.ensureDirectories();
  }

  async initialize(): Promise<void> {
    await this.loadProfile();
    await this.loadAuditLog();
  }

  private getDefaultProfile(): SecurityProfile {
    return {
      name: 'default',
      description: 'Default security profile',
      permissions: {
        bash: 'ask',
        fileRead: 'ask',
        fileWrite: 'ask',
        fileEdit: 'ask',
        webFetch: 'ask',
        networkAccess: 'ask',
        systemInfo: 'allow',
        processManagement: 'deny',
        environmentAccess: 'ask',
      },
      rules: [],
      isDefault: true,
    };
  }

  private getStrictProfile(): SecurityProfile {
    return {
      name: 'strict',
      description: 'Strict security profile - requires explicit approval',
      permissions: {
        bash: 'ask',
        fileRead: 'ask',
        fileWrite: 'ask',
        fileEdit: 'ask',
        webFetch: 'ask',
        networkAccess: 'deny',
        systemInfo: 'ask',
        processManagement: 'deny',
        environmentAccess: 'deny',
      },
      rules: [],
      isDefault: false,
    };
  }

  private getPermissiveProfile(): SecurityProfile {
    return {
      name: 'permissive',
      description: 'Permissive security profile - allows most actions',
      permissions: {
        bash: 'allow',
        fileRead: 'allow',
        fileWrite: 'ask',
        fileEdit: 'ask',
        webFetch: 'allow',
        networkAccess: 'allow',
        systemInfo: 'allow',
        processManagement: 'ask',
        environmentAccess: 'allow',
      },
      rules: [],
      isDefault: false,
    };
  }

  async checkPermission(request: PermissionRequest): Promise<boolean> {
    // Check if there's a specific rule for this request
    const matchingRule = this.findMatchingRule(request);
    if (matchingRule) {
      matchingRule.usageCount++;
      matchingRule.lastUsed = new Date();
      await this.saveProfile();
      
      const granted = matchingRule.action === 'allow';
      await this.logPermissionRequest(request, granted);
      return granted;
    }

    // Check the general permission level
    const permissionLevel = this.currentProfile.permissions[request.type];
    
    switch (permissionLevel) {
      case 'allow':
        await this.logPermissionRequest(request, true);
        return true;
      
      case 'deny':
        await this.logPermissionRequest(request, false);
        return false;
      
      case 'ask':
        const response = await this.promptUser(request);
        await this.logPermissionRequest(request, response.granted);
        
        if (response.remember && response.customRule) {
          this.currentProfile.rules.push(response.customRule);
          await this.saveProfile();
        }
        
        return response.granted;
      
      default:
        await this.logPermissionRequest(request, false);
        return false;
    }
  }

  private findMatchingRule(request: PermissionRequest): PermissionRule | undefined {
    return this.currentProfile.rules.find(rule => {
      if (rule.type !== request.type) return false;
      
      try {
        const regex = new RegExp(rule.pattern, 'i');
        const testString = this.getTestStringForRequest(request);
        return regex.test(testString);
      } catch (error) {
        console.error(`Invalid regex pattern in rule ${rule.id}:`, rule.pattern);
        return false;
      }
    });
  }

  private getTestStringForRequest(request: PermissionRequest): string {
    switch (request.type) {
      case 'bash':
        return request.details.command || '';
      case 'fileRead':
      case 'fileWrite':
      case 'fileEdit':
        return request.details.filePath || '';
      case 'webFetch':
        return request.details.url || '';
      case 'processManagement':
        return request.details.processName || '';
      case 'environmentAccess':
        return request.details.envVar || '';
      default:
        return request.action;
    }
  }

  private async promptUser(request: PermissionRequest): Promise<PermissionResponse> {
    const riskEmoji = this.getRiskEmoji(request.riskLevel);
    const typeEmoji = this.getTypeEmoji(request.type);
    
    console.log(`\n${riskEmoji} ${typeEmoji} Permission Request`);
    console.log(`Type: ${request.type}`);
    console.log(`Action: ${request.action}`);
    console.log(`Risk Level: ${request.riskLevel}`);
    
    if (request.context) {
      console.log(`Context: ${request.context}`);
    }

    // Display relevant details
    Object.entries(request.details).forEach(([key, value]) => {
      if (value) {
        console.log(`${key}: ${value}`);
      }
    });

    const choices = [
      { name: '✅ Allow this time', value: 'allow_once' },
      { name: '❌ Deny this time', value: 'deny_once' },
      { name: '✅ Always allow similar requests', value: 'allow_always' },
      { name: '❌ Always deny similar requests', value: 'deny_always' },
      { name: '🔧 Create custom rule', value: 'custom_rule' },
    ];

    const { choice } = await inquirer.prompt([{
      type: 'list',
      name: 'choice',
      message: 'What would you like to do?',
      choices,
    }]);

    const response: PermissionResponse = {
      requestId: request.id,
      granted: choice.startsWith('allow'),
      remember: choice.includes('always') || choice === 'custom_rule',
    };

    if (choice === 'custom_rule') {
      const customRule = await this.createCustomRule(request);
      response.customRule = customRule;
      response.granted = customRule.action === 'allow';
    } else if (choice.includes('always')) {
      const pattern = this.generatePatternForRequest(request);
      response.customRule = {
        id: uuidv4(),
        type: request.type,
        pattern,
        action: choice.startsWith('allow') ? 'allow' : 'deny',
        description: `Auto-generated rule for ${request.type}`,
        createdAt: new Date(),
        usageCount: 0,
      };
    }

    return response;
  }

  private async createCustomRule(request: PermissionRequest): Promise<PermissionRule> {
    const { pattern, description, action } = await inquirer.prompt([
      {
        type: 'input',
        name: 'pattern',
        message: 'Enter a regex pattern to match (leave empty for exact match):',
        default: this.generatePatternForRequest(request),
      },
      {
        type: 'input',
        name: 'description',
        message: 'Enter a description for this rule:',
        default: `Custom rule for ${request.type}`,
      },
      {
        type: 'list',
        name: 'action',
        message: 'Action to take when this pattern matches:',
        choices: [
          { name: '✅ Allow', value: 'allow' },
          { name: '❌ Deny', value: 'deny' },
        ],
      },
    ]);

    return {
      id: uuidv4(),
      type: request.type,
      pattern,
      action,
      description,
      createdAt: new Date(),
      usageCount: 0,
    };
  }

  private generatePatternForRequest(request: PermissionRequest): string {
    const testString = this.getTestStringForRequest(request);
    // Escape special regex characters
    return testString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getRiskEmoji(riskLevel: string): string {
    switch (riskLevel) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🟠';
      case 'critical': return '🔴';
      default: return '❓';
    }
  }

  private getTypeEmoji(type: string): string {
    switch (type) {
      case 'bash': return '💻';
      case 'fileRead': return '📖';
      case 'fileWrite': return '✏️';
      case 'fileEdit': return '📝';
      case 'webFetch': return '🌐';
      case 'networkAccess': return '🔗';
      case 'systemInfo': return 'ℹ️';
      case 'processManagement': return '⚙️';
      case 'environmentAccess': return '🌍';
      default: return '🔒';
    }
  }

  async setSecurityProfile(profileName: string): Promise<void> {
    switch (profileName.toLowerCase()) {
      case 'default':
        this.currentProfile = this.getDefaultProfile();
        break;
      case 'strict':
        this.currentProfile = this.getStrictProfile();
        break;
      case 'permissive':
        this.currentProfile = this.getPermissiveProfile();
        break;
      default:
        throw new Error(`Unknown security profile: ${profileName}`);
    }
    
    await this.saveProfile();
  }

  getCurrentProfile(): SecurityProfile {
    return { ...this.currentProfile };
  }

  getAvailableProfiles(): string[] {
    return ['default', 'strict', 'permissive'];
  }

  async addCustomRule(rule: Omit<PermissionRule, 'id' | 'createdAt' | 'usageCount'>): Promise<void> {
    const fullRule: PermissionRule = {
      ...rule,
      id: uuidv4(),
      createdAt: new Date(),
      usageCount: 0,
    };
    
    this.currentProfile.rules.push(fullRule);
    await this.saveProfile();
  }

  async removeRule(ruleId: string): Promise<boolean> {
    const initialLength = this.currentProfile.rules.length;
    this.currentProfile.rules = this.currentProfile.rules.filter(rule => rule.id !== ruleId);
    
    if (this.currentProfile.rules.length < initialLength) {
      await this.saveProfile();
      return true;
    }
    
    return false;
  }

  getAuditLog(limit?: number): PermissionAuditEntry[] {
    return limit ? this.auditLog.slice(-limit) : [...this.auditLog];
  }

  getSecurityStats(): {
    totalRequests: number;
    grantedCount: number;
    deniedCount: number;
    riskBreakdown: Record<string, number>;
    typeBreakdown: Record<string, number>;
  } {
    const totalRequests = this.auditLog.length;
    const grantedCount = this.auditLog.filter(entry => entry.granted).length;
    const deniedCount = totalRequests - grantedCount;

    const riskBreakdown: Record<string, number> = {};
    const typeBreakdown: Record<string, number> = {};

    this.auditLog.forEach(entry => {
      riskBreakdown[entry.riskLevel] = (riskBreakdown[entry.riskLevel] || 0) + 1;
      typeBreakdown[entry.type] = (typeBreakdown[entry.type] || 0) + 1;
    });

    return {
      totalRequests,
      grantedCount,
      deniedCount,
      riskBreakdown,
      typeBreakdown,
    };
  }

  private async logPermissionRequest(request: PermissionRequest, granted: boolean): Promise<void> {
    const auditEntry: PermissionAuditEntry = {
      id: uuidv4(),
      requestId: request.id,
      type: request.type,
      action: request.action,
      granted,
      riskLevel: request.riskLevel,
      timestamp: new Date(),
      details: request.details,
    };

    this.auditLog.push(auditEntry);
    
    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }

    await this.saveAuditLog();
  }

  private async ensureDirectories(): Promise<void> {
    const echoDir = join(homedir(), '.echo');
    if (!existsSync(echoDir)) {
      await mkdir(echoDir, { recursive: true });
    }
  }

  private async loadProfile(): Promise<void> {
    try {
      const configData = await readFile(this.configPath, 'utf8');
      this.currentProfile = JSON.parse(configData);
      
      // Ensure dates are properly parsed
      this.currentProfile.rules.forEach(rule => {
        rule.createdAt = new Date(rule.createdAt);
        if (rule.lastUsed) {
          rule.lastUsed = new Date(rule.lastUsed);
        }
      });
    } catch (error) {
      // Config file doesn't exist, use default
      await this.saveProfile();
    }
  }

  private async saveProfile(): Promise<void> {
    await writeFile(this.configPath, JSON.stringify(this.currentProfile, null, 2));
  }

  private async loadAuditLog(): Promise<void> {
    try {
      const auditData = await readFile(this.auditPath, 'utf8');
      const rawLog = JSON.parse(auditData);
      
      this.auditLog = rawLog.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    } catch (error) {
      // Audit file doesn't exist, start fresh
      this.auditLog = [];
    }
  }

  private async saveAuditLog(): Promise<void> {
    await writeFile(this.auditPath, JSON.stringify(this.auditLog, null, 2));
  }
}

// Global permission manager instance
export const permissionManager = new PermissionManager();