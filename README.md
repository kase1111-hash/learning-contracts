# Learning Contracts

> **Explicit, enforceable agreements governing what a learning co-worker/assistant is allowed to learn**

Learning Contracts define explicit consent for AI learning, how it may generalize that learning, how long it may retain it, and under what conditions it may be recalled or revoked.

**Nothing is learned by default.**

## Core Principles

1. **Explicit Consent** – Learning requires an affirmative contract
2. **Scope Before Storage** – Permissions are bound *before* memory creation
3. **Revocability** – Forgetting is a first-class operation
4. **Non-Emergence by Default** – No silent generalization
5. **Human Supremacy** – The owner can override or nullify any contract
6. **Composable with Security** – Contracts stack with Vault + Boundary systems

## Installation

```bash
npm install learning-contracts
```

## Quick Start

```typescript
import { LearningContractsSystem, BoundaryMode, AbstractionLevel } from 'learning-contracts';

// Initialize the system
const system = new LearningContractsSystem();

// Create an episodic learning contract
const contract = system.createEpisodicContract('alice', {
  domains: ['coding', 'debugging'],
  contexts: ['project-alpha'],
  tools: ['editor', 'debugger']
}, {
  classificationCap: 3,
  retention: 'timebound',
  retentionUntil: new Date('2025-12-31')
});

// Submit for review and activate
let active = system.submitForReview(contract.contract_id, 'alice');
active = system.activateContract(active.contract_id, 'alice');

// Check if memory creation is allowed
const canStore = system.checkMemoryCreation(
  active.contract_id,
  BoundaryMode.NORMAL,
  2, // classification level
  { domain: 'coding', context: 'project-alpha' }
);

if (canStore.allowed) {
  console.log('Memory creation permitted');
} else {
  console.log('Denied:', canStore.reason);
}
```

## Contract Types

### 1. Observation Contract
- May observe signals
- **May NOT** store memory
- **May NOT** generalize

```typescript
const contract = system.createObservationContract('user', {
  domains: ['finance']
});
```

### 2. Episodic Learning Contract
- May store specific episodes
- **No cross-context generalization**

```typescript
const contract = system.createEpisodicContract('user', {
  domains: ['personal'],
  contexts: ['journaling']
}, {
  classificationCap: 3,
  retention: 'session'
});
```

### 3. Procedural Learning Contract
- May derive reusable heuristics
- Scope-limited

```typescript
const contract = system.createProceduralContract('user', {
  domains: ['coding'],
  contexts: ['web-development']
}, {
  generalizationConditions: [
    'Within coding domain only',
    'No cross-project application'
  ]
});
```

### 4. Strategic Learning Contract
- May infer long-term strategies
- **Requires high-trust boundary mode**

```typescript
const contract = system.createStrategicContract('user', {
  domains: ['business', 'strategy']
}, {
  classificationCap: 4
});
```

### 5. Prohibited Domain Contract
- Explicitly forbids learning
- **Overrides all other contracts**

```typescript
const contract = system.createProhibitedContract('user', {
  domains: ['medical', 'financial', 'legal']
});
```

## Contract Lifecycle

```
Draft → Review → Active → Expired | Revoked | Amended
```

All transitions are logged and irreversible in audit history.

```typescript
// Create draft
let contract = system.createEpisodicContract('user', { domains: ['test'] });

// Submit for review
contract = system.submitForReview(contract.contract_id, 'user');

// Activate
contract = system.activateContract(contract.contract_id, 'user');

// Revoke (if needed)
contract = system.revokeContract(contract.contract_id, 'user', 'No longer needed');

// Amend (creates new draft from active contract)
const { original, newDraft } = system.amendContract(
  contract.contract_id,
  'user',
  { scope: { domains: ['updated'], contexts: [], tools: [] } },
  'Expanding scope'
);
```

## Enforcement Hooks

Learning Contracts are enforced at **four mandatory hooks**:

### 1. Before Memory Creation
```typescript
const result = system.checkMemoryCreation(
  contractId,
  BoundaryMode.NORMAL,
  classification,
  { domain: 'coding', context: 'project-x', tool: 'editor' }
);
```

### 2. During Abstraction (Generalization Gate)
```typescript
const result = system.checkAbstraction(
  contractId,
  BoundaryMode.NORMAL,
  AbstractionLevel.HEURISTIC,
  { domain: 'coding' }
);
```

### 3. Before Recall (Scope Revalidation)
```typescript
const result = system.checkRecall(
  contractId,
  BoundaryMode.TRUSTED,
  { domain: 'coding', context: 'project-x' }
);
```

