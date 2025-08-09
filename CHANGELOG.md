# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2024-12-09 - "Echo Intelligence"

### 🔮 MAJOR REBRAND: AI Terminal CLI → Echo AI CLI

**BREAKING CHANGES:**
- Binary command changed from `ai` to `echo`
- Package name changed from `ai-terminal-cli` to `echo-ai-cli`
- Environment variables now use `ECHO_` prefix
- Configuration files and commands updated throughout

### ✨ NEW: Intelligent Agents System

**Autonomous Agent Framework:**
- **CodeOptimizer Agent**: Specialized for programming tasks with language detection
- **PromptEnhancer Agent**: General-purpose prompt optimization and structuring
- **EchoAgentManager**: Intelligent agent selection and orchestration system
- **Confidence Scoring**: Agents provide confidence ratings for their optimizations
- **Post-Processing**: Automated response enhancement and formatting

**Agent Commands:**
- `echo agents list` - View all available agents and capabilities
- `echo agents optimize <prompt>` - Optimize prompts with agent intelligence
- `echo agents run <prompt>` - Auto-optimize and execute with best provider selection

### 🚀 NEW: Additional AI Providers

**Groq Integration:**
- Ultra-fast inference with Llama 3 models
- Models: llama3-70b-8192, llama3-8b-8192, mixtral-8x7b-32768, gemma2-9b-it
- Lightning-speed responses for quick queries

**Meta AI Integration:**
- Powerful Llama 3.1/3.2 models via Together AI
- Code Llama specialized models for programming tasks
- Models: llama-3.1-405b, llama-3.1-70b, code-llama-70b, and more

### 🎯 Enhanced Features
- **Smart Provider Routing**: Agents automatically suggest best provider for each task
- **Context-Aware Optimization**: Agents analyze prompt complexity and domain
- **User Preference Integration**: Customizable output formats, explanation levels
- **Metadata Tracking**: Comprehensive optimization and usage analytics
- **Extended Configuration**: Support for 5 AI providers with validation

## [0.1.0] - 2024-12-09

### Added
- Initial release of AI Terminal CLI
- Multi-provider support for Claude and OpenAI
- Interactive chat sessions with streaming responses
- File editing capabilities with AI assistance
- Diff preview system with automatic backups
- Comprehensive configuration management
- VS Code integration for seamless file operations
- Command-line interface with intuitive commands
- Professional TypeScript codebase with strict typing
- Complete testing framework with Vitest
- Comprehensive documentation and contribution guidelines
- MIT license for open source distribution

### Features
- **Providers**: Claude (Anthropic), OpenAI GPT, Gemini (placeholder)
- **Commands**: 
  - `ai "prompt"` - Direct prompting
  - `ai chat` - Interactive chat sessions
  - `ai edit <file> --task "task"` - AI-assisted file editing
  - `ai config setup` - Interactive configuration
  - `ai provider test <name>` - Provider authentication testing
- **Configuration**: Global and project-specific settings with validation
- **Integration**: Seamless VS Code file operations with backup system
- **Developer Experience**: Professional toolchain with linting, formatting, and testing

### Technical Details
- Built with TypeScript and Node.js 18+
- Commander.js for CLI framework
- Zod for configuration validation
- Vitest for testing with coverage
- ESLint + Prettier for code quality
- Streaming API support for real-time responses
- Encrypted configuration storage
- Cross-platform compatibility (Windows, macOS, Linux)

### Installation
```bash
npm install -g ai-terminal-cli
ai config setup
```

### Documentation
- Complete README with usage examples
- Contributing guidelines for open source development
- API documentation with TypeScript interfaces
- Professional Git workflow examples