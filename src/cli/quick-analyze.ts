#!/usr/bin/env node

import { intelligentCodebaseAnalysis, generateCodebaseOverview } from '../utils/intelligent-codebase-analyzer.js';
import { getProjectContext } from '../utils/project-context.js';
import { ensureWorkflowSession, getWorkflowKernel } from '../runtime/workflow-session.js';

export async function quickAnalyzeCommand(options: { session?: string } = {}): Promise<void> {
  console.log('🔮 Echo AI - Quick Codebase Analysis\n');
  
  try {
    const kernel = getWorkflowKernel();
    const session = await ensureWorkflowSession('Repository Analysis', options.session);
    const task = await kernel.addTask(session.id, {
      kind: 'workflow',
      title: 'Repository analysis',
      status: 'running',
      detail: 'Analyzing repository structure and generating overview',
      metadata: {
        workflow: 'analyze',
      },
    });

    const projectContext = getProjectContext();
    console.log(`📁 Analyzing: ${projectContext.projectName}`);
    console.log(`📍 Location: ${projectContext.workingDirectory}\n`);
    
    const analysis = await intelligentCodebaseAnalysis(projectContext.workingDirectory);
    const overview = generateCodebaseOverview(analysis);
    await kernel.appendMessage(session.id, 'assistant', overview, {
      metadata: {
        workflow: 'analyze',
      },
    });
    await kernel.addArtifact(session.id, {
      label: 'Repository Analysis',
      type: 'report',
      content: overview,
      metadata: {
        workflow: 'analyze',
        projectRoot: projectContext.workingDirectory,
      },
    });
    await kernel.updateTask(session.id, task.id, {
      status: 'completed',
      detail: `Analyzed ${projectContext.projectName}`,
    });
    
    console.log(overview);
    
    console.log('\n💡 **Usage Tips:**');
    console.log('• Run `echoai` for full interactive mode');
    console.log('• Run `echoai "your prompt"` for direct AI assistance');
    console.log('• Run `echoai edit` for code editing mode');
    console.log('• Use the "analyze" command in interactive mode for detailed stats\n');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error instanceof Error ? error.message : 'Unknown error');
    console.log('\n💡 Try running `echoai` for the interactive interface.');
  }
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  quickAnalyzeCommand();
}
