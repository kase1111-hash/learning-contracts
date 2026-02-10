# Learning Contracts

> Explicit, enforceable agreements governing what an AI assistant is allowed to learn, how it may generalize that learning, how long it may retain it, and under what conditions it may be recalled or revoked.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Nothing is learned by default.**

**v0.1.0** - Part of the [Agent OS](https://github.com/kase1111-hash/Agent-OS) ecosystem.

## Quick Start

```typescript
import {
  LearningContractsSystem,
  BoundaryMode,
  RetentionDuration,
} from 'learning-contracts';

// 1. Create the system
const system = new LearningContractsSystem();

// 2. Create a contract — "Alice allows the assistant to learn coding tips for 30 days"
const contract = system.createEpisodicContract('alice', {
  domains: ['coding'],
  contexts: ['project-alpha'],
}, {
  classificationCap: 3,
  retention: RetentionDuration.TIMEBOUND,
  retentionUntil: new Date('2026-12-31'),
});

// 3. Activate it (Draft → Review → Active)
let active = system.submitForReview(contract.contract_id, 'alice');
active = system.activateContract(active.contract_id, 'alice');

// 4. Before storing any memory, check enforcement
const canStore = system.checkMemoryCreation(
  active.contract_id,
  BoundaryMode.NORMAL,
  2, // classification level
  { domain: 'coding', context: 'project-alpha' }
);

if (canStore.allowed) {
  console.log('Memory creation permitted under contract', active.contract_id);
} else {
  console.log('Denied:', canStore.reason);
}
```

**What just happened?** You created an explicit consent agreement that governs what an AI can learn. Without an active contract, all learning operations are denied (fail-closed). The contract specifies scope (coding, in project-alpha), classification limits, and a retention window. The enforcement engine checks every memory operation against these rules before it can proceed.

## Core Principles

1. **Explicit Consent** - Learning requires an affirmative contract
2. **Scope Before Storage** - Permissions are bound *before* memory creation
3. **Revocability** - Forgetting is a first-class operation
4. **Non-Emergence by Default** - No silent generalization
5. **Human Supremacy** - The owner can override or nullify any contract
6. **Composable with Security** - Contracts stack with Vault + Boundary systems

## Contract Types

### 1. Observation Contract
May observe signals. **May NOT** store memory. **May NOT** generalize.

```typescript
const contract = system.createObservationContract('user', {
  domains: ['finance'],
});
```

### 2. Episodic Learning Contract
May store specific episodes. No cross-context generalization.

```typescript
const contract = system.createEpisodicContract('user', {
  domains: ['personal'],
  contexts: ['journaling'],
}, {
  classificationCap: 3,
  retention: RetentionDuration.SESSION,
});
```

### 3. Procedural Learning Contract
May derive reusable heuristics, scope-limited.

```typescript
const contract = system.createProceduralContract('user', {
  domains: ['coding'],
  contexts: ['web-development'],
}, {
  generalizationConditions: [
    'Within coding domain only',
    'No cross-project application',
  ],
});
```

### 4. Strategic Learning Contract
May infer long-term strategies. **Requires high-trust boundary mode.**

```typescript
const contract = system.createStrategicContract('user', {
  domains: ['business', 'strategy'],
}, {
  classificationCap: 4,
});
```

### 5. Prohibited Domain Contract
Explicitly forbids learning. **Overrides all other contracts.**

```typescript
const contract = system.createProhibitedContract('user', {
  domains: ['medical', 'financial', 'legal'],
});
```

## Contract Lifecycle

```
Draft -> Review -> Active -> Expired | Revoked | Amended
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
  contractId, BoundaryMode.NORMAL, classification,
  { domain: 'coding', context: 'project-x', tool: 'editor' }
);
```

### 2. During Abstraction (Generalization Gate)
```typescript
const result = system.checkAbstraction(
  contractId, BoundaryMode.NORMAL, AbstractionLevel.HEURISTIC,
  { domain: 'coding' }
);
```

### 3. Before Recall (Scope Revalidation)
```typescript
const result = system.checkRecall(
  contractId, BoundaryMode.TRUSTED,
  { domain: 'coding', context: 'project-x' }
);
```

### 4. During Export (Transfer Prohibition)
```typescript
const result = system.checkExport(contractId, BoundaryMode.NORMAL);
```

**Violation results in hard failure, not warning.**

## Default Rules (Fail-Closed)

| Rule | Default |
|------|---------|
| No contract | No learning |
| Ambiguous scope | Deny |
| Unspecified dimension | Deny |
| Expired contract | Freeze memory |
| Revoked contract | Tombstone memory |

## Revocation & Forgetting

Revocation does NOT delete audit traces.

```typescript
// Revoke contract
const revoked = system.revokeContract(contractId, 'user', 'Privacy concerns');

// Tombstone memories (marks as inaccessible)
const result = system.tombstoneMemories(contractId, memories);

// Deep purge (requires owner ceremony with cryptographic token)
import { generatePurgeToken } from 'learning-contracts';
const token = generatePurgeToken(contractId, 'user');
const purged = system.deepPurge(contractId, memories, {
  owner: 'user',
  confirmation_token: token,
  timestamp: new Date(),
});
```

## Subsystems

The system exposes subsystems as public properties for direct access:

### Session Management

```typescript
// Start a session
const session = system.sessions.startSession('alice');

// Create and associate a session-scoped contract
let contract = system.createEpisodicContract('alice', {
  domains: ['coding'],
}, { retention: RetentionDuration.SESSION });
contract = system.submitForReview(contract.contract_id, 'alice');
contract = system.activateContract(contract.contract_id, 'alice');
system.sessions.associateContract(session.session_id, contract.contract_id);

// End session - automatically expires session-scoped contracts
const result = system.sessions.endSession(session.session_id);
```

### Plain-Language Contract Builder

```typescript
// Start a guided conversation
const response = system.conversations.startConversation('alice');
console.log(response.message);

// Process natural language input
const result = system.conversations.processInput(
  response.conversationId!,
  'Learn coding best practices from my Python sessions permanently'
);

// Use a template
system.conversations.useTemplate(response.conversationId!, 'coding-best-practices');

// When complete, create the contract
if (result.isComplete && result.draft) {
  const contract = system.createContractFromPlainLanguage(result.draft);
}
```

### Contract Summaries

```typescript
// Full summary
const summary = system.getContractSummary(contractId, { format: 'prose' });

// Short summary
const short = system.getContractShortSummary(contractId);
// "Procedural Learning for coding (Active)"
```

### Natural Language Parsing

```typescript
const parsed = system.parser.parse(
  'Never learn anything about my medical or financial records'
);
console.log(parsed.intent.contractType); // 'prohibited'
console.log(parsed.intent.domains);      // ['medical', 'finance']
```

### Emergency Override

```typescript
// Trigger emergency override (blocks all learning operations)
const override = system.triggerEmergencyOverride('admin', 'Security incident');

// Disable override
system.emergencyOverride.disableOverride('admin', 'Incident resolved');
```

### Timebound Expiry

```typescript
// Manually check for expired timebound contracts
const expiryResult = system.expiry.checkAndExpire(contractId);

// Run expiry cycle across all contracts
const cycleResult = system.expiry.runExpiryCycle();
```

## Audit & Compliance

All operations are logged for compliance and transparency:

```typescript
const auditLog = system.getAuditLog();
const history = system.getContractHistory(contractId);
const violations = system.getViolations();
```

## Error Handling

All errors thrown by the system are structured `ContractError` instances with error codes, severity levels, and context:

```typescript
import { ContractError, ErrorCode } from 'learning-contracts';

try {
  system.activateContract('nonexistent', 'alice');
} catch (error) {
  if (error instanceof ContractError) {
    console.log(error.code);     // ErrorCode.CONTRACT_NOT_FOUND
    console.log(error.context);  // { contract_id: 'nonexistent', ... }
    console.log(error.severity); // ErrorSeverity.MEDIUM
  }
}
```

## Integration Adapters

Integration with external systems is available as separate packages:

- **`@learning-contracts/vault-adapter`** - Memory Vault integration (contract-enforced memory storage)
- **`@learning-contracts/boundary-adapter`** - Boundary Daemon integration (trust enforcement layer)

These packages provide typed adapter interfaces for implementing production integrations with the Memory Vault and Boundary Daemon systems.

## API Reference

### LearningContractsSystem

```typescript
class LearningContractsSystem {
  // Subsystems (direct access)
  readonly sessions: SessionManager
  readonly expiry: TimeboundExpiryManager
  readonly emergencyOverride: EmergencyOverrideManager
  readonly users: UserManager
  readonly permissions: PermissionManager
  readonly conversations: ConversationalContractBuilder
  readonly summarizer: PlainLanguageSummarizer
  readonly parser: PlainLanguageParser

  // Contract creation
  createContract(draft: ContractDraft): LearningContract
  createObservationContract(createdBy, scope?): LearningContract
  createEpisodicContract(createdBy, scope?, options?): LearningContract
  createProceduralContract(createdBy, scope?, options?): LearningContract
  createStrategicContract(createdBy, scope?, options?): LearningContract
  createProhibitedContract(createdBy, scope?): LearningContract

  // Lifecycle
  submitForReview(contractId, actor): LearningContract
  activateContract(contractId, actor): LearningContract
  revokeContract(contractId, actor, reason): LearningContract
  amendContract(contractId, actor, changes, reason): { original, newDraft }

  // Enforcement hooks
  checkMemoryCreation(contractId, boundaryMode, classification, options?): EnforcementResult
  checkAbstraction(contractId, boundaryMode, targetAbstraction, options?): EnforcementResult
  checkRecall(contractId, boundaryMode, options?): EnforcementResult
  checkExport(contractId, boundaryMode): EnforcementResult

  // Memory management
  freezeMemories(contractId, memories): ForgettingResult
  tombstoneMemories(contractId, memories): ForgettingResult
  deepPurge(contractId, memories, ownerConfirmation): ForgettingResult

  // Queries
  getContract(contractId): LearningContract | null
  getAllContracts(): LearningContract[]
  getActiveContracts(): LearningContract[]
  findApplicableContract(domain?, context?, tool?): LearningContract | null

  // Audit
  getAuditLog(): AuditEvent[]
  getContractHistory(contractId): AuditEvent[]
  getViolations(): AuditEvent[]

  // Plain-language orchestration
  createContractFromPlainLanguage(draft): LearningContract
  getContractSummary(contractId, options?): string | null
  getContractShortSummary(contractId): string | null

  // Emergency override orchestration
  triggerEmergencyOverride(triggeredBy, reason): OverrideTriggerResult

  // Cross-subsystem queries
  getContractsForUser(userId): LearningContract[]
  getOwnedContracts(userId): LearningContract[]

  // Maintenance
  expireOldContracts(actor?): LearningContract[]
  configureRateLimit(config): void
  getRateLimitStatus(userId): { remaining, resetMs }
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
npm install          # Install dependencies
npm run build        # Build
npm test             # Run tests
npm run lint         # Lint
npm run typecheck    # Type check
```

## Connected Repositories

Part of the [Agent-OS](https://github.com/kase1111-hash/Agent-OS) ecosystem:
[boundary-daemon](https://github.com/kase1111-hash/boundary-daemon-) |
[memory-vault](https://github.com/kase1111-hash/memory-vault) |
[Boundary-SIEM](https://github.com/kase1111-hash/Boundary-SIEM) |
[value-ledger](https://github.com/kase1111-hash/value-ledger) |
[synth-mind](https://github.com/kase1111-hash/synth-mind)

## License

MIT - See LICENSE file for details.

---

**Remember**: Nothing is learned by default. Every byte of learning requires explicit, revocable consent.
