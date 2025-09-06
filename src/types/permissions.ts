export type PermissionLevel = 'allow' | 'ask' | 'deny';

export interface PermissionConfig {
  bash: PermissionLevel;
  fileRead: PermissionLevel;
  fileWrite: PermissionLevel;
  fileEdit: PermissionLevel;
  webFetch: PermissionLevel;
  networkAccess: PermissionLevel;
  systemInfo: PermissionLevel;
  processManagement: PermissionLevel;
  environmentAccess: PermissionLevel;
}

export interface PermissionRequest {
  id: string;
  type: keyof PermissionConfig;
  action: string;
  details: {
    command?: string;
    filePath?: string;
    url?: string;
    processName?: string;
    envVar?: string;
    [key: string]: any;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requestedAt: Date;
  context?: string;
}

export interface PermissionResponse {
  requestId: string;
  granted: boolean;
  remember?: boolean;
  customRule?: PermissionRule;
}

export interface PermissionRule {
  id: string;
  type: keyof PermissionConfig;
  pattern: string;
  action: 'allow' | 'deny';
  description: string;
  createdAt: Date;
  usageCount: number;
  lastUsed?: Date;
}

export interface SecurityProfile {
  name: string;
  description: string;
  permissions: PermissionConfig;
  rules: PermissionRule[];
  isDefault: boolean;
}

export interface PermissionAuditEntry {
  id: string;
  requestId: string;
  type: keyof PermissionConfig;
  action: string;
  granted: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  sessionId?: string;
  details: Record<string, any>;
}