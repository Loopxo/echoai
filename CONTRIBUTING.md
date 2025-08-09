# Contributing to AI Terminal CLI

Thank you for considering contributing to AI Terminal CLI! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- npm, yarn, or pnpm
- Git
- TypeScript knowledge
- Basic understanding of CLI development

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/vijeetshah/echo-ai-cli.git
   cd echo-ai-cli
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your development environment**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Build the project
   npm run build
   
   # Link for local testing
   npm link
   ```

4. **Verify setup**
   ```bash
   # Run tests
   npm test
   
   # Check linting
   npm run lint
   
   # Test CLI
   ai --version
   ```

## 🤝 Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- 🐛 **Bug fixes**
- ✨ **New features**
- 📚 **Documentation improvements**
- 🧪 **Tests and test coverage**
- 🎨 **Code quality improvements**
- 🌍 **Internationalization**
- 🔧 **Build and tooling improvements**

### Before Contributing

1. **Check existing issues** - Look for existing issues or discussions
2. **Open an issue** - For new features or significant changes
3. **Discuss your approach** - Get feedback before implementing
4. **Keep it focused** - One feature/fix per pull request

## 🔄 Pull Request Process

### 1. Branch Creation

Create a descriptive branch name:

```bash
# Feature branches
git checkout -b feature/add-gemini-provider
git checkout -b feature/improve-error-handling

# Bug fix branches  
git checkout -b fix/claude-authentication-timeout
git checkout -b fix/config-validation-error

# Documentation branches
git checkout -b docs/update-api-reference
git checkout -b docs/add-provider-guide
```

### 2. Development Process

1. **Write your code**
   - Follow existing code patterns
   - Add appropriate comments
   - Include error handling

2. **Add tests**
   ```bash
   # Create test files
   src/providers/__tests__/new-provider.test.ts
   
   # Run tests
   npm test
   ```

3. **Update documentation**
   - Update README.md if needed
   - Add JSDoc comments for new APIs
   - Update type definitions

4. **Commit your changes**
   ```bash
   # Use conventional commit format
   git commit -m "feat: add Google Gemini provider integration"
   git commit -m "fix: resolve authentication timeout in Claude provider"
   git commit -m "docs: add provider configuration examples"
   ```

### 3. Pre-submission Checklist

- [ ] Code follows project conventions
- [ ] Tests are written and passing
- [ ] Documentation is updated
- [ ] Commit messages follow conventional format
- [ ] No linting errors
- [ ] TypeScript compiles without errors

```bash
# Run all checks
npm run lint
npm run type-check
npm test
npm run build
```

### 4. Submit Pull Request

1. **Push your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create pull request**
   - Use descriptive title
   - Fill out PR template
   - Link related issues
   - Add screenshots if UI changes

3. **Respond to feedback**
   - Address review comments
   - Make requested changes
   - Keep discussion constructive

## 🐛 Issue Guidelines

### Bug Reports

Use the bug report template and include:

- **Clear description** of the issue
- **Steps to reproduce** the problem
- **Expected vs actual behavior**
- **Environment details** (OS, Node version, etc.)
- **Error messages** or logs
- **Minimal reproduction** if possible

Example:
```markdown
**Bug Description**
Claude provider fails authentication with valid API key

**Steps to Reproduce**
1. Run `ai config set claude.key sk-ant-valid-key`
2. Run `ai provider test claude`
3. See authentication failure

**Environment**
- OS: macOS 14.0
- Node: 18.17.0  
- CLI Version: 0.1.0

**Error Message**
Error: Claude authentication failed: network timeout
```

### Feature Requests

Use the feature request template and include:

- **Clear description** of the feature
- **Use case** or problem it solves
- **Proposed solution** or implementation ideas
- **Alternatives considered**
- **Additional context** or examples

## 🎯 Coding Standards

### TypeScript Guidelines

- Use strict TypeScript configuration
- Provide explicit types for public APIs
- Use interfaces over types when possible
- Export types that consumers might need

```typescript
// Good
interface ProviderConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
}

// Good  
export class ClaudeProvider implements AIProvider {
  async authenticate(apiKey: string): Promise<boolean> {
    // Implementation
  }
}
```

### Code Style

We use ESLint and Prettier for consistent code formatting:

```bash
# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format
```

Key conventions:
- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces  
- Use kebab-case for file names
- Prefer explicit over implicit
- Write self-documenting code

### Error Handling

- Always handle errors gracefully
- Provide helpful error messages
- Use appropriate error types
- Log errors appropriately

```typescript
// Good
try {
  const result = await provider.authenticate(apiKey);
  return result;
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  throw new Error(`Authentication failed: ${message}`);
}
```

### Async/Await

- Prefer async/await over Promises
- Handle errors in async functions
- Use appropriate return types

```typescript
// Good
async function loadConfig(): Promise<Config> {
  try {
    const result = await this.explorer.search();
    return ConfigSchema.parse(result?.config || {});
  } catch (error) {
    console.warn('Invalid config, using defaults');
    return this.getDefaultConfig();
  }
}
```

## 🧪 Testing

### Test Structure

- Unit tests for individual functions/classes
- Integration tests for component interactions
- End-to-end tests for CLI workflows

```bash
src/
├── providers/
│   ├── __tests__/
│   │   ├── claude.test.ts
│   │   └── openai.test.ts
│   ├── claude.ts
│   └── openai.ts
```

### Writing Tests

Use descriptive test names and arrange tests logically:

```typescript
describe('ClaudeProvider', () => {
  describe('authentication', () => {
    it('should authenticate with valid API key', async () => {
      // Test implementation
    });
    
    it('should fail authentication with invalid API key', async () => {
      // Test implementation  
    });
  });
  
  describe('chat completion', () => {
    it('should generate streaming response', async () => {
      // Test implementation
    });
  });
});
```

### Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- claude.test.ts

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm run test:coverage
```

## 📚 Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Document complex algorithms or business logic
- Include examples in documentation

```typescript
/**
 * Authenticates with the AI provider using the provided API key
 * @param apiKey - The API key for authentication
 * @returns Promise resolving to authentication success status
 * @throws {Error} If authentication fails due to network or API issues
 * 
 * @example
 * ```typescript
 * const provider = new ClaudeProvider(config);
 * const isAuthenticated = await provider.authenticate('sk-ant-...');
 * ```
 */
async authenticate(apiKey: string): Promise<boolean>
```

### README Updates

When adding new features:
- Update feature list
- Add usage examples  
- Update configuration documentation
- Add any new prerequisites

### API Reference

Update API documentation for:
- New public methods/classes
- Changed method signatures
- New configuration options
- New CLI commands

## 🏷️ Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality
- **PATCH** version for backwards-compatible bug fixes

### Release Checklist

1. Update version in package.json
2. Update CHANGELOG.md
3. Ensure all tests pass
4. Create release notes
5. Tag release
6. Publish to npm

## 💬 Getting Help

If you need help:

- 💬 Join [GitHub Discussions](https://github.com/vijeetshah/echo-ai-cli/discussions)
- 📧 Email maintainers
- 🐛 Open an issue for bugs
- 📖 Check existing documentation

## 🎉 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Special thanks in major releases

Thank you for contributing to AI Terminal CLI! 🚀