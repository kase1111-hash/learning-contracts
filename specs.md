# Learning Contracts Specification

> Version 1.1 | Last Updated: 2025-12-23

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
12. [Threat Model](#12-threat-model)
13. [Human UX Requirements](#13-human-ux-requirements)
14. [Non-Goals](#14-non-goals)
15. [Implementation Status](#15-implementation-status)

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

```typescript
const result = system.checkRecall(
  contractId,
  BoundaryMode.TRUSTED,
  { domain: 'coding', context: 'project-x' }
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

Learning Contracts integrate with the Memory Vault storage system:

| Integration Point | Description |
|-------------------|-------------|
| Contract ID in Memory Objects | Every stored Memory Object carries the ID of its governing contract |
| Classification Cap | Memory classification cannot exceed the contract's allowed cap |
| Write Gate | The Vault refuses to write any memory without a valid, active contract |

---

## 11. Boundary Daemon Integration

Contracts integrate with boundary modes for trust-level enforcement:

| Contract Type | Minimum Boundary Mode |
|---------------|----------------------|
| Strategic Learning | Trusted or Privileged |
| Procedural Learning | Normal or higher |
| Episodic Learning | Normal or higher |
| Observation | Normal or higher |
| Prohibited | Restricted (any mode) |

**Downgrading the boundary automatically suspends learning** under affected contracts.

---

## 12. Threat Model

| Threat | Mitigation |
|--------|------------|
| Silent over-learning | Explicit abstraction caps & plain-language review |
| Concept drift | Time-bound contracts & expiration |
| Knowledge laundering | Strict non-transferable defaults |
| Model curiosity | Observation-only contracts available |
| Owner over-sharing | Clear plain-language summaries & confirmation requirements |

---

## 13. Human UX Requirements

1. All contracts must be presented and editable in clear, plain language
2. Every change (creation, amendment, revocation) requires explicit human confirmation
3. All active contracts are continuously visible in the interface
4. No dark patterns, no pre-checked boxes, no implicit or assumed consent
5. Emergency "pause all learning" override available at all times

---

## 14. Non-Goals

The following are explicitly **NOT** goals of Learning Contracts:

- Autonomous contract creation by the assistant
- Self-expanding or auto-renewing permissions
- Retroactive consent for past interactions

---

## 15. Implementation Status

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
| Comprehensive audit logging | ✅ Complete | `src/audit/logger.ts` |
| Contract storage and queries | ✅ Complete | `src/storage/repository.ts` |
| Fail-closed default behavior | ✅ Complete | `src/enforcement/engine.ts` |
| TypeScript type definitions | ✅ Complete | `src/types/` |

### Not Implemented

| Feature | Priority | Description |
|---------|----------|-------------|
| Plain-Language Interface | High | LLM translation of natural language to contracts; conversational creation flow |
| Memory Vault Integration | High | Actual Memory Vault storage system; currently only interfaces defined |
| Boundary Daemon Integration | High | Full Boundary Daemon component; automatic suspension on boundary downgrade |
| Session Retention Cleanup | Medium | Automatic cleanup when session-scoped contracts end |
| Timebound Auto-Expiry | Medium | Automatic enforcement of `retention_until` timestamps |
| Owner Presence Validation | Medium | `requires_owner` field defined but not enforced during recall |
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
