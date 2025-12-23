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

## Related Projects

- **Memory Vault** - Storage system for learning memories
- **Boundary Daemon** - Spatial and temporal access control

---

**Remember**: Nothing is learned by default. Every byte of learning requires explicit, revocable consent.