### 4. During Export (Transfer Prohibition)
```typescript
const result = system.checkExport(
  contractId,
  BoundaryMode.NORMAL
);
```

**Violation results in hard failure, not warning.**

## Learning Scope Dimensions

Each contract defines its scope across five dimensions:

| Dimension       | Description                    | Default |
|-----------------|--------------------------------|---------|
| Domain          | Finance, design, personal, etc | Deny    |
| Temporal        | Session-only, time-bound       | Deny    |
| Contextual      | Project, toolchain             | Deny    |
| Abstraction     | Raw data → heuristic           | Deny    |
| Transferability | This system only               | Deny    |

**Unspecified dimensions default to deny (fail-closed).**

## Revocation & Forgetting

Revocation does NOT delete audit traces.

```typescript
// Revoke contract
const revoked = system.revokeContract(contractId, 'user', 'Privacy concerns');

// Tombstone memories (marks as inaccessible)
const result = system.tombstoneMemories(contractId, memories);

// Deep purge (requires owner ceremony)
const purged = system.deepPurge(contractId, memories, {
  owner: 'user',
  confirmation_token: 'token-xyz',
  timestamp: new Date()
});
```

### Effects of Revocation
- Memory marked inaccessible
- Derived memories quarantined
- Heuristics invalidated
- Audit traces preserved

## Audit & Compliance

All operations are logged for compliance and transparency:

```typescript
// Get complete audit log
const auditLog = system.getAuditLog();

// Get contract history
const history = system.getContractHistory(contractId);

// Get all violations
const violations = system.getViolations();
```

## Integration with Memory Vault

Learning Contracts are designed to integrate with a Memory Vault system:

- Contract ID is stored in every Memory Object
- Classification may not exceed contract cap
- Vault refuses writes without valid contract

## Integration with Boundary Daemon

Certain contract types require minimum boundary modes:

- **Strategic Learning** → requires Trusted or Privileged
- **Procedural Learning** → requires Normal or higher
- **Episodic Learning** → requires Normal or higher
- **Observation** → requires Normal or higher

Boundary downgrade suspends learning.

## Default Rules (Fail-Closed)

- **No contract** → no learning
- **Ambiguous scope** → deny
- **Expired contract** → freeze memory
- **Revoked contract** → tombstone memory

## API Reference

### Core System

```typescript
class LearningContractsSystem {
  // Contract creation
  createContract(draft: ContractDraft): LearningContract
  createObservationContract(createdBy: string, scope?: Partial<LearningScope>)
  createEpisodicContract(createdBy: string, scope?: Partial<LearningScope>, options?)
  createProceduralContract(createdBy: string, scope?: Partial<LearningScope>, options?)
  createStrategicContract(createdBy: string, scope?: Partial<LearningScope>, options?)
  createProhibitedContract(createdBy: string, scope?: Partial<LearningScope>)

  // Lifecycle
  submitForReview(contractId: string, actor: string): LearningContract
  activateContract(contractId: string, actor: string): LearningContract
  revokeContract(contractId: string, actor: string, reason: string): LearningContract
  amendContract(contractId: string, actor: string, changes, reason: string)

  // Enforcement
  checkMemoryCreation(contractId, boundaryMode, classification, options)
  checkAbstraction(contractId, boundaryMode, targetAbstraction, options)
  checkRecall(contractId, boundaryMode, options)
  checkExport(contractId, boundaryMode)

  // Memory management
  freezeMemories(contractId, memories)
  tombstoneMemories(contractId, memories)
  deepPurge(contractId, memories, ownerConfirmation)

  // Queries
  getContract(contractId): LearningContract | null
  getAllContracts(): LearningContract[]
  getActiveContracts(): LearningContract[]
  findApplicableContract(domain?, context?, tool?): LearningContract | null

  // Audit
  getAuditLog(): AuditEvent[]
  getContractHistory(contractId): AuditEvent[]
  getViolations(): AuditEvent[]
}
```

## Design Constraint

> Learning without consent is surveillance.
> Intelligence without restraint is theft.

Learning Contracts exist to prevent both.

## Non-Goals

- Autonomous contract creation
- Self-expanding permissions
- Retroactive consent

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint
npm run lint
```

## License

MIT - See LICENSE file for details

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass
2. Code follows existing patterns
3. Audit logging is comprehensive
4. Fail-closed by default
5. No dark patterns or implicit consent

## Related Projects

- **Memory Vault** - Storage system for learning memories
- **Boundary Daemon** - Spatial and temporal access control

---

**Remember**: Nothing is learned by default. Every byte of learning requires explicit, revocable consent.
