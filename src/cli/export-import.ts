import { Command } from 'commander';
import { ExportManager } from '../data/export-manager.js';
import { ExportOptions, ImportOptions } from '../types/export.js';
import inquirer from 'inquirer';

const exportManager = new ExportManager();

export const exportImportCommand = new Command()
  .name('data')
  .description('Export and import Echo AI data');

const exportCommand = new Command()
  .name('export')
  .description('Export Echo AI data')
  .option('-f, --format <format>', 'Export format (json, yaml, xml)', 'json')
  .option('-o, --output <file>', 'Output file path (optional)')
  .option('--configs', 'Include configuration data', false)
  .option('--sessions', 'Include session data', false)
  .option('--analytics', 'Include analytics data', false)
  .option('--security', 'Include security settings', false)
  .option('--mcp', 'Include MCP configuration', false)
  .option('--all', 'Include all data types', false)
  .option('--from <date>', 'Start date for data range (YYYY-MM-DD)')
  .option('--to <date>', 'End date for data range (YYYY-MM-DD)')
  .option('--compress', 'Compress export file', false)
  .option('--encrypt', 'Encrypt export file', false)
  .option('--interactive', 'Interactive export configuration', false)
  .action(async (options) => {
    let exportOptions: ExportOptions;

    if (options.interactive) {
      exportOptions = await configureExportInteractively();
    } else {
      exportOptions = {
        format: options.format,
        includeConfigs: options.all || options.configs,
        includeSessions: options.all || options.sessions,
        includeAnalytics: options.all || options.analytics,
        includeSecurity: options.all || options.security,
        includeMCP: options.all || options.mcp,
        compress: options.compress,
        encrypt: options.encrypt,
      };

      if (options.from || options.to) {
        exportOptions.dateRange = {
          from: options.from ? new Date(options.from) : new Date('1970-01-01'),
          to: options.to ? new Date(options.to) : new Date(),
        };
      }

      if (options.encrypt) {
        const { password } = await inquirer.prompt([{
          type: 'password',
          name: 'password',
          message: 'Enter encryption password:',
          mask: '*',
        }]);
        exportOptions.password = password;
      }
    }

    // Validate that at least one data type is selected
    if (!exportOptions.includeConfigs && !exportOptions.includeSessions && 
        !exportOptions.includeAnalytics && !exportOptions.includeSecurity && 
        !exportOptions.includeMCP) {
      console.log('⚠️  No data types selected for export. Use --all or specify individual types.');
      console.log('Available options: --configs, --sessions, --analytics, --security, --mcp');
      return;
    }

    try {
      console.log('🔄 Exporting data...');
      const exportPath = await exportManager.exportData(exportOptions);
      
      console.log('✅ Export completed successfully!');
      console.log(`📁 File saved to: ${exportPath}`);
      
      // Show export summary
      const included = [];
      if (exportOptions.includeConfigs) included.push('configs');
      if (exportOptions.includeSessions) included.push('sessions');
      if (exportOptions.includeAnalytics) included.push('analytics');
      if (exportOptions.includeSecurity) included.push('security');
      if (exportOptions.includeMCP) included.push('MCP');
      
      console.log(`📊 Included: ${included.join(', ')}`);
      console.log(`📄 Format: ${exportOptions.format}`);
      
      if (exportOptions.compress) console.log('🗜️  Compressed: Yes');
      if (exportOptions.encrypt) console.log('🔐 Encrypted: Yes');

    } catch (error) {
      console.error('❌ Export failed:', error);
      process.exit(1);
    }
  });

const importCommand = new Command()
  .name('import')
  .description('Import Echo AI data')
  .argument('<file>', 'Import file path')
  .option('-f, --format <format>', 'Import format (json, yaml, xml)', 'json')
  .option('-s, --strategy <strategy>', 'Merge strategy (replace, merge, skip)', 'merge')
  .option('--configs', 'Import configuration data', false)
  .option('--sessions', 'Import session data', false)
  .option('--analytics', 'Import analytics data', false)
  .option('--security', 'Import security settings', false)
  .option('--mcp', 'Import MCP configuration', false)
  .option('--all', 'Import all data types', false)
  .option('--no-backup', 'Skip creating backup before import')
  .option('--interactive', 'Interactive import configuration', false)
  .action(async (file, options) => {
    let importOptions: ImportOptions;

    if (options.interactive) {
      importOptions = await configureImportInteractively(options.strategy);
    } else {
      importOptions = {
        format: options.format,
        mergeStrategy: options.strategy,
        selectiveImport: {
          configs: options.all || options.configs,
          sessions: options.all || options.sessions,
          analytics: options.all || options.analytics,
          security: options.all || options.security,
          mcp: options.all || options.mcp,
        },
        backup: options.backup,
      };
    }

    // Check if password is needed
    if (file.includes('encrypted') || options.interactive) {
      const { needPassword } = await inquirer.prompt([{
        type: 'confirm',
        name: 'needPassword',
        message: 'Is this file encrypted?',
        default: false,
      }]);

      if (needPassword) {
        const { password } = await inquirer.prompt([{
          type: 'password',
          name: 'password',
          message: 'Enter decryption password:',
          mask: '*',
        }]);
        importOptions.password = password;
      }
    }

    // Confirm import
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: `Import data from ${file}? ${importOptions.backup ? '(Backup will be created)' : '(No backup will be created)'}`,
      default: true,
    }]);

    if (!confirmed) {
      console.log('Import cancelled.');
      return;
    }

    try {
      console.log('🔄 Importing data...');
      const result = await exportManager.importData(file, importOptions);

      if (result.success) {
        console.log('✅ Import completed successfully!');
      } else {
        console.log('⚠️  Import completed with errors.');
      }

      // Show import summary
      console.log('\n📊 Import Summary:');
      console.log(`  Configs: ${result.imported.configs} imported, ${result.skipped.configs} skipped`);
      console.log(`  Sessions: ${result.imported.sessions} imported, ${result.skipped.sessions} skipped`);
      console.log(`  Analytics: ${result.imported.analyticsEntries} imported, ${result.skipped.analyticsEntries} skipped`);
      console.log(`  Security Rules: ${result.imported.securityRules} imported, ${result.skipped.securityRules} skipped`);
      console.log(`  MCP Servers: ${result.imported.mcpServers} imported, ${result.skipped.mcpServers} skipped`);

      if (result.backupPath) {
        console.log(`\n💾 Backup created at: ${result.backupPath}`);
      }

      if (result.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }

    } catch (error) {
      console.error('❌ Import failed:', error);
      process.exit(1);
    }
  });

