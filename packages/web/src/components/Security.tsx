import { createSignal, For } from "solid-js";
import style from "./Security.module.css";

interface Permission {
  operation: string;
  level: "allow" | "ask" | "deny";
  description: string;
}

interface SecurityProfile {
  name: string;
  description: string;
  permissions: Permission[];
  active: boolean;
}

export default function Security() {
  const [selectedProfile, setSelectedProfile] = createSignal("default");
  const [auditLogsVisible, setAuditLogsVisible] = createSignal(false);

  const securityProfiles: SecurityProfile[] = [
    {
      name: "default",
      description: "Balanced security for general use",
      active: true,
      permissions: [
        { operation: "file_read", level: "allow", description: "Read files from filesystem" },
        { operation: "file_write", level: "ask", description: "Write or modify files" },
        { operation: "file_delete", level: "ask", description: "Delete files" },
        { operation: "network_request", level: "allow", description: "Make network requests" },
        { operation: "code_execution", level: "ask", description: "Execute code or commands" },
        { operation: "system_info", level: "allow", description: "Access system information" }
      ]
    },
    {
      name: "strict",
      description: "Maximum security for sensitive environments",
      active: false,
      permissions: [
        { operation: "file_read", level: "ask", description: "Read files from filesystem" },
        { operation: "file_write", level: "deny", description: "Write or modify files" },
        { operation: "file_delete", level: "deny", description: "Delete files" },
        { operation: "network_request", level: "ask", description: "Make network requests" },
        { operation: "code_execution", level: "deny", description: "Execute code or commands" },
        { operation: "system_info", level: "ask", description: "Access system information" }
      ]
    },
    {
      name: "permissive",
      description: "Minimal restrictions for development",
      active: false,
      permissions: [
        { operation: "file_read", level: "allow", description: "Read files from filesystem" },
        { operation: "file_write", level: "allow", description: "Write or modify files" },
        { operation: "file_delete", level: "ask", description: "Delete files" },
        { operation: "network_request", level: "allow", description: "Make network requests" },
        { operation: "code_execution", level: "allow", description: "Execute code or commands" },
        { operation: "system_info", level: "allow", description: "Access system information" }
      ]
    }
  ];

  const auditLogs = [
    {
      timestamp: "2024-01-15T14:30:22Z",
      operation: "file_write",
      resource: "/home/user/project/config.json",
      action: "granted",
      user_response: "allow"
    },
    {
      timestamp: "2024-01-15T14:28:15Z",
      operation: "code_execution",
      resource: "npm install",
      action: "granted",
      user_response: "allow"
    },
    {
      timestamp: "2024-01-15T14:25:03Z",
      operation: "network_request",
      resource: "https://api.models.dev",
      action: "granted",
      user_response: "auto"
    },
    {
      timestamp: "2024-01-15T14:20:45Z",
      operation: "file_delete",
      resource: "/tmp/cache.tmp",
      action: "denied",
      user_response: "deny"
    }
  ];

  const currentProfile = () => {
    return securityProfiles.find(p => p.name === selectedProfile()) || securityProfiles[0];
  };

  const updatePermission = (operation: string, newLevel: Permission["level"]) => {
    // In a real implementation, this would update the backend
    alert(`Updated ${operation} permission to ${newLevel}`);
  };

  const activateProfile = (profileName: string) => {
    setSelectedProfile(profileName);
    alert(`Activated security profile: ${profileName}`);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "granted": return style.granted;
      case "denied": return style.denied;
      default: return "";
    }
  };

  return (
    <div class={style.container}>
      <div class={style.sidebar}>
        <div class={style.sidebarHeader}>
          <h2>Echo AI</h2>
          <nav class={style.nav}>
            <a href="/dashboard" class={style.navItem}>Dashboard</a>
            <a href="/models" class={style.navItem}>Models</a>
            <a href="/sessions" class={style.navItem}>Sessions</a>
            <a href="/analytics" class={style.navItem}>Analytics</a>
            <a href="/security" class={`${style.navItem} ${style.active}`}>Security</a>
            <a href="/settings" class={style.navItem}>Settings</a>
          </nav>
        </div>
      </div>

      <div class={style.main}>
        <div class={style.header}>
          <h1>Security Center</h1>
          <p>Manage permissions and security policies</p>
        </div>

        <div class={style.content}>
          <div class={style.section}>
            <div class={style.sectionHeader}>
              <h2>Security Profiles</h2>
              <p>Choose a pre-configured security level or customize individual permissions</p>
            </div>

            <div class={style.profileGrid}>
              <For each={securityProfiles}>
                {(profile) => (
                  <div 
                    class={`${style.profileCard} ${profile.name === selectedProfile() ? style.active : ""}`}
                    onClick={() => setSelectedProfile(profile.name)}
                  >
                    <div class={style.profileHeader}>
                      <h3>{profile.name}</h3>
                      {profile.active && <span class={style.activeBadge}>ACTIVE</span>}
                    </div>
                    <p class={style.profileDescription}>{profile.description}</p>
                    <div class={style.profileActions}>
                      {profile.name !== selectedProfile() && (
                        <button 
                          class={style.activateButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            activateProfile(profile.name);
                          }}
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div class={style.section}>
            <div class={style.sectionHeader}>
              <h2>Permission Settings</h2>
              <p>Configure individual operation permissions for the {currentProfile().name} profile</p>
            </div>

            <div class={style.permissionsTable}>
              <div class={style.tableHeader}>
                <div>Operation</div>
                <div>Permission Level</div>
                <div>Description</div>
              </div>
              <For each={currentProfile().permissions}>
                {(permission) => (
                  <div class={style.permissionRow}>
                    <div class={style.operationName}>
                      {permission.operation.replace('_', ' ')}
                    </div>
                    <div class={style.permissionSelector}>
                      <select
                        value={permission.level}
                        onChange={(e) => updatePermission(permission.operation, e.currentTarget.value as Permission["level"])}
                        class={style.select}
                      >
                        <option value="allow">Allow</option>
                        <option value="ask">Ask</option>
                        <option value="deny">Deny</option>
                      </select>
                    </div>
                    <div class={style.permissionDescription}>
                      {permission.description}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div class={style.section}>
            <div class={style.sectionHeader}>
              <h2>Security Features</h2>
              <p>Additional security options and monitoring</p>
            </div>

            <div class={style.featuresGrid}>
              <div class={style.featureCard}>
                <div class={style.featureHeader}>
                  <h3>🔒 Session Encryption</h3>
                </div>
                <p>All session data is encrypted at rest using AES-256</p>
                <div class={style.featureStatus}>
                  <span class={style.enabled}>Enabled</span>
                </div>
              </div>

              <div class={style.featureCard}>
                <div class={style.featureHeader}>
                  <h3>🛡️ API Key Protection</h3>
                </div>
                <p>API keys are stored securely and never logged</p>
                <div class={style.featureStatus}>
                  <span class={style.enabled}>Enabled</span>
                </div>
              </div>

              <div class={style.featureCard}>
                <div class={style.featureHeader}>
                  <h3>📊 Audit Logging</h3>
                </div>
                <p>Track all security-related operations and decisions</p>
                <div class={style.featureStatus}>
                  <span class={style.enabled}>Enabled</span>
                  <button 
                    class={style.viewLogsButton}
                    onClick={() => setAuditLogsVisible(!auditLogsVisible())}
                  >
                    View Logs
                  </button>
                </div>
              </div>
            </div>
          </div>

          {auditLogsVisible() && (
            <div class={style.section}>
              <div class={style.sectionHeader}>
                <h2>Audit Logs</h2>
                <p>Recent security-related activities</p>
              </div>

              <div class={style.auditLogs}>
                <div class={style.logHeader}>
                  <div>Timestamp</div>
                  <div>Operation</div>
                  <div>Resource</div>
                  <div>Action</div>
                  <div>User Response</div>
                </div>
                <For each={auditLogs}>
                  {(log) => (
                    <div class={style.logRow}>
                      <div class={style.timestamp}>
                        {formatTimestamp(log.timestamp)}
                      </div>
                      <div class={style.operation}>
                        {log.operation}
                      </div>
                      <div class={style.resource}>
                        {log.resource}
                      </div>
                      <div class={`${style.action} ${getActionColor(log.action)}`}>
                        {log.action}
                      </div>
                      <div class={style.userResponse}>
                        {log.user_response}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}