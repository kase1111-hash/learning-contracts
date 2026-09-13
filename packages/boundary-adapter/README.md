# @learning-contracts/boundary-adapter

Bridges [Learning Contracts](../../README.md) to a Boundary Daemon. `BoundaryEnforcedSystem` watches the daemon's boundary mode and automatically suspends contracts whose required mode is no longer met, resuming them when the mode is restored. A `MockBoundaryDaemonAdapter` is included for tests and local development.

```typescript
import { LearningContractsSystem } from 'learning-contracts';
import { BoundaryEnforcedSystem, MockBoundaryDaemonAdapter } from '@learning-contracts/boundary-adapter';

const system = new LearningContractsSystem();
const adapter = new MockBoundaryDaemonAdapter();
const boundary = new BoundaryEnforcedSystem({
  adapter,
  contractResolver: (id) => system.getContract(id),
  activeContractsProvider: () => system.getActiveContracts(),
});
await boundary.initialize();

// ...

boundary.destroy();
system.destroy();
```

## Development

From the repository root:

```bash
npm install            # builds the root package via `prepare`
npm run build:all      # builds root + workspace packages
npm test --workspaces  # runs the package tests
```
