# @learning-contracts/vault-adapter

Bridges [Learning Contracts](../../README.md) to a Memory Vault. `ContractEnforcedVault` wraps a vault adapter so that every write, read, and export is checked against the governing contract before it reaches storage. An in-memory `MockMemoryVaultAdapter` is included for tests and local development.

```typescript
import { LearningContractsSystem, BoundaryMode } from 'learning-contracts';
import { ContractEnforcedVault, MockMemoryVaultAdapter } from '@learning-contracts/vault-adapter';

const system = new LearningContractsSystem();
const vault = new ContractEnforcedVault({
  adapter: new MockMemoryVaultAdapter(),
  contractResolver: (id) => system.getContract(id),
  contractFinder: (domain, context, tool) => system.findApplicableContract(domain, context, tool),
  boundaryMode: BoundaryMode.NORMAL,
});

// ...

system.destroy();
```

## Development

From the repository root:

```bash
npm install            # builds the root package via `prepare`
npm run build:all      # builds root + workspace packages
npm test --workspaces  # runs the package tests
```
