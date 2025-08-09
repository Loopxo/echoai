# Echo AI CLI

> 🔮 An intelligent AI terminal with autonomous agents, multi-provider support, and advanced output optimization

[![NPM Version](https://img.shields.io/npm/v/echo-ai-cli.svg)](https://npmjs.org/package/echo-ai-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org)

## ✨ What Makes Echo Special

Echo isn't just another AI CLI - it's an **intelligent terminal** that thinks before it acts. With autonomous agents that analyze your prompts and optimize them automatically, Echo delivers better results with less effort.

## 🚀 Features

- **🤖 Intelligent Agents**: Autonomous prompt optimization and output enhancement  
- **🌍 5 AI Providers**: Claude, OpenAI, Gemini, Groq, and Meta AI (Llama)
- **⚡ Smart Routing**: Automatically suggest the best provider for your task
- **💬 Interactive Chat**: Real-time streaming conversations with context awareness
- **📝 Code Integration**: AI-assisted file editing with diff preview and backups
- **🎯 Output Optimization**: Context-aware formatting and post-processing
- **🔧 Smart Configuration**: Global and project-specific settings with validation
- **🚀 Ultra-Fast**: Groq integration for lightning-speed responses

## 📦 Installation

```bash
# Global installation (recommended)
npm install -g echo-ai-cli

# Verify installation
echo --version
```

## 🏃‍♂️ Quick Start

### 1. Setup Your First Provider

```bash
# Interactive setup wizard with agent support
echo config setup

# Or manually configure providers
echo config set claude.key sk-ant-your-api-key-here
echo config set groq.key gsk_your-groq-key-here
echo config set meta.key your-meta-ai-key-here
```

### 2. Let Echo's Agents Optimize Your Prompts

```bash
# Automatic optimization and execution
echo agents run "help me write a React component"

# See how agents would optimize your prompt
echo agents optimize "debug this code"

# Direct execution (agents work behind the scenes)
echo "explain how machine learning works"
```

## 🤖 Intelligent Agents System

Echo's breakthrough feature is its **autonomous agents** that analyze and optimize your prompts automatically:

### Available Agents

**🔧 CodeOptimizer Agent**
- Optimizes prompts for programming tasks
- Suggests best providers for code generation
- Adds structure and best practices guidance
- Supports all major programming languages

**✨ PromptEnhancer Agent**
- Enhances general queries for better responses
- Adds context and output formatting
- Incorporates expert role-playing
- Customizes based on user preferences

### Agent Commands

```bash
# List all available agents
echo agents list

# Optimize any prompt with agents
echo agents optimize "write a Python script to analyze data"

# Auto-optimize and execute (recommended)
echo agents run "help me design a database schema" --level expert --examples

# View agent optimization details
echo agents optimize "fix my code" --format detailed
```

## 📚 Usage Examples

### Multi-Provider Support

```bash
# Ultra-fast responses with Groq
echo "quick code snippet" --provider groq

# Advanced reasoning with Claude
echo "complex analysis task" --provider claude --model claude-3-opus

# Code generation with Meta AI
echo "generate Python function" --provider meta --model code-llama-70b

# Creative tasks with OpenAI
echo "write a creative story" --provider openai --model gpt-4
```

### Intelligent File Operations

```bash
# AI-assisted file editing with agent optimization
echo edit src/components/Header.tsx --task "add TypeScript interfaces"

# Agent-optimized code review
echo agents run "review this code for security issues" --file auth.js --format detailed

# Multi-file context with smart optimization  
echo "optimize this implementation" --file src/app.js --file src/utils.js --provider claude
```

### Advanced Agent Features

```bash
# Customize agent behavior
echo agents run "explain quantum computing" \\
  --format structured \\
  --level beginner \\
  --examples \\
  --provider claude

# Let agents choose the best provider
echo agents run "write performant database queries"
# → Agents automatically suggest Meta AI with Code Llama

# Complex optimization with confidence scoring
echo agents optimize "build a machine learning pipeline" --format detailed
# → Shows confidence scores and optimization strategies
```

## ⚙️ Configuration

### Provider Setup

Echo supports 5 major AI providers:

```bash
# Claude (Anthropic) - Best for analysis and reasoning
echo config set claude.key sk-ant-your-key

# OpenAI - Excellent for creative and complex tasks  
echo config set openai.key sk-your-key

# Groq - Ultra-fast inference with Llama models
echo config set groq.key gsk_your-key

# Meta AI - Powerful Llama and Code Llama models
echo config set meta.key your-together-ai-key

# Gemini - Google's multimodal AI (coming soon)
echo config set gemini.key your-key
```

### Agent Preferences

```bash
# Set default output preferences for agents
echo config set defaults.outputFormat structured
echo config set defaults.explanationLevel intermediate
echo config set defaults.includeExamples true

# Configure agent behavior
echo config set agents.enableAutoOptimization true
echo config set agents.preferredOptimizer CodeOptimizer
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Echo CLI      │────│  Agent System   │────│   AI Providers  │
│   (Commander)   │    │  (Optimization) │    │   (5 Providers) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │──────────────│  Smart Routing  │──────────────│
         │              │  (Auto-Select)  │              │
         │              └─────────────────┘              │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   File Manager  │────│   Config Mgmt   │────│   Agent Store   │
│   (VS Code Int) │    │   (Multi-tier)  │    │   (Extensible)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🤖 Agents Deep Dive

### How Agents Work

1. **Input Analysis**: Agents analyze your prompt for context, complexity, and intent
2. **Optimization**: Apply domain-specific enhancements and structure
3. **Provider Selection**: Suggest the best AI provider for your specific task
4. **Execution**: Run the optimized prompt with optimal settings
5. **Post-Processing**: Apply formatting and enhancement to the output

### Agent Scoring System

```bash
echo agents optimize "write a sorting algorithm" --format detailed
```

Output includes:
- **Confidence Score**: How well the agent understands your request (0-100%)
- **Optimization Applied**: List of enhancements made to your prompt
- **Provider Recommendation**: Best AI provider for this specific task
- **Estimated Tokens**: Approximate cost/usage prediction

### Extending with Custom Agents

Echo's agent system is designed to be extensible. Each agent implements a simple interface:

```typescript
interface Agent {
  name: string;
  capabilities: AgentCapability[];
  canHandle(context: AgentContext): boolean;
  optimize(context: AgentContext): Promise<AgentResult>;
  postProcess?(result: string, context: AgentContext): Promise<string>;
}
```

## 📊 Provider Comparison

| Provider | Strengths | Speed | Cost | Models |
|----------|-----------|-------|------|--------|
| **Claude** | Analysis, Code Review | Medium | $$$ | Opus, Sonnet, Haiku |
| **OpenAI** | Creative, Complex Tasks | Medium | $$$ | GPT-4, GPT-3.5 |
| **Groq** | Ultra-Fast Inference | ⚡ Fastest | $ | Llama 3, Mixtral |
| **Meta AI** | Code, Open Models | Fast | $$ | Llama 3.1/3.2, Code Llama |
| **Gemini** | Multimodal | Medium | $$ | Gemini Pro (Coming Soon) |

*Echo's agents automatically recommend the best provider for each task*

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Setup

```bash
git clone https://github.com/your-username/echo-ai-cli.git
cd echo-ai-cli
npm install
npm run build
npm link
```

### Adding New Agents

1. Create agent in `src/agents/specialized/`
2. Implement the `Agent` interface
3. Register in `EchoAgentManager`
4. Add tests and documentation

### Development Scripts

```bash
npm run dev          # Development mode
npm test             # Run tests
npm run build        # Build for production
npm run type-check   # TypeScript validation
npm run lint         # Code linting
```

## 📖 API Reference

### Core Classes

- **EchoAgentManager**: Manages agent registration and optimization
- **ConfigManager**: Handles multi-tier configuration
- **ProviderManager**: Manages AI provider integration
- **FileManager**: Provides file operations with backup

### Agent Types

- **AgentContext**: Input context for agent optimization
- **AgentResult**: Optimized prompt with metadata and suggestions
- **AgentCapability**: Defines what an agent can do

## 🌟 Examples & Tutorials

### Code Generation

```bash
# Agent-optimized code generation
echo agents run "create a REST API with authentication" \\
  --provider meta \\
  --model code-llama-70b \\
  --level expert

# Result: Agents add structure, best practices, and examples
```

### Data Analysis

```bash
# Smart provider selection for data tasks
echo agents run "analyze this CSV for trends" \\
  --file sales_data.csv \\
  --format detailed

# Result: Agents choose OpenAI/Claude and add analysis framework
```

### Creative Writing

```bash
# Creative tasks with optimal settings
echo agents run "write a compelling product description" \\
  --format creative \\
  --examples

# Result: Agents enhance prompt and suggest GPT-4
```

## 🤝 Contributing

We welcome contributions! Echo's agent system is designed for community extension.

### Contribution Areas

- **New Agents**: Create specialized agents for different domains
- **Provider Integration**: Add new AI providers
- **Agent Capabilities**: Enhance existing agent intelligence
- **Performance**: Optimize agent decision-making
- **Documentation**: Improve guides and examples

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** for Claude AI and inspiring intelligent systems
- **OpenAI** for pushing the boundaries of AI capabilities  
- **Groq** for ultra-fast inference infrastructure
- **Meta** for open-source Llama models
- **The community** for feedback and contributions

## 📞 Support & Community

- 🐛 **Issues**: [GitHub Issues](https://github.com/your-username/echo-ai-cli/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-username/echo-ai-cli/discussions)
- 📚 **Docs**: [Full Documentation](https://docs.echo-ai-cli.com)
- 🔮 **Agent Marketplace**: Coming soon!

---

<div align="center">
  <strong>Echo - Where AI meets Intelligence</strong><br>
  <em>Made with 🔮 by the Echo AI community</em>
</div>