# AI Terminal CLI

> A unified command-line interface for multiple AI providers with VS Code integration

[![NPM Version](https://img.shields.io/npm/v/ai-terminal-cli.svg)](https://npmjs.org/package/ai-terminal-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org)

## 🚀 Features

- **🤖 Multi-Provider Support**: Claude, OpenAI GPT, Google Gemini
- **💬 Interactive Chat**: Real-time streaming conversations
- **📝 File Editing**: AI-assisted code modifications with diff preview
- **🔧 Smart Configuration**: Global and project-specific settings
- **⚡ High Performance**: Optimized for developer workflows
- **🎯 VS Code Integration**: Seamless file operations
- **🔐 Secure**: Encrypted API key storage

## 📦 Installation

```bash
# Global installation (recommended)
npm install -g ai-terminal-cli

# Verify installation
ai --version
```

## 🏃‍♂️ Quick Start

### 1. Setup Your First Provider

```bash
# Interactive setup wizard
ai config setup

# Or manually configure Claude
ai config set claude.key sk-ant-your-api-key-here
ai config set defaults.provider claude
```

### 2. Start Using AI

```bash
# Direct prompt
ai "Explain how async/await works in JavaScript"

# Interactive chat session
ai chat

# Edit files with AI
ai edit src/app.js --task "add error handling to this function"

# Include file context
ai "optimize this code" --file src/utils.js src/helpers.js
```

## 📚 Usage Examples

### Basic Chat

```bash
# One-shot query
ai "What's the difference between let and const?"

# Interactive session with specific provider
ai chat --provider openai --model gpt-4

# Stream responses in real-time
ai "Write a React component" --stream
```

### File Operations

```bash
# Edit with task description
ai edit src/components/Header.tsx --task "add TypeScript interfaces"

# Preview changes before applying
ai edit utils.js --task "add JSDoc comments" --preview

# Auto-apply without confirmation
ai edit styles.css --task "convert to CSS Grid" --auto-apply
```

### Configuration Management

```bash
# List current configuration
ai config list

# Set provider-specific settings
ai config set openai.key sk-your-openai-key
ai config set openai.model gpt-4-turbo-preview
ai config set defaults.temperature 0.3

# Test provider connection
ai provider test claude
ai provider test openai

# List available models
ai provider models claude
```

### Advanced Usage

```bash
# Multiple file context
ai "review this implementation" \\
  --file src/auth.js \\
  --file tests/auth.test.js \\
  --provider claude \\
  --model claude-3-opus-20240229

# Custom temperature and tokens
ai "generate unit tests" \\
  --temperature 0.2 \\
  --max-tokens 2000 \\
  --file src/calculator.js
```

## ⚙️ Configuration

### Configuration Files

The CLI uses a hierarchical configuration system:

1. **Command line flags** (highest priority)
2. **Environment variables** (`AI_CLAUDE_KEY`, `AI_OPENAI_KEY`)
3. **Project config** (`.ai/config.json`)
4. **Global config** (`~/.aiconfig/config.json`)
5. **Defaults** (lowest priority)

### Example Configuration

```json
{
  "providers": {
    "claude": {
      "apiKey": "sk-ant-...",
      "model": "claude-3-sonnet-20240229",
      "temperature": 0.7,
      "maxTokens": 4096
    },
    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-4-turbo-preview",
      "temperature": 0.7,
      "maxTokens": 4096
    }
  },
  "defaults": {
    "provider": "claude",
    "model": "claude-3-sonnet-20240229",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "integrations": {
    "vscode": {
      "enabled": true,
      "autoSave": true,
      "diffPreview": true
    },
    "git": {
      "autoCommit": false
    }
  },
  "features": {
    "streaming": true,
    "diffPreview": true,
    "autoCommit": false
  }
}
```

## 🔑 API Keys Setup

### Claude (Anthropic)
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Run: `ai config set claude.key sk-ant-your-key`

### OpenAI
1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Create an API key
3. Run: `ai config set openai.key sk-your-key`

### Google Gemini
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Run: `ai config set gemini.key your-key`

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Interface │────│  Core Engine    │────│   AI Providers  │
│   (Commander.js)│    │                 │    │   (API Layer)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │──────────────│  File Manager   │──────────────│
         │              │  (VS Code Int.) │              │
         │              └─────────────────┘              │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Config Mgmt   │────│   Context Mgmt  │────│   Backup Sys    │
│   (Cosmiconfig) │    │   (File/Project)│    │   (Auto-backup) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🧪 Development

### Prerequisites

- Node.js 18+ 
- npm or yarn or pnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/ai-terminal-cli.git
cd ai-terminal-cli

# Install dependencies
npm install

# Build the project
npm run build

# Link for local development
npm link
```

### Development Scripts

```bash
# Development mode with hot reload
npm run dev

# Run tests
npm test
npm run test:coverage

# Linting and formatting
npm run lint
npm run lint:fix
npm run format

# Type checking
npm run type-check

# Build for production
npm run build
```

### Project Structure

```
src/
├── cli/                 # CLI commands and interface
│   ├── chat.ts         # Interactive chat command
│   ├── config.ts       # Configuration management
│   ├── direct.ts       # Direct prompt handling
│   ├── edit.ts         # File editing command
│   └── provider.ts     # Provider management
├── core/               # Core business logic
│   └── provider-manager.ts
├── providers/          # AI provider implementations
│   ├── claude.ts       # Claude/Anthropic integration
│   ├── openai.ts       # OpenAI GPT integration
│   └── gemini.ts       # Google Gemini (placeholder)
├── integrations/       # External service integrations
│   └── file-manager.ts # File operations and VS Code
├── config/            # Configuration management
│   └── manager.ts     # Config loading and validation
├── utils/             # Utility functions
│   └── index.ts
├── types/             # TypeScript definitions
│   └── index.ts
└── cli.ts             # Main CLI entry point
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/providers/claude.test.ts

# Watch mode
npm test -- --watch
```

## 📖 API Reference

### Core Classes

#### `ConfigManager`
Manages application configuration with validation and persistence.

#### `ProviderManager` 
Handles AI provider registration, authentication, and switching.

#### `FileManager`
Provides file operations with backup and diff capabilities.

### Provider Interface

```typescript
interface AIProvider {
  name: string;
  models: string[];
  authenticate(apiKey: string): Promise<boolean>;
  chat(messages: Message[], options: ChatOptions): AsyncGenerator<string>;
  complete(prompt: string, options: CompletionOptions): Promise<string>;
  validateConfig(config: ProviderConfig): ConfigValidation;
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with proper commit messages
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Run linting: `npm run lint`
7. Submit a pull request

### Commit Message Format

We follow conventional commits:

```
feat: add new provider support
fix: resolve authentication timeout
docs: update API documentation
test: add provider integration tests
chore: update dependencies
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for Claude AI
- [OpenAI](https://openai.com) for GPT models
- [Google](https://ai.google.dev) for Gemini AI
- The open-source community for amazing tools and libraries

## 📞 Support

- 📧 Email: support@ai-terminal-cli.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/ai-terminal-cli/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/ai-terminal-cli/discussions)
- 📖 Documentation: [Full Documentation](https://docs.ai-terminal-cli.com)

---

<div align="center">
  <strong>Made with ❤️ by the AI Terminal CLI team</strong>
</div>