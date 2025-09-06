import { Command } from 'commander';
import { analyticsTracker } from '../analytics/tracker.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export const analyticsCommand = new Command()
  .name('analytics')
  .description('View usage analytics and statistics')
  .hook('preAction', async () => {
    await analyticsTracker.initialize();
  });

analyticsCommand
  .command('overview')
  .description('Show analytics overview')
  .option('-d, --days <days>', 'Number of days to analyze', parseInt, 7)
  .action(async (options) => {
    const providerMetrics = await analyticsTracker.getProviderMetrics(options.days);
    const toolStats = await analyticsTracker.getToolUsageStats(options.days);
    const costAnalysis = await analyticsTracker.getCostAnalysis();

    console.log(`\n📊 Analytics Overview (Last ${options.days} days)\n`);

    // Provider metrics
    const providers = Object.keys(providerMetrics);
    if (providers.length > 0) {
      console.log('🤖 Provider Usage:');
      providers.forEach(provider => {
        const metrics = providerMetrics[provider];
        if (metrics) {
          console.log(`  ${provider}:`);
          console.log(`    Tokens: ${metrics.usage.totalTokens.toLocaleString()}`);
          console.log(`    Requests: ${metrics.usage.requestCount}`);
          console.log(`    Cost: $${metrics.usage.totalCost.toFixed(4)}`);
          console.log(`    Success Rate: ${metrics.successRate.toFixed(1)}%`);
        }
      });
      console.log();
    }

    // Tool usage
    const tools = Object.entries(toolStats).sort(([,a], [,b]) => b.callCount - a.callCount);
    if (tools.length > 0) {
      console.log('🔧 Tool Usage (Top 10):');
      tools.slice(0, 10).forEach(([tool, stats]) => {
        const successRate = ((stats.successCount / stats.callCount) * 100).toFixed(1);
        console.log(`  ${tool}: ${stats.callCount} calls (${successRate}% success)`);
      });
      console.log();
    }

    // Cost analysis
    console.log('💰 Cost Analysis:');
    console.log(`  This Month: $${costAnalysis.currentMonth.total.toFixed(4)}`);
    console.log(`  Projected: $${costAnalysis.projectedMonth.total.toFixed(4)}`);
    
    if (Object.keys(costAnalysis.currentMonth.byProvider).length > 0) {
      console.log('  By Provider:');
      Object.entries(costAnalysis.currentMonth.byProvider)
        .sort(([,a], [,b]) => b - a)
        .forEach(([provider, cost]) => {
          console.log(`    ${provider}: $${cost.toFixed(4)}`);
        });
    }

    console.log();
  });

analyticsCommand
  .command('daily')
  .description('Show daily statistics')
  .option('-d, --date <date>', 'Specific date (YYYY-MM-DD)')
  .action(async (options) => {
    const date = options.date ? new Date(options.date) : new Date();
    const dailyStats = await analyticsTracker.getDailyStats(date);

    if (!dailyStats) {
      console.log(`No data available for ${date.toISOString().split('T')[0]}`);
      return;
    }

    console.log(`\n📅 Daily Statistics - ${dailyStats.date}\n`);
    console.log(`Sessions: ${dailyStats.sessions}`);
    console.log(`Messages: ${dailyStats.messages}`);
    console.log(`Tokens: ${dailyStats.tokens.toLocaleString()}`);
    console.log(`Cost: $${dailyStats.cost.toFixed(4)}`);

    if (Object.keys(dailyStats.providers).length > 0) {
      console.log('\nProviders Used:');
      Object.entries(dailyStats.providers)
        .sort(([,a], [,b]) => b - a)
        .forEach(([provider, count]) => {
          console.log(`  ${provider}: ${count} sessions`);
        });
    }

    if (Object.keys(dailyStats.tools).length > 0) {
      console.log('\nTools Used:');
      Object.entries(dailyStats.tools)
        .sort(([,a], [,b]) => b - a)
        .forEach(([tool, count]) => {
          console.log(`  ${tool}: ${count} calls`);
        });
    }
  });

analyticsCommand
  .command('costs')
  .description('Detailed cost analysis')
  .action(async () => {
    const costAnalysis = await analyticsTracker.getCostAnalysis();

    console.log('\n💰 Cost Analysis\n');

    console.log('Current Month:');
    console.log(`  Total Spent: $${costAnalysis.currentMonth.total.toFixed(4)}`);
    console.log(`  Projected Total: $${costAnalysis.projectedMonth.total.toFixed(4)}`);
    console.log(`  Based on ${costAnalysis.projectedMonth.basedOnDays} days of data`);

    if (Object.keys(costAnalysis.currentMonth.byProvider).length > 0) {
      console.log('\nCost by Provider:');
      Object.entries(costAnalysis.currentMonth.byProvider)
        .sort(([,a], [,b]) => b - a)
        .forEach(([provider, cost]) => {
          const percentage = ((cost / costAnalysis.currentMonth.total) * 100).toFixed(1);
          console.log(`  ${provider}: $${cost.toFixed(4)} (${percentage}%)`);
        });
    }

    if (costAnalysis.currentMonth.dailyTrends.length > 0) {
      console.log('\nDaily Spending (Last 7 days):');
      costAnalysis.currentMonth.dailyTrends
        .slice(-7)
        .forEach(({ date, cost }) => {
          const bar = '█'.repeat(Math.floor(cost * 20 / Math.max(...costAnalysis.currentMonth.dailyTrends.map(d => d.cost))));
          console.log(`  ${date}: $${cost.toFixed(4)} ${bar}`);
        });
    }

    // Alerts
    const alerts = [];
    if (costAnalysis.alerts.nearLimit) alerts.push('🟡 Near spending limit');
    if (costAnalysis.alerts.overBudget) alerts.push('🔴 Over budget');
    if (costAnalysis.alerts.unusualSpike) alerts.push('🟠 Unusual spending spike detected');

    if (alerts.length > 0) {
      console.log('\nAlerts:');
      alerts.forEach(alert => console.log(`  ${alert}`));
    }
  });

