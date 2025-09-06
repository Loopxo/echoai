import { Command } from 'commander';
import { permissionManager } from '../security/permission-manager.js';
import { PermissionRule } from '../types/permissions.js';

export const securityCommand = new Command()
  .name('security')
  .description('Manage security settings and permissions')
  .hook('preAction', async () => {
    await permissionManager.initialize();
  });

securityCommand
  .command('profile')
  .description('Manage security profiles')
  .argument('[profile]', 'Security profile to set (default, strict, permissive)')
  .action(async (profile) => {
    if (!profile) {
      const current = permissionManager.getCurrentProfile();
      const available = permissionManager.getAvailableProfiles();
      
      console.log(`\nCurrent Profile: ${current.name}`);
      console.log(`Description: ${current.description}`);
      console.log(`\nAvailable Profiles: ${available.join(', ')}`);
      
      console.log('\nCurrent Permissions:');
      Object.entries(current.permissions).forEach(([type, level]) => {
        const emoji = level === 'allow' ? '✅' : level === 'deny' ? '❌' : '❓';
        console.log(`  ${emoji} ${type}: ${level}`);
      });
      
      return;
    }

    try {
      await permissionManager.setSecurityProfile(profile);
      console.log(`✅ Security profile set to: ${profile}`);
    } catch (error) {
      console.error(`❌ Failed to set security profile:`, error);
      process.exit(1);
    }
  });

securityCommand
  .command('rules')
  .description('Manage permission rules')
  .action(async () => {
    const profile = permissionManager.getCurrentProfile();
    
    if (profile.rules.length === 0) {
      console.log('No custom permission rules configured.');
      return;
    }

    console.log(`\nPermission Rules (${profile.rules.length}):\n`);
    
    profile.rules.forEach((rule, index) => {
      const emoji = rule.action === 'allow' ? '✅' : '❌';
      const usageInfo = rule.usageCount > 0 
        ? ` (used ${rule.usageCount} times${rule.lastUsed ? `, last: ${rule.lastUsed.toLocaleString()}` : ''})`
        : ' (never used)';
      
      console.log(`${index + 1}. ${emoji} ${rule.type}: ${rule.description}`);
      console.log(`   Pattern: ${rule.pattern}`);
      console.log(`   Created: ${rule.createdAt.toLocaleString()}${usageInfo}`);
      console.log(`   ID: ${rule.id}\n`);
    });
  });

securityCommand
  .command('add-rule')
  .description('Add a custom permission rule')
  .requiredOption('-t, --type <type>', 'Permission type (bash, fileRead, fileWrite, etc.)')
  .requiredOption('-p, --pattern <pattern>', 'Regex pattern to match')
  .requiredOption('-a, --action <action>', 'Action to take (allow or deny)')
  .option('-d, --description <description>', 'Rule description')
  .action(async (options) => {
    const validTypes = [
      'bash', 'fileRead', 'fileWrite', 'fileEdit', 'webFetch',
      'networkAccess', 'systemInfo', 'processManagement', 'environmentAccess'
    ];

    if (!validTypes.includes(options.type)) {
      console.error(`❌ Invalid permission type. Valid types: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    if (!['allow', 'deny'].includes(options.action)) {
      console.error('❌ Invalid action. Must be "allow" or "deny".');
      process.exit(1);
    }

    try {
      // Test the regex pattern
      new RegExp(options.pattern);
    } catch (error) {
      console.error('❌ Invalid regex pattern:', error);
      process.exit(1);
    }

    const rule = {
      type: options.type,
      pattern: options.pattern,
      action: options.action,
      description: options.description || `Custom rule for ${options.type}`,
    };

    try {
      await permissionManager.addCustomRule(rule);
      console.log('✅ Permission rule added successfully!');
      console.log(`   Type: ${rule.type}`);
      console.log(`   Pattern: ${rule.pattern}`);
      console.log(`   Action: ${rule.action}`);
      console.log(`   Description: ${rule.description}`);
    } catch (error) {
      console.error('❌ Failed to add permission rule:', error);
      process.exit(1);
    }
  });

securityCommand
  .command('remove-rule')
  .description('Remove a permission rule')
  .argument('<rule-id>', 'Rule ID to remove')
  .action(async (ruleId) => {
    try {
      const removed = await permissionManager.removeRule(ruleId);
      
      if (removed) {
        console.log(`✅ Permission rule ${ruleId} removed successfully!`);
      } else {
        console.error(`❌ Permission rule ${ruleId} not found.`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to remove permission rule:', error);
      process.exit(1);
    }
  });

securityCommand
  .command('audit')
  .description('View security audit log')
  .option('-l, --limit <number>', 'Limit number of entries to show', parseInt)
  .option('--stats', 'Show audit statistics')
  .action(async (options) => {
    if (options.stats) {
      const stats = permissionManager.getSecurityStats();
      
      console.log('\n📊 Security Statistics:');
      console.log(`Total Requests: ${stats.totalRequests}`);
      console.log(`Granted: ${stats.grantedCount} (${((stats.grantedCount / stats.totalRequests) * 100 || 0).toFixed(1)}%)`);
      console.log(`Denied: ${stats.deniedCount} (${((stats.deniedCount / stats.totalRequests) * 100 || 0).toFixed(1)}%)`);
      
      if (Object.keys(stats.riskBreakdown).length > 0) {
        console.log('\nRisk Level Breakdown:');
        Object.entries(stats.riskBreakdown)
          .sort(([,a], [,b]) => b - a)
          .forEach(([risk, count]) => {
            const emoji = risk === 'low' ? '🟢' : risk === 'medium' ? '🟡' : risk === 'high' ? '🟠' : '🔴';
            console.log(`  ${emoji} ${risk}: ${count} requests`);
          });
      }

      if (Object.keys(stats.typeBreakdown).length > 0) {
        console.log('\nPermission Type Breakdown:');
        Object.entries(stats.typeBreakdown)
          .sort(([,a], [,b]) => b - a)
          .forEach(([type, count]) => {
            console.log(`  ${type}: ${count} requests`);
          });
      }

      return;
    }

    const auditLog = permissionManager.getAuditLog(options.limit);
    
    if (auditLog.length === 0) {
      console.log('No security audit entries found.');
      return;
    }

    console.log(`\nSecurity Audit Log (${auditLog.length} entries):\n`);
    
    auditLog.reverse().forEach((entry, index) => {
      const statusEmoji = entry.granted ? '✅' : '❌';
      const riskEmoji = entry.riskLevel === 'low' ? '🟢' : 
                       entry.riskLevel === 'medium' ? '🟡' : 
                       entry.riskLevel === 'high' ? '🟠' : '🔴';
      
      console.log(`${index + 1}. ${statusEmoji} ${riskEmoji} ${entry.type}: ${entry.action}`);
      console.log(`   Risk: ${entry.riskLevel} | Time: ${entry.timestamp.toLocaleString()}`);
      
      if (Object.keys(entry.details).length > 0) {
        console.log(`   Details: ${JSON.stringify(entry.details, null, 2).slice(0, 100)}...`);
      }
      
      console.log(`   ID: ${entry.id}\n`);
    });
  });