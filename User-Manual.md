# User Manual: Setting Up Learning Contracts (Plain-Language Edition)

## Introduction

Learning Contracts give you full control over what your AI co-worker can learn from your interactions. By default, nothing is learned unless you explicitly allow it through a contract. These contracts are written in clear, everyday language — no technical jargon required.

The system includes a conversational builder that translates plain-language descriptions into precise, enforceable rules. You describe what you want in your own words, and the builder handles the technical details.

This manual shows you how to create contracts using the conversational builder. Once activated, a contract enforces itself during every relevant interaction — no per-session approvals needed (unless you specifically want them).

We'll walk through two examples:

- **Coding** — Automatically learning reusable coding tips and best practices.
- **Streaming Video Gameplay** — Automatically capturing and recalling specific gameplay moments from your streams.

## Getting Started

The conversational builder is available through the `ConversationalContractBuilder` class, which is exposed as `system.conversations` on the main `LearningContractsSystem` instance. Applications that integrate Learning Contracts can present this as a chat interface, a form, or any other UI.

```typescript
import { LearningContractsSystem } from 'learning-contracts';

const system = new LearningContractsSystem();

// Start a conversation
const response = system.conversations.startConversation('alice');
console.log(response.message);
// "Let's create a Learning Contract. What would you like the assistant to learn about?"
```

You can also use one of the 7 built-in templates (e.g., `coding-best-practices`, `gaming-streaming`) to skip the conversational flow and create a contract directly.

## Example 1: Contract for Coding

**Goal:** Allow the assistant to learn and reuse helpful coding patterns (like "prefer list comprehensions in Python") while you work on personal projects.

### Step 1: Start the Conversation

```typescript
const response = system.conversations.startConversation('alice');
```

> **Builder:** Let's create a Learning Contract. What would you like the assistant to learn about? You can describe it in your own words, or I can show you some templates.

### Step 2: Describe What You Want

```typescript
const result = system.conversations.processInput(
  response.conversationId!,
  'Coding and programming. I want you to learn reusable tips and best practices from my Python coding sessions.'
);
```

> **Builder:** Got it — this will be a "Procedural Learning" contract (for learning reusable techniques). Which tools or environments does this apply to?

### Step 3: Answer the Follow-up Questions

The builder will ask a series of questions to define the contract's scope, retention, and rules:

- **Tools/environments:** "Python programming in VS Code or Git. Only for my personal coding projects."
- **Retention period:** "Permanently, until I revoke the contract."
- **Auto-apply in future sessions?** "Yes, as long as it's in the same kind of project."
- **Sharing outside the system?** "No, never."

### Step 4: Review and Activate

When the conversation is complete, the builder provides a plain-language summary and a draft:

> **Summary:** You allow the assistant to observe your Python coding in personal projects (using tools like VS Code or Git). It may learn and store reusable coding tips and best practices. These tips can be applied in future similar sessions. They are kept permanently and never shared outside this system. You can revoke this at any time.

```typescript
if (result.isComplete && result.draft) {
  // Create the contract from the conversational draft
  let contract = system.createContractFromPlainLanguage(result.draft);

  // Activate it (Draft -> Review -> Active)
  contract = system.submitForReview(contract.contract_id, 'alice');
  contract = system.activateContract(contract.contract_id, 'alice');
}
```

From this point, the enforcement engine checks all learning operations against this contract's rules.

## Example 2: Contract for Streaming Video Gameplay

**Goal:** Save specific gameplay moments from live streams for later recall, without generalization across unrelated games.

### Step 1: Start and Describe

```typescript
const response = system.conversations.startConversation('bob');
const result = system.conversations.processInput(
  response.conversationId!,
  'Streaming video gameplay. I want to save specific moments or strategies from my live game streams.'
);
```

> **Builder:** This sounds like an "Episodic Learning" contract — good for capturing individual events without combining them into broader rules. Which games or platforms?

### Step 2: Define the Details

- **Games/platforms:** "Fortnite streams on Twitch using OBS Studio."
- **Retention:** "About 30 days — then automatically freeze them."
- **Combine across streams?** "No, keep each episode separate. No big-picture generalizations."
- **Require approval for recall?** "Yes, I'd like to approve recall each time."

### Step 3: Review and Activate

> **Summary:** You allow the assistant to capture and store specific moments from your Fortnite streams on Twitch (using OBS). Each moment is saved separately — no combining into general strategies. Memories are kept for 30 days, then automatically frozen. Recall requires your approval each time. Nothing is ever shared outside this system. You can revoke anytime.

```typescript
if (result.isComplete && result.draft) {
  let contract = system.createContractFromPlainLanguage(result.draft);
  contract = system.submitForReview(contract.contract_id, 'bob');
  contract = system.activateContract(contract.contract_id, 'bob');
}
```

The contract now enforces its rules: capturing episodes during streams, preventing generalization, auto-freezing after 30 days, and requiring approval for recall.

## Using Templates

Instead of the conversational flow, you can use a built-in template:

```typescript
const response = system.conversations.startConversation('alice');
system.conversations.useTemplate(response.conversationId!, 'coding-best-practices');
```

Available templates: `coding-best-practices`, `gaming-streaming`, `personal-journal`, `work-projects`, `prohibited-domains`, `study-sessions`, `strategic-planning`.

## Managing Contracts

### View Contracts

```typescript
// Get all contracts
const contracts = system.getAllContracts();

// Get only active contracts
const active = system.getActiveContracts();

// Get a plain-language summary of any contract
const summary = system.getContractSummary(contractId, { format: 'prose' });
```

### Revoke a Contract

```typescript
system.revokeContract(contractId, 'alice', 'No longer needed');
```

### Emergency Override (Pause All Learning)

```typescript
system.triggerEmergencyOverride('alice', 'Security concern');
```

### Audit Trail

All actions are logged in the immutable audit trail:

```typescript
const auditLog = system.getAuditLog();
const violations = system.getViolations();
```

## Final Note

You're in full control. The conversational builder proposes contracts based on your words, but nothing happens without explicit activation. Learning only occurs where you allow it — never by surprise.