analyticsCommand
  .command('tools')
  .description('Tool usage statistics')
  .option('-d, --days <days>', 'Number of days to analyze', parseInt, 30)
  .action(async (options) => {
    const toolStats = await analyticsTracker.getToolUsageStats(options.days);
    const sortedTools = Object.entries(toolStats)
      .sort(([,a], [,b]) => b.callCount - a.callCount);

    if (sortedTools.length === 0) {
      console.log('No tool usage data available.');
      return;
    }

    console.log(`\n🔧 Tool Usage Statistics (Last ${options.days} days)\n`);

    sortedTools.forEach(([tool, stats], index) => {
      const successRate = ((stats.successCount / stats.callCount) * 100).toFixed(1);
      const avgTime = stats.averageExecutionTime.toFixed(0);
      
      console.log(`${index + 1}. ${tool}`);
      console.log(`   Calls: ${stats.callCount}`);
      console.log(`   Success Rate: ${successRate}%`);
      console.log(`   Avg Execution Time: ${avgTime}ms`);
      console.log(`   Last Used: ${stats.lastUsed.toLocaleString()}\n`);
    });
  });

analyticsCommand
  .command('export')
  .description('Export analytics data')
  .option('-f, --format <format>', 'Export format (json, csv)', 'json')
  .option('-d, --days <days>', 'Number of days to export', parseInt, 30)
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      const data = await analyticsTracker.exportData(options.format, options.days);
      const filename = options.output || `analytics-export-${new Date().toISOString().split('T')[0]}.${options.format}`;
      
      await writeFile(filename, data);
      console.log(`✅ Analytics data exported to ${filename}`);
      
      // Show summary
      const lines = data.split('\n').length;
      console.log(`Export contains ${lines} ${options.format === 'json' ? 'entries' : 'lines'} covering ${options.days} days`);
    } catch (error) {
      console.error('❌ Failed to export analytics data:', error);
      process.exit(1);
    }
  });

analyticsCommand
  .command('config')
  .description('Manage analytics configuration')
  .option('--enable', 'Enable analytics tracking')
  .option('--disable', 'Disable analytics tracking')
  .option('--level <level>', 'Set tracking level (basic, detailed, comprehensive)')
  .option('--retention <days>', 'Set data retention days', parseInt)
  .option('--anonymize', 'Enable data anonymization')
  .option('--no-anonymize', 'Disable data anonymization')
  .action(async (options) => {
    const currentConfig = await analyticsTracker.getConfig();

    if (Object.keys(options).length === 0) {
      console.log('\n⚙️  Analytics Configuration:\n');
      console.log(`Tracking Enabled: ${currentConfig.enableTracking ? '✅' : '❌'}`);
      console.log(`Tracking Level: ${currentConfig.trackingLevel}`);
      console.log(`Retention Days: ${currentConfig.retentionDays}`);
      console.log(`Anonymize Data: ${currentConfig.anonymizeData ? '✅' : '❌'}`);
      console.log(`Track Performance: ${currentConfig.trackPerformance ? '✅' : '❌'}`);
      console.log(`Track Costs: ${currentConfig.trackCosts ? '✅' : '❌'}`);
      return;
    }

    const updates: any = {};

    if (options.enable) updates.enableTracking = true;
    if (options.disable) updates.enableTracking = false;
    if (options.level) {
      if (['basic', 'detailed', 'comprehensive'].includes(options.level)) {
        updates.trackingLevel = options.level;
      } else {
        console.error('❌ Invalid tracking level. Use: basic, detailed, or comprehensive');
        process.exit(1);
      }
    }
    if (options.retention) updates.retentionDays = options.retention;
    if (options.anonymize !== undefined) updates.anonymizeData = options.anonymize;

    try {
      await analyticsTracker.updateConfig(updates);
      console.log('✅ Analytics configuration updated successfully!');
      
      const newConfig = await analyticsTracker.getConfig();
      console.log('\nUpdated configuration:');
      Object.entries(updates).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    } catch (error) {
      console.error('❌ Failed to update configuration:', error);
      process.exit(1);
    }
  });