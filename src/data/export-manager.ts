import {
  ExportOptions,
  ImportOptions,
  ExportManifest,
  CompleteExport,
  ImportResult,
  ConfigExport,
} from '../types/export.js';
import { SessionStore } from '../storage/session-store.js';
import { analyticsTracker } from '../analytics/tracker.js';
import { permissionManager } from '../security/permission-manager.js';
import { ConfigManager } from '../config/manager.js';
import { readFile, writeFile, mkdir, cp } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash, createCipheriv, createDecipheriv } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import * as yaml from 'js-yaml';

export class ExportManager {
  private echoDir: string;
  private backupDir: string;
  private sessionStore: SessionStore;
  private configManager: ConfigManager;

  constructor() {
    this.echoDir = join(homedir(), '.echo');
    this.backupDir = join(this.echoDir, 'backups');
    this.sessionStore = new SessionStore();
    this.configManager = new ConfigManager();
    this.ensureDirectories();
  }

  async exportData(options: ExportOptions): Promise<string> {
    const manifest: ExportManifest = {
      version: '2.2.1',
      exportDate: new Date(),
      exportedBy: 'echo-ai',
      format: options.format,
      compressed: options.compress,
      encrypted: options.encrypt,
      contents: {
        configs: options.includeConfigs,
        sessions: options.includeSessions,
        analytics: options.includeAnalytics,
        security: options.includeSecurity,
        mcp: options.includeMCP,
      },
      checksum: '',
    };

    const exportData: CompleteExport = { manifest };

    // Export configurations
    if (options.includeConfigs) {
      exportData.configs = await this.exportConfigs();
    }

    // Export sessions
    if (options.includeSessions) {
      const filter = options.dateRange ? { dateRange: options.dateRange } : undefined;
      const sessions = await this.sessionStore.listSessions(filter);
      exportData.sessions = [];

      for (const sessionMeta of sessions) {
        const fullSession = await this.sessionStore.getSession(sessionMeta.id);
        if (fullSession) {
          exportData.sessions.push(fullSession);
        }
      }

      manifest.sessionCount = exportData.sessions.length;
      if (options.dateRange) {
        manifest.dateRange = options.dateRange;
      }
    }

    // Export analytics
    if (options.includeAnalytics) {
      const days = options.dateRange
        ? Math.ceil((options.dateRange.to.getTime() - options.dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
        : 90;
      
      exportData.analytics = {
        config: await analyticsTracker.getConfig(),
        providerMetrics: await analyticsTracker.getProviderMetrics(days),
        toolStats: await analyticsTracker.getToolUsageStats(days),
        costAnalysis: await analyticsTracker.getCostAnalysis(),
      };
    }

    // Export security settings
    if (options.includeSecurity) {
      await permissionManager.initialize();
      exportData.security = {
        profile: permissionManager.getCurrentProfile(),
        auditLog: permissionManager.getAuditLog(),
        stats: permissionManager.getSecurityStats(),
      };
    }

    // Export MCP configuration
    if (options.includeMCP) {
      try {
        const mcpConfigPath = join(this.echoDir, 'mcp.json');
        if (existsSync(mcpConfigPath)) {
          const mcpData = await readFile(mcpConfigPath, 'utf8');
          exportData.mcp = JSON.parse(mcpData);
        }
      } catch (error) {
        console.warn('Failed to export MCP configuration:', error);
      }
    }

    // Calculate checksum
    const dataString = JSON.stringify(exportData);
    manifest.checksum = createHash('sha256').update(dataString).digest('hex');
    exportData.manifest = manifest;

    // Convert to desired format
    let output = this.convertToFormat(exportData, options.format);

    // Compress if requested
    if (options.compress) {
      output = gzipSync(Buffer.from(output, 'utf8')).toString('base64');
    }

    // Encrypt if requested
    if (options.encrypt && options.password) {
      const key = createHash('sha256').update(options.password).digest();
      const iv = Buffer.alloc(16, 0); // In production, use random IV
      const cipher = createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(output, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      output = encrypted;
    }

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `echo-export-${timestamp}.${options.format}`;
    const filepath = join(this.echoDir, 'exports', filename);

    await mkdir(join(this.echoDir, 'exports'), { recursive: true });
    await writeFile(filepath, output);

    return filepath;
  }

  async importData(filepath: string, options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: {
        configs: 0,
        sessions: 0,
        analyticsEntries: 0,
        securityRules: 0,
        mcpServers: 0,
      },
      skipped: {
        configs: 0,
        sessions: 0,
        analyticsEntries: 0,
        securityRules: 0,
        mcpServers: 0,
      },
      errors: [],
    };

    try {
      // Create backup if requested
      if (options.backup) {
        result.backupPath = await this.createBackup();
      }

      // Read and decrypt file
      let content = await readFile(filepath, 'utf8');

      if (options.password) {
        try {
          const key = createHash('sha256').update(options.password).digest();
          const iv = Buffer.alloc(16, 0); // Same IV as used for encryption
          const decipher = createDecipheriv('aes-256-cbc', key, iv);
          let decrypted = decipher.update(content, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          content = decrypted;
        } catch (error) {
          result.errors.push('Failed to decrypt file - incorrect password?');
          return result;
        }
      }

      // Decompress if needed
      if (content.match(/^[A-Za-z0-9+/]+=*$/)) {
        try {
          content = gunzipSync(Buffer.from(content, 'base64')).toString('utf8');
        } catch (error) {
          // Not compressed or different format
        }
      }

      // Parse data
      const exportData: CompleteExport = this.parseFromFormat(content, options.format);

      // Validate manifest
      if (!exportData.manifest) {
        result.errors.push('Invalid export file - missing manifest');
        return result;
      }

      // Verify checksum
      const { manifest, ...dataWithoutManifest } = exportData;
      const calculatedChecksum = createHash('sha256')
        .update(JSON.stringify(dataWithoutManifest))
        .digest('hex');

      if (calculatedChecksum !== exportData.manifest.checksum) {
        result.errors.push('Checksum verification failed - file may be corrupted');
        return result;
      }

      // Import configurations
      if (options.selectiveImport.configs && exportData.configs) {
        try {
          await this.importConfigs(exportData.configs, options.mergeStrategy);
          result.imported.configs = 1;
        } catch (error) {
          result.errors.push(`Failed to import configs: ${error}`);
          result.skipped.configs = 1;
        }
      }

      // Import sessions
      if (options.selectiveImport.sessions && exportData.sessions) {
        for (const session of exportData.sessions) {
          try {
            const existing = await this.sessionStore.getSession(session.metadata.id);
            
            if (existing && options.mergeStrategy === 'skip') {
              result.skipped.sessions++;
              continue;
            }

            await this.sessionStore.saveSession(session);
            result.imported.sessions++;
          } catch (error) {
            result.errors.push(`Failed to import session ${session.metadata.id}: ${error}`);
            result.skipped.sessions++;
          }
        }
      }

      // Import security settings
      if (options.selectiveImport.security && exportData.security) {
        try {
          await permissionManager.initialize();
          
          if (options.mergeStrategy === 'replace') {
            await permissionManager.setSecurityProfile(exportData.security.profile.name);
          }
          
          for (const rule of exportData.security.profile.rules) {
            await permissionManager.addCustomRule(rule);
            result.imported.securityRules++;
          }
        } catch (error) {
          result.errors.push(`Failed to import security settings: ${error}`);
        }
      }

      // Import MCP configuration
      if (options.selectiveImport.mcp && exportData.mcp) {
        try {
          const mcpConfigPath = join(this.echoDir, 'mcp.json');
          
          if (options.mergeStrategy === 'merge' && existsSync(mcpConfigPath)) {
            const existingData = await readFile(mcpConfigPath, 'utf8');
            const existingConfig = JSON.parse(existingData);
            const mergedConfig = { ...existingConfig, ...exportData.mcp };
            await writeFile(mcpConfigPath, JSON.stringify(mergedConfig, null, 2));
          } else {
            await writeFile(mcpConfigPath, JSON.stringify(exportData.mcp, null, 2));
          }
          
          result.imported.mcpServers = Object.keys(exportData.mcp.servers || {}).length;
        } catch (error) {
          result.errors.push(`Failed to import MCP configuration: ${error}`);
        }
      }

      result.success = result.errors.length === 0;
      return result;

    } catch (error) {
      result.errors.push(`Import failed: ${error}`);
      return result;
    }
  }

  private async exportConfigs(): Promise<ConfigExport> {
    const config = await this.configManager.getConfig();
    
    return {
      providers: config.providers,
      defaults: config.defaults,
      integrations: config.integrations,
      features: config.features,
      limits: config.limits || {},
      sound: config.sound || {},
    };
  }

  private async importConfigs(configs: ConfigExport, strategy: string): Promise<void> {
    const currentConfig = await this.configManager.getConfig();
    
    let newConfig;
    
    switch (strategy) {
      case 'replace':
        newConfig = {
          ...currentConfig,
          ...configs,
        };
        break;
      
      case 'merge':
        newConfig = {
          providers: { ...currentConfig.providers, ...configs.providers },
          defaults: { ...currentConfig.defaults, ...configs.defaults },
          integrations: { ...currentConfig.integrations, ...configs.integrations },
          features: { ...currentConfig.features, ...configs.features },
          limits: { ...currentConfig.limits, ...configs.limits },
          sound: { ...currentConfig.sound, ...configs.sound },
        };
        break;
      
      default: // skip
        return;
    }
    
    // Update config (ConfigManager needs an updateConfig method)
    const configPath = join(this.echoDir, 'config.json');
    await writeFile(configPath, JSON.stringify(newConfig, null, 2));
  }

  private convertToFormat(data: CompleteExport, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'yaml':
        return yaml.dump(data);
      
      case 'xml':
        return this.convertToXML(data);
      
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private parseFromFormat(content: string, format: string): CompleteExport {
    switch (format) {
      case 'json':
        return JSON.parse(content);
      
      case 'yaml':
        return yaml.load(content) as CompleteExport;
      
      case 'xml':
        return this.parseFromXML(content);
      
      default:
        return JSON.parse(content);
    }
  }

  private convertToXML(data: any, rootName = 'export'): string {
    const convertValue = (value: any, key: string): string => {
      if (value === null || value === undefined) {
        return `<${key}></${key}>`;
      }
      
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          return `<${key}>${value.map((item, index) => convertValue(item, 'item')).join('')}</${key}>`;
        } else {
          const innerXML = Object.entries(value)
            .map(([k, v]) => convertValue(v, k))
            .join('');
          return `<${key}>${innerXML}</${key}>`;
        }
      }
      
      return `<${key}>${String(value)}</${key}>`;
    };

    return `<?xml version="1.0" encoding="UTF-8"?>${convertValue(data, rootName)}`;
  }

  private parseFromXML(content: string): CompleteExport {
    // Simple XML parser - in production, use a proper XML parsing library
    throw new Error('XML import not implemented - use JSON or YAML format');
  }

  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(this.backupDir, `backup-${timestamp}`);
    
    await mkdir(backupPath, { recursive: true });
    
    // Copy entire .echo directory
    await cp(this.echoDir, backupPath, { 
      recursive: true,
      filter: (src) => !src.includes('backups') && !src.includes('exports')
    });
    
    return backupPath;
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      join(this.echoDir, 'exports'),
      this.backupDir,
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }
  }
}

// Install js-yaml package if not already installed
// npm install js-yaml @types/js-yaml