async function configureExportInteractively(): Promise<ExportOptions> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'format',
      message: 'Export format:',
      choices: ['json', 'yaml', 'xml'],
      default: 'json',
    },
    {
      type: 'checkbox',
      name: 'dataTypes',
      message: 'Select data to export:',
      choices: [
        { name: 'Configurations', value: 'configs' },
        { name: 'Sessions', value: 'sessions' },
        { name: 'Analytics', value: 'analytics' },
        { name: 'Security Settings', value: 'security' },
        { name: 'MCP Configuration', value: 'mcp' },
      ],
      validate: (input) => input.length > 0 || 'Please select at least one data type',
    },
    {
      type: 'confirm',
      name: 'dateRange',
      message: 'Limit export to specific date range?',
      default: false,
    },
    {
      type: 'input',
      name: 'fromDate',
      message: 'From date (YYYY-MM-DD):',
      when: (answers) => answers.dateRange,
      validate: (input) => {
        const date = new Date(input);
        return !isNaN(date.getTime()) || 'Invalid date format';
      },
    },
    {
      type: 'input',
      name: 'toDate',
      message: 'To date (YYYY-MM-DD):',
      when: (answers) => answers.dateRange,
      default: () => new Date().toISOString().split('T')[0],
      validate: (input) => {
        const date = new Date(input);
        return !isNaN(date.getTime()) || 'Invalid date format';
      },
    },
    {
      type: 'confirm',
      name: 'compress',
      message: 'Compress export file?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'encrypt',
      message: 'Encrypt export file?',
      default: false,
    },
    {
      type: 'password',
      name: 'password',
      message: 'Enter encryption password:',
      when: (answers) => answers.encrypt,
      mask: '*',
    },
  ]);

  return {
    format: answers.format,
    includeConfigs: answers.dataTypes.includes('configs'),
    includeSessions: answers.dataTypes.includes('sessions'),
    includeAnalytics: answers.dataTypes.includes('analytics'),
    includeSecurity: answers.dataTypes.includes('security'),
    includeMCP: answers.dataTypes.includes('mcp'),
    dateRange: answers.dateRange ? {
      from: new Date(answers.fromDate),
      to: new Date(answers.toDate),
    } : undefined,
    compress: answers.compress,
    encrypt: answers.encrypt,
    password: answers.password,
  };
}

async function configureImportInteractively(defaultStrategy: string): Promise<ImportOptions> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'format',
      message: 'Import format:',
      choices: ['json', 'yaml', 'xml'],
      default: 'json',
    },
    {
      type: 'list',
      name: 'strategy',
      message: 'Merge strategy for existing data:',
      choices: [
        { name: 'Merge (combine with existing)', value: 'merge' },
        { name: 'Replace (overwrite existing)', value: 'replace' },
        { name: 'Skip (keep existing)', value: 'skip' },
      ],
      default: defaultStrategy,
    },
    {
      type: 'checkbox',
      name: 'dataTypes',
      message: 'Select data to import:',
      choices: [
        { name: 'Configurations', value: 'configs' },
        { name: 'Sessions', value: 'sessions' },
        { name: 'Analytics', value: 'analytics' },
        { name: 'Security Settings', value: 'security' },
        { name: 'MCP Configuration', value: 'mcp' },
      ],
    },
    {
      type: 'confirm',
      name: 'backup',
      message: 'Create backup before import?',
      default: true,
    },
  ]);

  return {
    format: answers.format,
    mergeStrategy: answers.strategy,
    selectiveImport: {
      configs: answers.dataTypes.includes('configs'),
      sessions: answers.dataTypes.includes('sessions'),
      analytics: answers.dataTypes.includes('analytics'),
      security: answers.dataTypes.includes('security'),
      mcp: answers.dataTypes.includes('mcp'),
    },
    backup: answers.backup,
  };
}

exportImportCommand.addCommand(exportCommand);
exportImportCommand.addCommand(importCommand);