# Learning Contracts

> **AI learning contracts and safe AI training protocols for controlled, consent-based machine learning**

[![CI](https://github.com/kase1111-hash/learning-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/kase1111-hash/learning-contracts/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/learning-contracts.svg)](https://www.npmjs.com/package/learning-contracts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Learning Contracts provide **learning boundary agreements** and **AI data governance** for safe AI education. These training safety contracts define explicit consent for what AI can learn, how it may generalize that learning, how long it may retain it, and under what conditions it may be recalled or revoked. Built for **controlled AI learning** with full AI learning permissions management and training data contracts.

**Nothing is learned by default.**

**v0.1.0-alpha** - Part of the [Agent OS](https://github.com/kase1111-hash/Agent-OS) ecosystem for **digital sovereignty** and **human-AI collaboration**, integrating with [Boundary-SIEM](https://github.com/kase1111-hash/Boundary-SIEM) and [Boundary Daemon](https://github.com/kase1111-hash/boundary-daemon-).

## What Problem Does This Solve?

- **How do I control what AI learns?** — Learning Contracts require explicit consent before any learning occurs
- **How do I ensure AI learning safety?** — Fail-closed design means ambiguous situations default to denying learning
- **How do I implement AI training governance?** — Complete audit trails, revocation rights, and scope limitations
- **What are my AI learning permissions?** — Define exactly which domains, contexts, and abstraction levels are permitted
- **How do I build a learning governance framework?** — Composable contracts that stack with security systems like Memory Vault and Boundary Daemon

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

## Plain-Language Interface

Create contracts using natural language instead of code:

```typescript
// Start a conversation
const response = system.startPlainLanguageConversation('alice');
console.log(response.message);
// "Let's create a Learning Contract. What would you like the assistant to learn about?"

// Describe what you want in plain language
const result = system.processConversationInput(
  conversationId,
  'Learn coding best practices from my Python sessions permanently'
);

// The system parses your intent and may ask clarifying questions
if (result.questions.length > 0) {
  // Answer questions...
}

// When complete, create the contract from the draft
if (result.isComplete && result.draft) {
  const contract = system.createContractFromPlainLanguage(result.draft);
}
```

### Using Templates

7 pre-built templates for common use cases:

```typescript
// Get all available templates
const templates = system.getContractTemplates();

// Search templates
const codingTemplates = system.searchContractTemplates('coding');

// Use a template in conversation
system.useTemplateInConversation(conversationId, 'coding-best-practices');
```

Available templates:
- **Coding Best Practices** - Learn reusable coding patterns
- **Gaming & Streaming** - Capture gameplay moments
- **Personal Journal** - Observation-only for private reflection
- **Work Projects** - Professional learning with protection
- **Prohibited Domains** - Block learning in sensitive areas
- **Study Sessions** - Capture learning insights
- **Strategic Planning** - Long-term strategy building

### Getting Contract Summaries

Convert contracts to plain language:

```typescript
// Full summary (prose or bullets)
const summary = system.getContractSummary(contractId, { format: 'prose' });
// "This is a Procedural Learning contract (active). You allow the assistant
//  to learn reusable tips and patterns and apply them in similar future
//  situations. This applies in coding. Memories are kept permanently..."

// Short summary
const short = system.getContractShortSummary(contractId);
// "Procedural Learning for coding (Active)"

// Bullet format with warnings
const detailed = system.getContractSummary(contractId, {
  format: 'bullets',
  includeWarnings: true,
  includeTechnical: true
});
```

### Parse Natural Language (No Conversation)

```typescript
const parsed = system.parseNaturalLanguage(
  'Never learn anything about my medical or financial records'
);

console.log(parsed.intent.contractType); // 'prohibited'
console.log(parsed.intent.domains);      // ['medical', 'finance']
console.log(parsed.suggestedTemplate);   // Prohibited Domains template
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

Learning Contracts integrate with the Memory Vault storage system to enforce contract rules on all memory operations.

### Creating a Contract-Enforced Vault

```typescript
import {
  LearningContractsSystem,
  MockMemoryVaultAdapter,
  BoundaryMode,
  ClassificationLevel
} from 'learning-contracts';

// Initialize system and vault adapter
const system = new LearningContractsSystem();
const adapter = new MockMemoryVaultAdapter(); // Or your production adapter

// Create a contract-enforced vault
const vault = system.createContractEnforcedVault(
  adapter,
  BoundaryMode.NORMAL,
  'my-agent'
);

// Create and activate a contract
let contract = system.createEpisodicContract('alice', {
  domains: ['coding'],
  contexts: ['project-x'],
});
contract = system.submitForReview(contract.contract_id, 'alice');
contract = system.activateContract(contract.contract_id, 'alice');

// Store memory with contract enforcement
const storeResult = await vault.storeMemory(
  {
    content: 'Learned a new coding pattern',
    classification: ClassificationLevel.LOW,
    domain: 'coding',
    context: 'project-x',
  },
  contract.contract_id
);

if (storeResult.success) {
  console.log('Memory stored:', storeResult.result?.memory_id);
} else {
  console.log('Denied:', storeResult.enforcement.reason);
}

// Recall memory with contract enforcement
const recallResult = await vault.recallMemory({
  memory_id: storeResult.result!.memory_id!,
  requester: 'alice',
  justification: 'Need to review pattern',
  domain: 'coding',
});
```

### Contract Enforcement Rules

The vault enforces these rules before any memory operation:

- **Contract must be active** - Draft, expired, or revoked contracts deny all operations
- **Classification cap** - Memory classification cannot exceed contract cap
- **Domain/context scope** - Operations must be within contract scope
- **Boundary mode** - Strategic contracts require TRUSTED or higher mode
- **No storage for observation contracts** - Observation contracts can only observe

### Automatic Contract Discovery

If you don't specify a contract_id, the vault will find an applicable contract:

```typescript
// Vault will find contract matching domain and context
const result = await vault.storeMemory({
  content: 'Data',
  classification: ClassificationLevel.LOW,
  domain: 'coding',
  context: 'project-x',
});
```

### Vault Adapters

The integration provides:

- **MemoryVaultAdapter** interface - For implementing production adapters
- **MockMemoryVaultAdapter** - In-memory adapter for testing
- **BaseMemoryVaultAdapter** - Abstract base class with common functionality

### Key Features

- Contract ID stored in every Memory Object
- Classification may not exceed contract cap
- Vault refuses writes without valid contract
- All operations logged for audit compliance
- Boundary mode changes are respected

## Integration with Boundary Daemon

Learning Contracts integrate with the Boundary Daemon to automatically suspend/resume contracts based on boundary mode changes.

### Creating a Boundary-Enforced System

```typescript
import {
  LearningContractsSystem,
  MockBoundaryDaemonAdapter,
  DaemonBoundaryMode
} from 'learning-contracts';

// Initialize system and boundary adapter
const system = new LearningContractsSystem();
const adapter = new MockBoundaryDaemonAdapter();

// Create a boundary-enforced system
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

// Listen for contract suspension/resume events
boundarySystem.onSuspension((event) => {
  console.log(`Contract ${event.contract_id} suspended: ${event.reason}`);
});

boundarySystem.onResume((event) => {
  console.log(`Contract ${event.contract_id} resumed`);
});

// Trigger emergency lockdown (suspends ALL contracts)
await boundarySystem.triggerLockdown('Security breach detected', 'admin');
```

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

- **Strategic Learning** → requires Trusted or Privileged
- **Procedural Learning** → requires Normal or higher
- **Episodic Learning** → requires Normal or higher
- **Observation** → requires Normal or higher

### Automatic Contract Suspension

- When boundary mode decreases, contracts requiring higher modes are suspended
- When boundary upgrades, suspended contracts are automatically resumed
- LOCKDOWN mode suspends ALL contracts immediately
- All suspension/resume events are logged to the audit trail

## Session Management

Sessions track active usage periods and provide automatic cleanup for session-scoped contracts.

### Basic Usage

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

// Use the contract during the session...

// End session - automatically expires contracts and freezes memories
const result = system.endSession(session.session_id);
console.log(`Contracts cleaned: ${result.contracts_cleaned.length}`);
```

### Session Features

- **Automatic Cleanup**: Session-scoped contracts are expired when session ends
- **Memory Freezing**: Memories under expired contracts are frozen
- **Session Timeout**: Sessions can auto-expire after configurable timeout
- **Multi-User**: Track sessions per user independently
- **Event Listeners**: Listen for session end events

### Session Methods

```typescript
// Start/end sessions
startSession(userId: string, metadata?: Record<string, unknown>): Session
endSession(sessionId: string, options?: SessionCleanupOptions): SessionEndResult
endUserSessions(userId: string, options?: SessionCleanupOptions): SessionEndResult[]

// Session queries
getSession(sessionId: string): Session | null
getActiveSessions(): Session[]
getUserSessions(userId: string): Session[]
getSessionStats(): SessionStats

// Contract association
associateContractWithSession(sessionId: string, contractId: string): boolean
getContractSession(contractId: string): string | null
isContractInSession(contractId: string): boolean

// Maintenance
expireTimedOutSessions(options?: SessionCleanupOptions): SessionEndResult[]
cleanupOldSessions(maxAgeMs?: number): number
```

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

  // Plain-Language Interface
  startPlainLanguageConversation(userId: string): BuilderResponse
  processConversationInput(conversationId, input): BuilderResponse
  useTemplateInConversation(conversationId, templateId): BuilderResponse
  createContractFromPlainLanguage(draft): LearningContract
  getContractSummary(contractId, options?): string | null
  getContractShortSummary(contractId): string | null
  parseNaturalLanguage(input): ParseResult
  getContractTemplates(): ContractTemplate[]
  searchContractTemplates(query): ContractTemplate[]

  // Memory Vault Integration
  createContractEnforcedVault(adapter, boundaryMode, defaultActor?): ContractEnforcedVault

  // Boundary Daemon Integration
  createBoundaryEnforcedSystem(adapter, autoResumeOnUpgrade?): BoundaryEnforcedSystem

  // Session Management
  startSession(userId, metadata?): Session
  endSession(sessionId, options?): SessionEndResult
  associateContractWithSession(sessionId, contractId): boolean
  getSessionStats(): SessionStats
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

## Error Handling

Learning Contracts provides structured error handling with SIEM integration:

```typescript
import {
  CentralErrorHandler,
  SIEMReporter,
  DaemonConnector,
  SecurityError,
  ErrorCode,
  ErrorSeverity
} from 'learning-contracts';

// Set up error handler with SIEM reporting
const errorHandler = new CentralErrorHandler({
  console_logging: true,
  siem_reporting: true,
  lockdown_on_critical: true,
});

// Connect to SIEM
const siem = new SIEMReporter({
  base_url: 'https://your-siem.example.com',
  api_key: 'your-api-key',
});
await siem.initialize();

// Wire up error reporting
errorHandler.setSiemReporter((events) => siem.reportErrors(events));

// Errors are automatically formatted and sent to SIEM
try {
  // ... operation that may fail
} catch (error) {
  await errorHandler.handleError(error);
}
```

### Error Categories

| Category | Description |
|----------|-------------|
| CONTRACT | Contract lifecycle errors |
| ENFORCEMENT | Policy enforcement failures |
| STORAGE | Persistence layer errors |
| AUTH | Authentication/authorization |
| NETWORK | Connection failures |
| SECURITY | Security violations |
| INTEGRATION | External system errors |

### Severity Levels

- **INFO** (0) - Normal operation events
- **LOW** (1) - Minor issues
- **MEDIUM** (2) - Functionality affected
- **HIGH** (3) - Core functionality affected
- **CRITICAL** (4) - System-threatening, triggers lockdown

## Boundary-SIEM Integration

Report security events to [Boundary-SIEM](https://github.com/kase1111-hash/Boundary-SIEM):

```typescript
import { SIEMReporter, SIEMEventType } from 'learning-contracts';

const siem = new SIEMReporter({
  base_url: 'https://siem.example.com',
  api_key: 'your-api-key',
  // Optional CEF endpoint for redundancy
  cef_endpoint: {
    host: 'siem.example.com',
    port: 514,
    protocol: 'udp',
  },
});

await siem.initialize();

// Report contract events
await siem.reportContractEvent({
  event_type: 'activated',
  contract_id: 'contract-123',
  contract_type: 'episodic',
  owner_id: 'alice',
  domains: ['coding'],
});

// Report enforcement events
await siem.reportEnforcementEvent({
  event_type: 'memory_creation',
  contract_id: 'contract-123',
  outcome: 'denied',
  boundary_mode: 'RESTRICTED',
  denial_reason: 'Classification exceeds cap',
});

// Report security violations (sent immediately)
await siem.reportSecurityViolation({
  violation_type: 'tampering_attempt',
  severity: ErrorSeverity.CRITICAL,
  description: 'Contract file integrity check failed',
  mitre_technique: 'T1565',
});

// Check SIEM health
const health = await siem.healthCheck();
console.log(`SIEM healthy: ${health.healthy}, latency: ${health.latency_ms}ms`);
```

### Supported Event Types

- **error** - System errors
- **security_violation** - Security incidents
- **contract** - Contract lifecycle events
- **enforcement** - Policy enforcement decisions
- **audit** - Audit log entries
- **connection** - System connectivity events

## Boundary Daemon Connector

Integrate with [Boundary Daemon](https://github.com/kase1111-hash/boundary-daemon-) for policy enforcement:

```typescript
import {
  DaemonConnector,
  PolicyOperation,
  DaemonClassificationLevel,
  DaemonBoundaryMode,
} from 'learning-contracts';

const daemon = new DaemonConnector({
  socket_path: '/var/run/boundary-daemon.sock',
  // Or use HTTP:
  // http_endpoint: 'https://daemon.example.com',
  auth_token: 'your-token',
});

// Connect and register
await daemon.connect();

// Request policy decision before operations
const decision = await daemon.checkPolicy(PolicyOperation.MEMORY_CREATE, {
  contract_id: 'contract-123',
  classification: DaemonClassificationLevel.CONFIDENTIAL,
  domain: 'coding',
});

if (decision.allowed) {
  // Proceed with operation
} else {
  console.log(`Denied: ${decision.reason}`);
  console.log(`Required mode: ${decision.required_mode}`);
}

// Check current boundary mode
const mode = daemon.getCurrentMode();
console.log(`Current mode: ${mode}`);

// Check if classification is allowed
const allowed = daemon.isClassificationAllowed(DaemonClassificationLevel.SENSITIVE);

// Listen for mode changes
daemon.setEventHandlers({
  onModeChange: (event) => {
    console.log(`Mode changed: ${event.previous_mode} → ${event.new_mode}`);
    if (event.suspend_contracts) {
      // Handle contract suspension
    }
  },
  onTripwire: (event) => {
    console.log(`Tripwire triggered: ${event.description}`);
  },
  onLockdown: (reason) => {
    console.log(`LOCKDOWN: ${reason}`);
  },
});

// Request component attestation
const attestation = await daemon.requestAttestation([
  'contract_enforcement',
  'memory_operations',
]);
if (attestation.success) {
  console.log(`Attestation token expires: ${attestation.expires_at}`);
}
```

### Boundary Modes

| Mode | Network | Classification Cap |
|------|---------|-------------------|
| OPEN | Full access | 1 (PUBLIC) |
| RESTRICTED | Limited, monitored | 2 (INTERNAL) |
| TRUSTED | VPN only | 3 (CONFIDENTIAL) |
| AIRGAP | None | 4 (SENSITIVE) |
| COLDROOM | None | 5 (RESTRICTED) |
| LOCKDOWN | None | -1 (No access) |

### Classification Levels

| Level | Value | Description |
|-------|-------|-------------|
| PUBLIC | 0 | Public information |
| INTERNAL | 1 | Internal use only |
| CONFIDENTIAL | 2 | Confidential |
| SENSITIVE | 3 | Sensitive |
| RESTRICTED | 4 | Restricted |
| CROWN_JEWEL | 5 | Highest protection |

## Connected Repositories

Learning Contracts is part of a larger ecosystem of tools for **digital sovereignty**, **intent preservation**, and **human-AI collaboration**.

### Agent-OS Ecosystem

The natural-language native operating system for AI agents:

- **[Agent-OS](https://github.com/kase1111-hash/Agent-OS)** - Natural language operating system for AI agents (NLOS)
- **[synth-mind](https://github.com/kase1111-hash/synth-mind)** - NLOS-based agent with psychological modules for emergent continuity and empathy
- **[boundary-daemon-](https://github.com/kase1111-hash/boundary-daemon-)** - Mandatory trust enforcement layer defining cognition boundaries
- **[memory-vault](https://github.com/kase1111-hash/memory-vault)** - Secure, offline-capable, owner-sovereign storage for cognitive artifacts
- **[value-ledger](https://github.com/kase1111-hash/value-ledger)** - Economic accounting layer for cognitive work (ideas, effort, novelty)
- **[Boundary-SIEM](https://github.com/kase1111-hash/Boundary-SIEM)** - Security Information and Event Management for AI systems

### NatLangChain Ecosystem

Prose-first, intent-native blockchain protocol for human intent:

- **[NatLangChain](https://github.com/kase1111-hash/NatLangChain)** - Natural language blockchain for human-readable smart contracts
- **[IntentLog](https://github.com/kase1111-hash/IntentLog)** - Git for human reasoning; tracks "why" changes happen via prose commits
- **[RRA-Module](https://github.com/kase1111-hash/RRA-Module)** - Revenant Repo Agent for abandoned repository monetization
- **[mediator-node](https://github.com/kase1111-hash/mediator-node)** - LLM mediation layer for matching, negotiation, and closure proposals
- **[ILR-module](https://github.com/kase1111-hash/ILR-module)** - IP & Licensing Reconciliation for dispute resolution
- **[Finite-Intent-Executor](https://github.com/kase1111-hash/Finite-Intent-Executor)** - Posthumous execution of predefined intent (Solidity smart contract)

### Game Development

- **[Shredsquatch](https://github.com/kase1111-hash/Shredsquatch)** - 3D first-person snowboarding infinite runner (SkiFree homage)
- **[Midnight-pulse](https://github.com/kase1111-hash/Midnight-pulse)** - Procedurally generated night drive
- **[Long-Home](https://github.com/kase1111-hash/Long-Home)** - Atmospheric indie game (Godot)

---

**Remember**: Nothing is learned by default. Every byte of learning requires explicit, revocable consent.
