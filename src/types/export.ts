export interface ExportOptions {
  format: 'json' | 'yaml' | 'toml' | 'xml';
  includeConfigs: boolean;
  includeSessions: boolean;
  includeAnalytics: boolean;
  includeSecurity: boolean;
  includeMCP: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
  compress: boolean;
  encrypt: boolean;
  password?: string;
}

export interface ImportOptions {
  format: 'json' | 'yaml' | 'toml' | 'xml';
  mergeStrategy: 'replace' | 'merge' | 'skip';
  selectiveImport: {
    configs?: boolean;
    sessions?: boolean;
    analytics?: boolean;
    security?: boolean;
    mcp?: boolean;
  };
  password?: string;
  backup: boolean;
}

export interface ExportManifest {
  version: string;
  exportDate: Date;
  exportedBy: string;
  format: string;
  compressed: boolean;
  encrypted: boolean;
  contents: {
    configs: boolean;
    sessions: boolean;
    analytics: boolean;
    security: boolean;
    mcp: boolean;
  };
  sessionCount?: number;
  dateRange?: {
    from: Date;
    to: Date;
  };
  checksum: string;
}

export interface ConfigExport {
  providers: Record<string, any>;
  defaults: Record<string, any>;
  integrations: Record<string, any>;
  features: Record<string, any>;
  limits: Record<string, any>;
  sound: Record<string, any>;
}

export interface CompleteExport {
  manifest: ExportManifest;
  configs?: ConfigExport;
  sessions?: any[];
  analytics?: any;
  security?: any;
  mcp?: any;
}

export interface ImportResult {
  success: boolean;
  imported: {
    configs: number;
    sessions: number;
    analyticsEntries: number;
    securityRules: number;
    mcpServers: number;
  };
  skipped: {
    configs: number;
    sessions: number;
    analyticsEntries: number;
    securityRules: number;
    mcpServers: number;
  };
  errors: string[];
  backupPath?: string;
}