# Learning Contracts

TypeScript library for explicit, enforceable agreements governing what an AI learning co-worker is allowed to learn from interactions. Part of the Agent-OS ecosystem.

## Tech Stack

- **Language**: TypeScript 5.0+ (strict mode)
- **Runtime**: Node.js >= 18.0.0
- **Testing**: Jest 30+ with ts-jest
- **Linting**: ESLint 9+ with typescript-eslint (flat config)
- **Formatting**: Prettier

## Quick Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run lint         # Check code
npm run lint:fix     # Auto-fix lint issues
npm run format       # Format with Prettier
npm run typecheck    # Type check without emit
```

## Project Structure

```
src/
├── contracts/           # Contract creation & lifecycle (factory, validator)
├── enforcement/         # 4 mandatory enforcement hooks
├── types/               # Core type definitions
├── audit/               # Immutable audit event logging
├── storage/             # Repository & adapters (memory, file)
├── memory/              # Forgetting operations (tombstone, freeze, purge)
├── plain-language/      # Natural language parser, builder, templates
├── vault-integration/   # Memory Vault bridge
├── boundary-integration/# Boundary Daemon bridge
├── session/             # Session tracking & cleanup
├── expiry/              # Auto-expiry manager
├── emergency-override/  # Human supremacy controls
├── user-management/     # Multi-user support
├── errors/              # Centralized error handling
├── system.ts            # Main orchestration class
└── index.ts             # Public API exports
tests/                   # Test suites for all modules
```

## Code Style

- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Line width**: 100 characters
- **Trailing commas**: ES5 style
- **Unused variables**: Prefix with `_` to suppress warnings

## Key Patterns

1. **Fail-Closed**: Default deny on ambiguity, require explicit approval
2. **Adapter Pattern**: Storage, Vault, Boundary integrations use adapters
3. **Factory Pattern**: `ContractFactory` creates different contract types
4. **Repository Pattern**: `ContractRepository` for data access abstraction

## Contract Types

| Type | Description |
|------|-------------|
| Observation | Can observe, cannot store or generalize |
| Episodic | Store specific episodes, no cross-context generalization |
| Procedural | Derive reusable heuristics within scope |
| Strategic | Infer long-term strategies (requires trusted boundary) |
| Prohibited | Explicitly forbids learning, overrides all others |

## Contract Lifecycle

`Draft` → `Review` → `Active` → (`Expired` | `Revoked` | `Amended`)

## Enforcement Hooks (4 Mandatory)

1. `checkMemoryCreation()` - Before memory creation
2. `checkAbstraction()` - During abstraction/generalization
3. `checkRecall()` - Before recall (scope revalidation)
4. `checkExport()` - During export (transfer prohibition)

Violations result in **hard failure**, not warnings.

## Git Commits

Use conventional commits:

```
feat(scope): description    # New feature
fix(scope): description     # Bug fix
docs(scope): description    # Documentation
refactor(scope): description
test(scope): description
chore(scope): description
```

## Testing

- Test files: `**/*.test.ts` or `**/*.spec.ts`
- Coverage thresholds: 68% statements, 68% lines, 65% functions, 45% branches
- Tests use mocks cleared between runs
- Timeout: 10 seconds per test

## Design Principles

- **Explicit Consent**: Affirmative contracts required for learning
- **Nothing Learned by Default**: Fail-closed default behavior
- **Revocability**: Forgetting is a first-class operation
- **Non-Emergence**: No silent generalization beyond contract scope
- **Human Supremacy**: Owner can override any contract
- **Audit Trail**: All operations logged immutably
