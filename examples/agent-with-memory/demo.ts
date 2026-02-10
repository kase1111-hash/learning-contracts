/**
 * Agent with Memory — Complete Demo
 *
 * Demonstrates the full lifecycle of contract-governed learning:
 *   1. Create a learning contract (user grants permission)
 *   2. Agent stores a memory (allowed by contract)
 *   3. Agent recalls the memory (allowed by contract)
 *   4. Agent tries to learn outside scope (denied)
 *   5. User revokes the contract (memories become inaccessible)
 *   6. Agent tries to recall (denied — contract revoked)
 *
 * Run: npx tsx examples/agent-with-memory/demo.ts
 */

import {
  LearningContractsSystem,
  BoundaryMode,
  RetentionDuration,
  ContractGovernedStore,
  InMemoryStore,
} from '../../src';

// ─── Setup ──────────────────────────────────────────────────────

const system = new LearningContractsSystem();
const store = new InMemoryStore();
const governed = new ContractGovernedStore(store, system);

function log(label: string, message: string): void {
  console.log(`  [${label}] ${message}`);
}

// ─── 1. User creates a learning contract ────────────────────────

console.log('\n--- Step 1: Create and activate a learning contract ---');
console.log('Alice allows the agent to learn coding tips in project-alpha.\n');

let contract = system.createEpisodicContract('alice', {
  domains: ['coding'],
  contexts: ['project-alpha'],
  tools: ['editor'],
}, {
  classificationCap: 3,
  retention: RetentionDuration.TIMEBOUND,
  retentionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
});

contract = system.submitForReview(contract.contract_id, 'alice');
contract = system.activateContract(contract.contract_id, 'alice');

log('CONTRACT', `Created and activated: ${contract.contract_id}`);
log('CONTRACT', `Type: ${contract.contract_type}, State: ${contract.state}`);
log('CONTRACT', `Scope: domains=[${contract.scope.domains}], contexts=[${contract.scope.contexts}]`);

// ─── 2. Agent stores a memory (allowed) ─────────────────────────

console.log('\n--- Step 2: Agent stores a memory (within scope) ---\n');

async function runDemo(): Promise<void> {
  const storeResult = await governed.store({
    content: 'In project-alpha, async/await is preferred over .then() chains',
    classification: 2,
    domain: 'coding',
    context: 'project-alpha',
    tool: 'editor',
  }, contract.contract_id);

  if (storeResult.allowed) {
    log('STORE', `Memory stored: ${storeResult.result!.memory_id}`);
    log('STORE', `Content: "${storeResult.result!.content}"`);
  } else {
    log('STORE', `DENIED: ${storeResult.enforcement.reason}`);
  }

  // ─── 3. Agent recalls the memory (allowed) ───────────────────

  console.log('\n--- Step 3: Agent recalls the memory (within scope) ---\n');

  const recallResult = await governed.recall({
    domain: 'coding',
    context: 'project-alpha',
    requester: 'alice',
  }, contract.contract_id);

  if (recallResult.allowed && recallResult.result) {
    log('RECALL', `Found ${recallResult.result.length} memory(ies)`);
    for (const memory of recallResult.result) {
      log('RECALL', `  "${memory.content}"`);
    }
  } else {
    log('RECALL', `DENIED: ${recallResult.enforcement.reason}`);
  }

  // ─── 4. Agent tries to learn outside scope (denied) ──────────

  console.log('\n--- Step 4: Agent tries to store outside scope (denied) ---\n');

  const deniedResult = await governed.store({
    content: 'Alice prefers dark mode',
    classification: 2,
    domain: 'personal-preferences',  // NOT in contract scope
    context: 'project-alpha',
  }, contract.contract_id);

  if (deniedResult.allowed) {
    log('STORE', `Memory stored (unexpected!)`);
  } else {
    log('STORE', `DENIED (as expected): ${deniedResult.enforcement.reason}`);
  }

  // ─── 5. Also try discovery with no contract ──────────────────

  console.log('\n--- Step 5: Try to store with no applicable contract ---\n');

  const noContractResult = await governed.storeWithDiscovery({
    content: 'Secret financial data',
    classification: 4,
    domain: 'finance',  // No contract covers finance
  });

  if (noContractResult.allowed) {
    log('STORE', `Memory stored (unexpected!)`);
  } else {
    log('STORE', `DENIED (as expected): ${noContractResult.enforcement.reason}`);
  }

  // ─── 6. User revokes the contract ────────────────────────────

  console.log('\n--- Step 6: Alice revokes the contract ---\n');

  const revoked = system.revokeContract(
    contract.contract_id,
    'alice',
    'No longer working on this project'
  );
  log('REVOKE', `Contract state: ${revoked.state}`);

  // Forget all memories under this contract
  const forgotten = await governed.forgetByContract(contract.contract_id);
  log('FORGET', `Forgotten ${forgotten.length} memory(ies)`);

  // ─── 7. Agent tries to recall after revocation (denied) ──────

  console.log('\n--- Step 7: Agent tries to recall after revocation (denied) ---\n');

  const postRevokeRecall = await governed.recall({
    domain: 'coding',
    context: 'project-alpha',
    requester: 'alice',
  }, contract.contract_id);

  if (postRevokeRecall.allowed) {
    log('RECALL', `Allowed (unexpected!)`);
  } else {
    log('RECALL', `DENIED (as expected): ${postRevokeRecall.enforcement.reason}`);
  }

  // ─── 8. Check audit trail ────────────────────────────────────

  console.log('\n--- Step 8: Audit trail ---\n');

  const auditLog = system.getAuditLog();
  log('AUDIT', `Total events: ${auditLog.length}`);
  for (const event of auditLog) {
    const allowed = event.allowed !== undefined ? (event.allowed ? 'ALLOWED' : 'DENIED') : '';
    log('AUDIT', `  ${event.event_type} ${allowed}`);
  }

  const violations = system.getViolations();
  log('AUDIT', `\nViolations: ${violations.length}`);
  for (const v of violations) {
    log('AUDIT', `  ${v.reason}`);
  }

  console.log('\n--- Demo complete ---\n');
  console.log('Summary:');
  console.log('  - Contract governed all memory operations');
  console.log('  - Out-of-scope writes were denied');
  console.log('  - Revocation made all memories inaccessible');
  console.log('  - Complete audit trail preserved');
  console.log('  - Memory store has', store.size(), 'memories remaining');
  console.log();
}

runDemo().catch(console.error);
