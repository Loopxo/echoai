<div align="center">
  <img src="echo.png" alt="Echo AI Logo" width="120" height="120">
  
  # Echo AI - Intelligent Terminal with Autonomous Agents
  
  > 🔮 The most intelligent AI terminal with autonomous agents, multi-provider support, and advanced analytics
</div>

[![NPM Version](https://img.shields.io/npm/v/echoai.svg)](https://npmjs.org/package/echoai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org)

## 🎯 What is Echo AI?

Echo AI is an intelligent terminal interface that brings together multiple AI providers with autonomous agents to enhance your development workflow. Unlike other AI tools, Echo AI provides a comprehensive command-line interface with advanced features for session management, analytics, and extensibility.

### 🔧 Core Features

**🧠 Intelligent Agents**
- Specialized agents for code optimization and prompt enhancement
- Context-aware agent selection with confidence scoring
- Automatic prompt optimization for better results

**🌐 Multi-Provider Support**
- **6 AI Providers**: Claude, OpenAI, Gemini, Groq, Meta AI, OpenRouter
- Unified interface for accessing 100+ AI models
- Smart routing to automatically select the optimal provider

**💾 Session Management**
- Save and organize conversation sessions
- Export sessions in multiple formats (JSON, Markdown, Text)
- Share sessions with secure links

**📊 Analytics & Insights**
- Track usage statistics and cost analysis
- Monitor provider performance and success rates
- Export analytics data for further analysis

**🔄 Model Context Protocol (MCP) Support**
- Integrate with MCP-compatible tools and servers
- Extend Echo AI with custom tools and capabilities
- Add external tools via stdio, HTTP, or SSE transports

**🔒 Security & Privacy**
- Secure storage of API keys and configuration
- Granular permissions and access controls
- Data anonymization options

## 📦 Installation

```bash
# Install globally from NPM
npm install -g echoai

# Development version
git clone https://github.com/vijeet-shah/echo-ai-cli.git
cd echo-ai-cli
npm install && npm run build
```

## 🚀 Quick Start

### 1. Launch Interactive Mode
```bash
echoai
# Opens interactive terminal interface
```

### 2. Direct Prompting
```bash
# Send a prompt directly to AI
echoai "Explain how React hooks work"

# Specify a provider and model
echoai "Write a Python function to sort a list" --provider openai --model gpt-4

# Include files as context
echoai "Refactor this code for better performance" --file src/utils.js
```

### 3. Use Specialized Commands
```bash
# Start a chat session
echoai chat

# Edit files with AI assistance
echoai edit src/components/Button.tsx "Add loading state"

# Analyze your codebase
echoai analyze

# Manage configuration
echoai config setup
```

## 🤖 Intelligent Agents

Echo AI uses specialized agents to optimize your prompts and improve results:

### Code Optimization Agent
```bash
# Optimize code-related prompts
echoai agents optimize "Create a React component for a todo list"

# Optimize with specific preferences
echoai agents optimize "Write a Python API" --format detailed --level expert
```

### Prompt Enhancement Agent
```bash
# Enhance general prompts
echoai agents optimize "Explain quantum computing"

# Get structured responses
echoai agents optimize "List best practices for Docker" --format structured
```

### Agent-Based Execution
```bash
# Run a prompt with automatic agent optimization
echoai agents run "Create a REST API with Express.js and MongoDB"

# Run with streaming output
echoai agents run "Build a React dashboard" --stream
```

## 📊 Analytics & Insights

Track your AI usage and optimize your workflow:

### Usage Analytics
```bash
# View analytics overview
echoai analytics overview

# See daily statistics
echoai analytics daily

# Detailed cost analysis
echoai analytics costs
```

### Tool Usage Statistics
```bash
# View tool usage stats
echoai analytics tools

# Export analytics data
echoai analytics export --format json --days 30
```

### Configuration
```bash
# View current analytics config
echoai analytics config

# Enable tracking with detailed level
echoai analytics config --enable --level detailed

# Set data retention
echoai analytics config --retention 90 --anonymize
```

## ⚙️ Configuration

### Provider Setup
```bash
# Interactive setup
echoai config setup

# Provider-specific configuration
echoai config set claude.key sk-ant-your-key
echoai config set openai.key sk-your-key  
echoai config set groq.key gsk-your-key
```

### General Configuration
```bash
# Set default provider and model
echoai config set defaults.provider openai
echoai config set defaults.model gpt-4

# Configure temperature and token limits
echoai config set defaults.temperature 0.7
echoai config set defaults.maxTokens 2000
```

## 🗂️ Session Management

Organize and manage your conversation sessions:

### List and Search Sessions
```bash
# List all sessions
echoai sessions list

# Filter by provider
echoai sessions list --provider openai

# Search in session content
echoai sessions list --search "react component"

# Limit results
echoai sessions list --limit 10
```

### View and Export Sessions
```bash
# Show session details
echoai sessions show session-id-123

# Include message history
echoai sessions show session-id-123 --messages

# Export session in different formats
echoai sessions export session-id-123 --format markdown
echoai sessions export session-id-123 --format json --output my-session.json
```

### Share and Delete Sessions
```bash
# Create a shareable link
echoai sessions share session-id-123 --public

# Create password-protected share
echoai sessions share session-id-123 --password secret123

# Set expiration
echoai sessions share session-id-123 --expires 7

# Delete a session
echoai sessions delete session-id-123
```

### Session Statistics
```bash
# View session statistics
echoai sessions stats
```

## 🔌 Model Context Protocol (MCP) Support

Integrate with MCP-compatible tools to extend Echo AI's capabilities:

### Manage MCP Servers
```bash
# List configured MCP servers
echoai mcp list

# Add a new MCP server
echoai mcp add --id my-tool --name "My Tool" --transport stdio --command "/path/to/tool"

# Add HTTP-based MCP server
echoai mcp add --id api-tool --name "API Tool" --transport http --url http://localhost:8000

# Remove an MCP server
echoai mcp remove my-tool
```

### Use MCP Tools
```bash
# List available tools
echoai mcp tools

# Call an MCP tool
echoai mcp call calculator expression="2+2*3"

# Call tool with complex arguments
echoai mcp call file-reader path="src/index.ts" encoding="utf-8"
```

## 🔒 Security & Privacy

Protect your data and control access:

### Security Management
```bash
# View security status
echoai security status

# Run security audit
echoai security audit

# Check for vulnerabilities
echoai security check

# Update security policies
echoai security update
```

### Permissions & Access Control
```bash
# View current permissions
echoai security permissions

# Grant tool access
echoai security permissions --grant mcp-tool --tool calculator

# Revoke access
echoai security permissions --revoke mcp-tool --tool file-reader

# Set access level
echoai security permissions --level restricted
```

## 📈 Advanced Features

### Data Export & Import
```bash
# Export all data
echoai export --type all --format json

# Export specific data types
echoai export --type sessions --format json
echoai export --type config --format json

# Import data
echoai import --file backup.json
```

### Model Management
```bash
# List available models
echoai models list

# Show model details
echoai models show gpt-4

# Set favorite models
echoai models favorite gpt-4 claude-3-opus
```

### Quick Code Analysis
```bash
# Analyze your codebase
echoai analyze

# Analyze with specific focus
echoai analyze --focus security

# Get optimization suggestions
echoai analyze --focus performance
```

## 🛠️ Development

### Building from Source
```bash
# Clone the repository
git clone https://github.com/vijeet-shah/echo-ai-cli.git
cd echo-ai-cli

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality
```bash
# Check types
npm run type-check

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## 🤝 Contributing

We welcome contributions to Echo AI! Here's how you can help:

1. **Bug Reports**: Submit issues for any bugs you encounter
2. **Feature Requests**: Suggest new features or improvements
3. **Code Contributions**: Submit pull requests with bug fixes or new features
4. **Documentation**: Help improve our documentation and examples

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/your-username/echo-ai-cli.git
cd echo-ai-cli

# Install dependencies
npm install

# Create a branch for your feature
git checkout -b feature/your-feature-name

# Make your changes and test thoroughly

# Commit and push your changes
git commit -m "Add your feature description"
git push origin feature/your-feature-name

# Create a pull request
```

## 📄 License

MIT License - Built for the developer community

---