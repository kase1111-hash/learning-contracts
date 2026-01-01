# Contributing to Learning Contracts

Thank you for your interest in contributing to Learning Contracts! This document provides guidelines for contributions.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/kase1111-hash/learning-contracts.git
cd learning-contracts

# Install dependencies
npm install

# Run tests to verify setup
npm test

# Build the project
npm run build
```

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(contracts): add support for time-based expiration
fix(enforcement): correct boundary mode validation
docs(readme): update API examples
```

### Code Style

- Run `npm run format` before committing
- Run `npm run lint` to check for issues
- Run `npm run lint:fix` to auto-fix issues
- TypeScript strict mode is enabled

### Testing

- Write tests for all new features
- Ensure all tests pass: `npm test`
- Check coverage: `npm run test:coverage`
- Aim for >80% coverage on new code

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** following the code style guidelines
3. **Write/update tests** as needed
4. **Update documentation** if applicable
5. **Run the full test suite**: `npm test`
6. **Create a pull request** with:
   - Clear title following commit message format
   - Description of changes
   - Link to related issues
   - Test plan

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated if needed
- [ ] No security vulnerabilities introduced
- [ ] CHANGELOG.md updated for significant changes

## Project Structure

```
learning-contracts/
├── src/                    # Source code
│   ├── contracts/          # Contract creation and lifecycle
│   ├── enforcement/        # Enforcement engine and hooks
│   ├── audit/              # Audit logging
│   ├── storage/            # Persistent storage adapters
│   ├── memory/             # Forgetting operations
│   ├── plain-language/     # NLP interface
│   ├── vault-integration/  # Memory Vault integration
│   ├── boundary-integration/ # Boundary Daemon integration
│   ├── session/            # Session management
│   ├── expiry/             # Timebound expiry
│   ├── emergency-override/ # Emergency controls
│   ├── user-management/    # Multi-user support
│   ├── agent-os-integration/ # Agent-OS integration
│   ├── types/              # TypeScript type definitions
│   ├── system.ts           # Main system orchestrator
│   └── index.ts            # Public exports
├── tests/                  # Test suites
├── examples/               # Usage examples
└── dist/                   # Compiled output
```

## Design Principles

When contributing, keep these principles in mind:

1. **Explicit Consent**: All learning requires affirmative approval
2. **Fail-Closed**: Default to denying when uncertain
3. **Revocability**: Forgetting must always be possible
4. **Human Supremacy**: Humans can override any contract
5. **Audit Trail**: All operations must be logged
6. **No Dark Patterns**: No implicit consent or pre-checked options

## Security Considerations

- Never store plaintext secrets in code
- Use constant-time comparison for sensitive data
- Zero memory after handling sensitive content
- Follow the security guidelines in [SECURITY.md](SECURITY.md)

## Questions?

- Open a GitHub issue for bugs or feature requests
- Tag issues appropriately (`bug`, `enhancement`, `question`, etc.)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
