# Echo AI CLI

> 🔮 An intelligent AI terminal with autonomous agents, multi-provider support, and advanced output optimization

[![NPM Version](https://img.shields.io/npm/v/echo-ai-cli.svg)](https://npmjs.org/package/echo-ai-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org)

## ✨ What Makes Echo Special

Echo isn't just another AI CLI - it's an **intelligent terminal** that thinks before it acts. With autonomous agents that analyze your prompts and optimize them automatically, Echo delivers better results with less effort.

## 🆕 What's New in Latest Version

### ✨ **Interactive Welcome Experience**
- **Guided Setup**: Beautiful CLI interface that walks you through provider configuration
- **Smart Detection**: Automatically detects existing configurations with ✅ indicators
- **Connection Testing**: Real-time API key validation during setup
- **Persistent Storage**: Never lose your configurations - they're saved permanently

### ⚡ **Groq Provider - Ultra-Fast Inference**
- **Lightning Speed**: Experience blazing-fast responses with Groq's optimized infrastructure
- **Full Integration**: Complete Groq SDK implementation with streaming support
- **Llama Models**: Access to Llama 3 70B, 8B, Mixtral 8x7B, and Gemma variants
- **Production Ready**: Robust error handling and authentication

### 🔧 **Configuration Persistence**
- **Smart Storage**: Configurations persist between CLI sessions automatically  
- **Flexible Updates**: Keep existing API keys or update them individually
- **No Re-entry**: Set up once, use forever - no more repeated configuration
- **Multi-Provider**: Seamlessly manage multiple AI providers simultaneously

## 🚀 Features

- **🤖 Intelligent Agents**: Autonomous prompt optimization and output enhancement  
- **🌍 6 AI Providers**: Claude, OpenAI, Gemini, Groq, Meta AI, and OpenRouter (100+ models)
- **⚡ Smart Routing**: Automatically suggest the best provider for your task
- **💬 Interactive Chat**: Real-time streaming conversations with context awareness
- **📝 Code Integration**: AI-assisted file editing with diff preview and backups
- **🎯 Output Optimization**: Context-aware formatting and post-processing
- **🔧 Smart Configuration**: Global and project-specific settings with validation
- **🚀 Ultra-Fast**: Groq integration for lightning-speed responses
- **🎪 Interactive Welcome**: Beautiful guided setup experience
- **💾 Smart Persistence**: Configuration saved automatically, never re-enter API keys
- **🔄 Seamless Updates**: Keep existing configs or update individual providers

## 📦 Installation

```bash
# Clone and build (development version)
git clone https://github.com/your-username/echo-ai-cli.git
cd echo-ai-cli
npm install
npm run build

# Make executable (replace with your project path)
chmod +x dist/cli.js
```

## 🏃‍♂️ Quick Start

### 1. Interactive Welcome Experience

**NEW!** Echo now features a beautiful interactive welcome that guides you through setup:

```bash
# Launch Echo's interactive welcome
./dist/cli.js
# or 
echoai
```

This opens an interactive menu where you can:
- 🚀 **First-time setup**: Guided provider configuration with connection testing
- ✅ **Existing configs**: See providers marked as "Already configured"
- 🔑 **API key management**: Keep existing keys or update them easily
- 💬 **Direct access**: Jump into chat, file editing, or agent optimization

### 2. Quick Provider Setup

```bash
# Interactive welcome handles setup, but you can also use:
echoai config setup

# Or manually configure (now with persistent storage!)
echoai config set claude.key sk-ant-your-api-key-here
echoai config set groq.key gsk_your-groq-key-here  # ⚡ Ultra-fast inference
echoai config set meta.key your-meta-ai-key-here
echoai config set openrouter.key sk-or-your-key-here  # 🌐 100+ models via unified API
```

### 3. Experience the Power

```bash
# Direct command with automatic optimization
echoai "explain machine learning to me"

# Ultra-fast responses with Groq
echoai "quick code snippet" --provider groq

# Interactive chat with agent optimization
echoai  # → Select "💬 Start interactive chat session"
```

### 4. Let Echo's Agents Optimize Your Prompts

```bash
# Automatic optimization and execution
echoai agents run "help me write a React component"

# See how agents would optimize your prompt  
echoai agents optimize "debug this code"

# Direct execution (agents work behind the scenes)
echoai "explain how machine learning works"

# Interactive agent testing (from welcome menu)
echoai  # → Select "🤖 Use intelligent agents for optimization"
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
echoai agents list

# Optimize any prompt with agents
echoai agents optimize "write a Python script to analyze data"

# Auto-optimize and execute (recommended)  
echoai agents run "help me design a database schema" --level expert --examples

# View agent optimization details
echoai agents optimize "fix my code" --format detailed

# Interactive agent exploration (recommended for beginners)
echoai  # → "🤖 Use intelligent agents for optimization" → "🧪 Test prompt optimization"
```

## 📚 Usage Examples

### Multi-Provider Support

```bash
# Ultra-fast responses with Groq (⚡ NEW: Fully functional!)
echoai "quick code snippet" --provider groq

# Advanced reasoning with Claude
echoai "complex analysis task" --provider claude --model claude-3-opus

# Code generation with Meta AI  
echoai "generate Python function" --provider meta --model code-llama-70b

# Creative tasks with OpenAI
echoai "write a creative story" --provider openai --model gpt-4

# 100+ models via OpenRouter (🌐 NEW: Cost-effective unified access!)
echoai "explain quantum computing" --provider openrouter --model anthropic/claude-3.5-sonnet

# Interactive provider selection (NEW!)
echoai  # → Welcome shows "✨ Ready to go! You have X providers configured"
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

Echo supports 6 major AI providers:

**Recommended: Use Interactive Welcome**
```bash
echoai  # → Guided setup with connection testing and persistent storage
```

**Manual Configuration (Advanced)**
```bash
# Claude (Anthropic) - Best for analysis and reasoning
echoai config set claude.key sk-ant-your-key

# OpenAI - Excellent for creative and complex tasks  
echoai config set openai.key sk-your-key

# Groq - Ultra-fast inference (⚡ NOW FULLY WORKING!)
echoai config set groq.key gsk_your-key

# Meta AI - Powerful Llama and Code Llama models
echoai config set meta.key your-together-ai-key

# OpenRouter - 100+ models via unified API (🌐 NEW!)
echoai config set openrouter.key sk-or-your-key

# Gemini - Google's multimodal AI (coming soon)
echoai config set gemini.key your-key
```

**Configuration Management (NEW!)**
```bash
# View all configured providers with masked API keys
echoai  # → "⚙️ Manage providers and configuration" → "👀 View current config"

# Update existing API key while keeping other settings  
echoai  # → Select configured provider → "🔑 Update API key"

# Check configuration status
echoai  # → Welcome shows: "✨ Ready to go! You have X providers configured"
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
| **OpenRouter** | 🌐 **Unified Access** | Varies | 💰 **Cheapest** | **100+ Models** |
| **Gemini** | Multimodal | Medium | $$ | Gemini Pro (Coming Soon) |

*Echo's agents automatically recommend the best provider for each task*

### 🌐 OpenRouter: The Game Changer

**NEW!** OpenRouter integration provides unprecedented access to AI models:

#### **Why OpenRouter?**
- **💰 Cost Efficiency**: Often 50-90% cheaper than direct provider APIs
- **🎯 Model Variety**: 100+ models from 20+ providers with one API key
- **⚡ Easy Comparison**: Test Claude, GPT, Llama, Gemini seamlessly
- **🔄 Unified Interface**: Consistent experience across all models
- **📊 Transparent Pricing**: Clear per-token costs for budget control

#### **Popular Models Available**
```bash
# Premium models at lower costs
echoai "complex task" --provider openrouter --model anthropic/claude-3.5-sonnet
echoai "creative writing" --provider openrouter --model openai/gpt-4-turbo
echoai "code generation" --provider openrouter --model meta-llama/codellama-70b-instruct

# Explore cutting-edge models
echoai "analysis task" --provider openrouter --model google/gemini-pro-1.5
echoai "fast response" --provider openrouter --model mistralai/mixtral-8x7b-instruct
```

Get your OpenRouter API key at [openrouter.ai](https://openrouter.ai) and access the world's largest AI model marketplace!

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