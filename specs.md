# Learning Contracts Specification

> Version 6.0 | Last Updated: 2025-12-23

## Table of Contents

1. [Purpose](#1-purpose)
2. [Design Principles](#2-design-principles)
3. [Contract Lifecycle](#3-contract-lifecycle)
4. [Contract Types](#4-contract-types)
5. [Learning Scope Dimensions](#5-learning-scope-dimensions)
6. [Contract Creation](#6-contract-creation)
7. [Enforcement Points](#7-enforcement-points)
8. [Default Rules (Fail-Closed)](#8-default-rules-fail-closed)
9. [Revocation & Forgetting](#9-revocation--forgetting)
10. [Memory Vault Integration](#10-memory-vault-integration)
11. [Boundary Daemon Integration](#11-boundary-daemon-integration)
12. [Session Management](#12-session-management)
13. [Timebound Auto-Expiry](#13-timebound-auto-expiry)
14. [Threat Model](#14-threat-model)
15. [Human UX Requirements](#15-human-ux-requirements)
16. [Non-Goals](#16-non-goals)
17. [Implementation Status](#17-implementation-status)

---

## 1. Purpose

Learning Contracts define explicit, enforceable agreements that govern what a learning co-worker/assistant is allowed to learn from interactions with you, how (or if) it may generalize that learning, how long it may retain it, and under what conditions it may be recalled or revoked.

If the Memory Vault is secure storage and the Boundary Daemon defines trusted space, then Learning Contracts are **explicit consent for cognition**.

**Nothing is learned by default.**

---

## 2. Design Principles

| Principle | Description |
|-----------|-------------|
| **Explicit Consent** | All learning requires an affirmative, human-approved contract |
| **Scope Before Storage** | Permissions must be clearly defined and approved before any memory is created |
| **Revocability** | Forgetting is a first-class, easy-to-use operation |
| **Non-Emergence by Default** | No silent or automatic generalization is ever allowed |
| **Human Supremacy** | The human owner can override, amend, or nullify any contract at any time |
| **Composable with Security** | Contracts seamlessly stack with the Memory Vault and Boundary Daemon |

---

## 3. Contract Lifecycle

```
Draft → Review → Active → Expired | Revoked | Amended
```

All lifecycle transitions are **permanently logged** in an irreversible audit history.

### State Transitions

| From | To | Description |
|------|-----|-------------|
| Draft | Review | Contract submitted for human review |
| Review | Active | Human approves and activates contract |
| Review | Draft | Human requests changes |
| Active | Expired | Contract reaches expiration time |
| Active | Revoked | Human explicitly revokes contract |
| Active | Amended | Human amends contract (creates new draft) |

---

## 4. Contract Types

### 4.1 Observation Contract
- May passively observe interactions
- May **NOT** store any memory
- May **NOT** generalize

### 4.2 Episodic Learning Contract
- May store specific, individual episodes or events
- No cross-context or cross-episode generalization allowed

### 4.3 Procedural Learning Contract
- May derive reusable heuristics or patterns
- Always limited to the approved scope
- Maximum abstraction: Heuristic level

### 4.4 Strategic Learning Contract
- May infer longer-term strategies
- **Requires high-trust boundary mode** (Trusted or Privileged)
- Maximum abstraction: Strategy level

### 4.5 Prohibited Domain Contract
- Explicitly forbids all learning in a specified domain or context
- **Overrides any other contract**
- Cannot be revoked (only expires)

---

## 5. Learning Scope Dimensions

Every contract clearly defines its boundaries across these dimensions:

| Dimension | Description | Default |
|-----------|-------------|---------|
| **Domain** | Subject areas (e.g., programming, gaming, finance, personal life) | Deny |
| **Temporal** | Duration (session-only, time-bound, permanent until revoked) | Deny |
| **Contextual** | Specific contexts (project, live streaming, particular toolchains) | Deny |
| **Abstraction Level** | Maximum depth (raw data, patterns, heuristics, strategies) | Deny |
| **Transferability** | Whether knowledge may ever leave this system | Deny (always "no" by default) |

**Any dimension left unspecified defaults to deny.**

---

## 6. Contract Creation

### 6.1 Programmatic Creation

Contracts can be created via the TypeScript API:

```typescript
import { LearningContractsSystem, BoundaryMode } from 'learning-contracts';

const system = new LearningContractsSystem();

// Create an episodic learning contract
const contract = system.createEpisodicContract('user', {
  domains: ['coding', 'debugging'],
  contexts: ['project-alpha'],
  tools: ['editor', 'debugger']
}, {
  classificationCap: 3,
  retention: 'timebound',
  retentionUntil: new Date('2025-12-31')
});

// Submit for review and activate
let active = system.submitForReview(contract.contract_id, 'user');
active = system.activateContract(active.contract_id, 'user');
```

### 6.2 Plain-Language Creation (Specification)

Contracts should be creatable and manageable in plain, human-readable language:

1. Users describe their intent conversationally (spoken or typed)
2. An LLM translates the user's plain-language instructions into precise internal rules
3. The underlying technical schema (JSON-like structure) exists only in the background
4. At every step (draft, review, activation), the system presents the contract back as a clear, plain-language summary

**Example plain-language presentation:**
> "You allow the assistant to learn and reuse coding best practices from your Python sessions in personal projects using VS Code. These tips will be stored permanently and applied automatically in similar future sessions. Nothing will be shared outside this system. You can revoke this contract at any time."

---

## 7. Enforcement Points

Contracts are strictly enforced at **four mandatory checkpoints**:

### 7.1 Before Memory Creation
- Permission and scope check
- Classification level validation
- Contract must be active

```typescript
const result = system.checkMemoryCreation(
  contractId,
  BoundaryMode.NORMAL,
  classification,
  { domain: 'coding', context: 'project-x' }
);
```

### 7.2 During Abstraction (Generalization Gate)
- Blocks if generalization not allowed
- Validates abstraction level against contract cap

```typescript
const result = system.checkAbstraction(
  contractId,
  BoundaryMode.NORMAL,
  AbstractionLevel.HEURISTIC,
  { domain: 'coding' }
);
```

### 7.3 Before Recall
- Scope and rules revalidation
- Boundary mode verification
- Owner presence validation

```typescript
const result = system.checkRecall(
  contractId,
  BoundaryMode.TRUSTED,
  { domain: 'coding', context: 'project-x', requester: 'user' }
);
```

### 7.4 During Export or Transfer
- Prohibition of unauthorized sharing
- Transferability check

```typescript
const result = system.checkExport(contractId, BoundaryMode.NORMAL);
```

**Any violation triggers an immediate hard failure** (no learning occurs, no warning-only mode).

---

## 8. Default Rules (Fail-Closed)

| Condition | Behavior |
|-----------|----------|
| No active contract | No learning permitted |
| Ambiguous scope | Deny learning |
| Expired contract | Associated memories are automatically frozen |
| Revoked contract | Associated memories are tombstoned (marked inaccessible) |

---

## 9. Revocation & Forgetting

Revocation **never deletes audit traces** or lifecycle logs.

### Immediate Effects of Revocation

1. Existing memories marked inaccessible (tombstoned)
2. Any derived memories quarantined
3. Learned heuristics invalidated
4. Audit traces preserved

### Forgetting Operations

| Operation | Trigger | Effect |
|-----------|---------|--------|
| **Freeze** | Contract expiration | Memory preserved but inaccessible |
| **Tombstone** | Contract revocation | Memory marked deleted, derived quarantined |
| **Deep Purge** | Owner ceremony | Permanent deletion (requires confirmation) |

```typescript
// Revoke contract
const revoked = system.revokeContract(contractId, 'user', 'Privacy concerns');

// Tombstone memories
const result = system.tombstoneMemories(contractId, memories);

// Deep purge (requires owner ceremony)
const purged = system.deepPurge(contractId, memories, {
  owner: 'user',
  confirmation_token: 'token-xyz',
  timestamp: new Date()
});
```

---

## 10. Memory Vault Integration

Learning Contracts integrate with the Memory Vault storage system through the `ContractEnforcedVault` wrapper:

| Integration Point | Description |
|-------------------|-------------|
| Contract ID in Memory Objects | Every stored Memory Object carries the ID of its governing contract |
| Classification Cap | Memory classification cannot exceed the contract's allowed cap |
| Write Gate | The Vault refuses to write any memory without a valid, active contract |
| Domain/Context Scope | All operations validated against contract scope |
| Boundary Mode Enforcement | Strategic contracts require TRUSTED or higher mode |
| Automatic Contract Discovery | Vault can find applicable contract based on domain/context |

### Usage

```typescript
import { LearningContractsSystem, MockMemoryVaultAdapter, BoundaryMode, ClassificationLevel } from 'learning-contracts';

const system = new LearningContractsSystem();
const adapter = new MockMemoryVaultAdapter(); // Or production adapter

// Create contract-enforced vault
const vault = system.createContractEnforcedVault(adapter, BoundaryMode.NORMAL, 'agent');

// Store with enforcement
const result = await vault.storeMemory({
  content: 'Learned pattern',
  classification: ClassificationLevel.LOW,
  domain: 'coding',
}, contract.contract_id);

// Recall with enforcement
const recall = await vault.recallMemory({
  memory_id: result.result.memory_id,
  requester: 'user',
  justification: 'Review needed',
});
```

### Available Adapters

- **MemoryVaultAdapter** - Interface for implementing production adapters
- **MockMemoryVaultAdapter** - In-memory adapter for testing
- **BaseMemoryVaultAdapter** - Abstract base class with common functionality

---

## 11. Boundary Daemon Integration

Learning Contracts integrate with the Boundary Daemon through the `BoundaryEnforcedSystem` wrapper, providing automatic contract suspension based on boundary mode changes.

### Boundary Modes

The Boundary Daemon defines six security modes (least to most restrictive):

| Mode | Description | Classification Cap |
|------|-------------|-------------------|
| OPEN | Full network access | 1 |
| RESTRICTED | Limited network, monitored | 2 |
| TRUSTED | VPN/encrypted only | 3 |
| AIRGAP | No network, local only | 4 |
| COLDROOM | Encrypted storage only | 5 |
| LOCKDOWN | Emergency shutdown | -1 (none) |

### Contract Mode Requirements

| Contract Type | Minimum Boundary Mode |
|---------------|----------------------|
| Strategic Learning | Trusted or Privileged |
| Procedural Learning | Normal or higher |
| Episodic Learning | Normal or higher |
| Observation | Normal or higher |
| Prohibited | Restricted (any mode) |

### Automatic Contract Suspension

**Downgrading the boundary automatically suspends learning** under affected contracts:

- When boundary mode decreases, contracts requiring higher modes are suspended
- When boundary upgrades, suspended contracts are automatically resumed
- LOCKDOWN mode suspends ALL contracts immediately
- All suspension/resume events are logged to the audit trail

### Gate Enforcement

| Gate | Purpose |
|------|---------|
| **RecallGate** | Validates memory recall against classification caps |
| **ToolGate** | Validates tool execution against network requirements |

### Usage

```typescript
import { LearningContractsSystem, MockBoundaryDaemonAdapter, DaemonBoundaryMode } from 'learning-contracts';

const system = new LearningContractsSystem();
const adapter = new MockBoundaryDaemonAdapter();

// Create boundary-enforced system
const boundarySystem = system.createBoundaryEnforcedSystem(adapter);
await boundarySystem.initialize();

// Check if contract can operate in current mode
const canOperate = boundarySystem.canContractOperate(contract);

// Check recall gate before memory access
const recallResult = await boundarySystem.checkRecallGate({
  memory_id: 'mem-123',
  memory_class: 3,
  requester: 'user',
});

// Check tool gate before tool execution
const toolResult = await boundarySystem.checkToolGate({
  tool_name: 'web-search',
  requires_network: true,
});

// Listen for suspension events
boundarySystem.onSuspension((event) => {
  console.log(`Contract ${event.contract_id} suspended: ${event.reason}`);
});

// Trigger emergency lockdown
await boundarySystem.triggerLockdown('Security breach detected', 'admin');
```

### Available Adapters

- **BoundaryDaemonAdapter** - Interface for implementing production adapters
- **MockBoundaryDaemonAdapter** - In-memory adapter for testing
- **BaseBoundaryDaemonAdapter** - Abstract base class with common functionality

---

## 12. Session Management

Session management provides automatic cleanup of session-scoped contracts when sessions end.

### Session Lifecycle

```
Start → Active → Ended | Expired
```

### Session Features

| Feature | Description |
|---------|-------------|
| Session Creation | Start a new session for a user |
| Contract Association | Associate session-scoped contracts with a session |
| Automatic Cleanup | Expire contracts and freeze memories when session ends |
| Session Timeout | Automatic expiration after configurable timeout |
| Multi-User Support | Track sessions per user |

### Session-Scoped Contracts

Contracts with `retention: 'session'` can be associated with a session:

- When the session ends, the contract is automatically expired
- Associated memories are frozen (marked inaccessible)
- All cleanup events are logged to the audit trail

### Usage

```typescript
import { LearningContractsSystem } from 'learning-contracts';

const system = new LearningContractsSystem();

// Start a session
const session = system.startSession('alice', { project: 'my-project' });

// Create a session-scoped contract
let contract = system.createEpisodicContract('alice', {
  domains: ['coding'],
}, { retention: 'session' });
contract = system.submitForReview(contract.contract_id, 'alice');
contract = system.activateContract(contract.contract_id, 'alice');

// Associate contract with session
system.associateContractWithSession(session.session_id, contract.contract_id);

// Listen for session end events
system.onSessionEnd((session, result) => {
  console.log(`Session ${session.session_id} ended`);
  console.log(`Contracts cleaned: ${result.contracts_cleaned.length}`);
});

// End session - automatically cleans up contracts
const result = system.endSession(session.session_id);
```

---

## 13. Timebound Auto-Expiry

Timebound auto-expiry provides automatic enforcement of `retention_until` timestamps for contracts with timebound retention.

### How It Works

1. Contracts with `retention: 'timebound'` have a `retention_until` timestamp
2. The expiry manager periodically checks for expired contracts
3. When `retention_until` passes, the contract is automatically expired
4. Associated memories are frozen (marked inaccessible)
5. All expiry events are logged to the audit trail

### Automatic vs Manual Checking

| Mode | Description |
|------|-------------|
| **Automatic** | Periodic checks at configurable intervals |
| **Manual** | On-demand cycle via `runTimeboundExpiryCycle()` |

### Usage

```typescript
import { LearningContractsSystem } from 'learning-contracts';

const system = new LearningContractsSystem();

// Start automatic expiry checking
system.startTimeboundExpiryChecks();

// Configure check interval (default: 1 minute)
system.setTimeboundExpiryInterval(30000); // 30 seconds

// Check a specific contract without expiring (dry run)
const check = system.checkTimeboundExpiry(contract.contract_id);
if (check?.expired) {
  console.log('Contract has expired retention');
}

// Force expire a specific contract immediately
const result = system.forceTimeboundExpiry(contract.contract_id);

// Run a manual expiry cycle
const cycleResult = system.runTimeboundExpiryCycle();
console.log(`Expired ${cycleResult.contracts_expired} contracts`);

// Listen for individual expiry events
system.onTimeboundExpiry((contract, result) => {
  console.log(`Contract ${contract.contract_id} expired`);
});

// Listen for cycle completion
system.onExpiryCycleComplete((result) => {
  console.log(`Cycle completed: ${result.contracts_checked} checked`);
});

// Get statistics
const stats = system.getTimeboundExpiryStats();
console.log(`Total expired: ${stats.totalContractsExpired}`);

// Stop automatic checking
system.stopTimeboundExpiryChecks();
```

### Statistics

The expiry manager tracks:

| Stat | Description |
|------|-------------|
| `isRunning` | Whether automatic checking is active |
| `lastCheckAt` | Timestamp of last check |
| `nextCheckAt` | Estimated next check time |
| `cyclesCompleted` | Total check cycles completed |
| `totalContractsExpired` | Total contracts expired |
| `totalMemoriesAffected` | Total memories frozen |
| `totalErrors` | Total errors encountered |

---

## 14. Threat Model

| Threat | Mitigation |
|--------|------------|
| Silent over-learning | Explicit abstraction caps & plain-language review |
| Concept drift | Time-bound contracts & expiration |
| Knowledge laundering | Strict non-transferable defaults |
| Model curiosity | Observation-only contracts available |
| Owner over-sharing | Clear plain-language summaries & confirmation requirements |

---

## 15. Human UX Requirements

1. All contracts must be presented and editable in clear, plain language
2. Every change (creation, amendment, revocation) requires explicit human confirmation
3. All active contracts are continuously visible in the interface
4. No dark patterns, no pre-checked boxes, no implicit or assumed consent
5. Emergency "pause all learning" override available at all times

---

## 16. Non-Goals

The following are explicitly **NOT** goals of Learning Contracts:

- Autonomous contract creation by the assistant
- Self-expanding or auto-renewing permissions
- Retroactive consent for past interactions

---

## 17. Implementation Status

### Fully Implemented

| Feature | Status | Location |
|---------|--------|----------|
| Five contract types | ✅ Complete | `src/contracts/factory.ts` |
| Contract lifecycle management | ✅ Complete | `src/contracts/lifecycle.ts` |
| Contract validation | ✅ Complete | `src/contracts/validator.ts` |
| Four enforcement hooks | ✅ Complete | `src/enforcement/engine.ts` |
| Scope validation (domains, contexts, tools) | ✅ Complete | `src/enforcement/engine.ts` |
| Memory permissions | ✅ Complete | `src/types/contract.ts` |
| Generalization rules | ✅ Complete | `src/types/contract.ts` |
| Recall rules with boundary mode | ✅ Complete | `src/enforcement/engine.ts` |
| Memory forgetting (freeze, tombstone, purge) | ✅ Complete | `src/memory/forgetting.ts` |
| Heuristics invalidation on revocation | ✅ Complete | `src/memory/forgetting.ts` |
| Manual contract expiration triggering | ✅ Complete | `src/system.ts` |
| Comprehensive audit logging | ✅ Complete | `src/audit/logger.ts` |
| Contract storage and queries | ✅ Complete | `src/storage/repository.ts` |
| Fail-closed default behavior | ✅ Complete | `src/enforcement/engine.ts` |
| TypeScript type definitions | ✅ Complete | `src/types/` |
| Plain-Language Interface | ✅ Complete | `src/plain-language/` |
| Natural language parsing | ✅ Complete | `src/plain-language/parser.ts` |
| Contract templates (7 templates) | ✅ Complete | `src/plain-language/templates.ts` |
| Plain-language summaries | ✅ Complete | `src/plain-language/summarizer.ts` |
| Conversational contract builder | ✅ Complete | `src/plain-language/builder.ts` |
| Memory Vault Integration | ✅ Complete | `src/vault-integration/` |
| ContractEnforcedVault wrapper | ✅ Complete | `src/vault-integration/enforced-vault.ts` |
| MemoryVaultAdapter interface | ✅ Complete | `src/vault-integration/adapter.ts` |
| MockMemoryVaultAdapter | ✅ Complete | `src/vault-integration/adapter.ts` |
| Vault audit logging | ✅ Complete | `src/system.ts` |
| Boundary Daemon Integration | ✅ Complete | `src/boundary-integration/` |
| BoundaryEnforcedSystem wrapper | ✅ Complete | `src/boundary-integration/enforced-system.ts` |
| BoundaryDaemonAdapter interface | ✅ Complete | `src/boundary-integration/adapter.ts` |
| MockBoundaryDaemonAdapter | ✅ Complete | `src/boundary-integration/adapter.ts` |
| Automatic contract suspension | ✅ Complete | `src/boundary-integration/enforced-system.ts` |
| RecallGate & ToolGate enforcement | ✅ Complete | `src/boundary-integration/enforced-system.ts` |
| Boundary audit logging | ✅ Complete | `src/system.ts` |
| Session Management | ✅ Complete | `src/session/` |
| SessionManager | ✅ Complete | `src/session/manager.ts` |
| Session retention cleanup | ✅ Complete | `src/session/manager.ts` |
| Session audit logging | ✅ Complete | `src/audit/logger.ts` |
| Timebound Auto-Expiry | ✅ Complete | `src/expiry/` |
| TimeboundExpiryManager | ✅ Complete | `src/expiry/manager.ts` |
| Automatic periodic expiry checks | ✅ Complete | `src/expiry/manager.ts` |
| Timebound expiry statistics | ✅ Complete | `src/expiry/manager.ts` |
| Owner Presence Validation | ✅ Complete | `src/enforcement/engine.ts` |

### Not Implemented

| Feature | Priority | Description |
|---------|----------|-------------|
| Active Contracts Dashboard | Medium | UI for "all active contracts continuously visible" |
| Emergency Override System | Medium | "Pause all learning" command for human supremacy |
| Persistent Storage Backend | Low | Currently in-memory only; needs database integration |
| Multi-User Support | Low | Contract ownership and permission sharing |

---

## Related Systems

Learning Contracts is part of a larger ecosystem:

| System | Description |
|--------|-------------|
| **Agent OS** | Locally-controlled, constitutionally-governed AI infrastructure |
| **Memory Vault** | Secure, offline-capable, owner-sovereign storage |
| **Boundary Daemon** | Hard enforcement layer for trust boundaries |
| **IntentLog** | Version control for human reasoning |
| **Value Ledger** | Accounting layer for meta-value from cognitive processes |

---

## Design Constraint

> Learning without explicit consent is surveillance.
> Intelligence without clear restraint is theft.

Learning Contracts exist to prevent both—by making consent simple, transparent, and always under human control.

---

## License

MIT - See LICENSE file for details
