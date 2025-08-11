![Echo AI Logo](icon.png)

# Echo AI - VS Code Extension

**The Ultimate AI Development Studio for VS Code**

Transform your development workflow with 35+ specialized AI agents, quantum-level code understanding, and predictive intelligence — all integrated directly into VS Code.


## Key Features

### 🚀 **Real-Time Code Completion**
- **Intelligent Inline Completions**: Context-aware suggestions as you type
- **Multi-Language Support**: JavaScript, TypeScript, Python, Java, and more
- **Smart Caching**: Lightning-fast responses with intelligent caching
- **Debounced Triggers**: Optimized to avoid API spam while maintaining responsiveness

### 🔍 **Advanced Error Detection**
- **Real-Time Syntax Analysis**: Instant feedback on code quality
- **AI-Powered Diagnostics**: Beyond basic syntax - semantic error detection
- **Quick Fixes**: One-click solutions for common issues
- **Language-Specific Patterns**: Tailored error detection for each programming language

### 🛠️ **Professional Development Tools**
- **Code Explanation**: Select any code and get detailed explanations
- **Smart Refactoring**: AI-guided code improvements while preserving functionality
- **Automated Test Generation**: Generate comprehensive unit tests for your functions
- **Error Auto-Fix**: Intelligent fixes for detected issues

### 🎯 **Multi-Provider AI Support**
Choose your preferred AI provider:
- **Claude (Anthropic)** - Advanced reasoning and code understanding
- **OpenAI GPT** - Industry-standard performance
- **Groq** - Ultra-fast inference speeds
- **OpenRouter** - Access to 100+ models at reduced costs
- **Gemini** - Google's latest AI capabilities
- **Meta Llama** - Open-source excellence

### ⚡ **Performance Optimized**
- **Intelligent Caching**: Reduce API calls and improve response times
- **Configurable Delays**: Customize completion triggers for your workflow
- **Large File Handling**: Optimized for codebases of any size
- **Background Processing**: Non-blocking analysis and completions

## 🚀 Quick Start

### Installation
1. Install the extension from VS Code Marketplace
2. Run the command: `Echo AI: Configure`
3. Select your preferred AI provider
4. Enter your API key (stored securely)
5. Start coding with AI assistance!

### First Steps
1. **Configure Provider**: `Ctrl+Shift+P` → `Echo AI: Configure`
2. **Get Completions**: Simply start typing - suggestions appear automatically
3. **Explain Code**: Select code → Right-click → `Echo AI: Explain`
4. **Fix Errors**: Hover over errors → Click "Fix with Echo AI"

## 🔧 Configuration

### Settings
Access settings via `File > Preferences > Settings` and search for "Echo AI":

```json
{
    "echoAI.provider": "claude",
    "echoAI.model": "claude-3-5-sonnet-20241022",
    "echoAI.maxTokens": 4096,
    "echoAI.temperature": 0.7,
    "echoAI.completionDelay": 500,
    "echoAI.maxContextSize": 4000,
    "echoAI.enableInlineCompletion": true,
    "echoAI.enableErrorDetection": true,
    "echoAI.enableCodeActions": true,
    "echoAI.enableStatusBar": true
}
```

### Provider-Specific Models
- **Claude**: `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307`
- **OpenAI**: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`
- **Groq**: `llama3-70b-8192`, `mixtral-8x7b-32768`
- **OpenRouter**: `anthropic/claude-3.5-sonnet`, `openai/gpt-4`

## 🎮 Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `Echo AI: Configure` | - | Set up AI provider and API key |
| `Echo AI: Explain` | `Ctrl+Alt+E` | Explain selected code |
| `Echo AI: Refactor` | `Ctrl+Alt+R` | Refactor selected code |
| `Echo AI: Generate Tests` | `Ctrl+Alt+T` | Generate unit tests |
| `Echo AI: Fix Errors` | `Ctrl+Alt+F` | Fix detected errors |

## 💡 Usage Examples

### Inline Completion
```typescript
// Type this:
function calculateTax(income: number

// Echo AI suggests:
function calculateTax(income: number, rate: number): number {
    return income * (rate / 100);
}
```

### Code Explanation
Select any code block and use `Echo AI: Explain` to get detailed explanations covering:
- What the code does
- How it works
- Important patterns and concepts
- Potential improvements

### Smart Refactoring
Transform your code while preserving functionality:
- Performance optimizations
- Readability improvements
- Best practice implementations
- Code structure enhancements

### Test Generation
Generate comprehensive tests including:
- Happy path scenarios
- Edge cases
- Error conditions
- Mock dependencies

## 🔐 Security & Privacy

- **Secure Storage**: API keys stored in VS Code's secure secret storage
- **Local Processing**: Context analysis happens locally when possible
- **Configurable**: Control what data is sent to AI providers
- **Audit Trail**: All requests logged for transparency

## 🛠️ Development

### Building from Source
```bash
git clone https://github.com/vijeet-shah/echo-ai-cli.git
cd echo-ai-cli/extensions/vscode
npm install
npm run compile
```

### Testing
```bash
npm run test
```

### Packaging
```bash
npm run package
```

## 🐛 Troubleshooting

### Common Issues

**No completions appearing:**
- Check API key configuration
- Verify internet connection
- Increase completion delay in settings

**Slow performance:**
- Reduce `maxContextSize` setting
- Increase `completionDelay`
- Enable caching

**Extension not activating:**
- Check VS Code version compatibility (1.74.0+)
- Restart VS Code after installation
- Check extension logs in Output panel

### Support
- **Issues**: [GitHub Issues](https://github.com/vijeet-shah/echoai/issues)
- **Documentation**: [Echo AI Docs](https://github.com/vijeet-shah/echoai/blob/main/README.md)
- **Community**: Join our discussions on GitHub

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/vijeet-shah/echoai/blob/main/CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](https://github.com/vijeet-shah/echoai/blob/main/LICENSE) for details.

## 🙏 Acknowledgments

Built with ❤️ by the Echo AI team. Special thanks to:
- VS Code Extension API team
- Anthropic, OpenAI, Groq, and other AI providers
- The open-source community

---

**Transform your development workflow with AI-powered assistance. Install Echo AI today and experience the future of coding!** 🚀