/**
 * Basic Usage Examples for Learning Contracts
 */

import {
  LearningContractsSystem,
  BoundaryMode,
  AbstractionLevel,
  RetentionDuration,
} from '../src';

// Initialize the system
const system = new LearningContractsSystem();

/**
 * Example 1: Simple observation (no storage)
 */
function example1_observation() {
  console.log('\n=== Example 1: Observation Contract ===');

  // Create observation contract - can observe but not store
  const contract = system.createObservationContract('alice', {
    domains: ['user-behavior'],
  });

  console.log('Created observation contract:', contract.contract_id);
  console.log('Can store memory?', contract.memory_permissions.may_store); // false
  console.log('Can generalize?', contract.generalization_rules.allowed); // false
}

/**
 * Example 2: Session-based learning
 */
function example2_sessionLearning() {
  console.log('\n=== Example 2: Session-Based Learning ===');

  // Create episodic contract for this session only
  const contract = system.createEpisodicContract(
    'bob',
    {
      domains: ['coding'],
      contexts: ['debugging-session'],
    },
    {
      classificationCap: 2,
      retention: RetentionDuration.SESSION,
    }
  );

  // Activate the contract
  let active = system.submitForReview(contract.contract_id, 'bob');
  active = system.activateContract(active.contract_id, 'bob');

  // Try to create a memory
  const result = system.checkMemoryCreation(
    active.contract_id,
    BoundaryMode.NORMAL,
    2,
    { domain: 'coding', context: 'debugging-session' }
  );

  console.log('Memory creation allowed?', result.allowed);
  console.log('Contract expires after session');
}

/**
 * Example 3: Learning with heuristics
 */
function example3_proceduralLearning() {
  console.log('\n=== Example 3: Procedural Learning (Heuristics) ===');

  // Create procedural contract - can learn patterns and heuristics
  const contract = system.createProceduralContract(
    'carol',
    {
      domains: ['code-review'],
      contexts: ['typescript-projects'],
    },
    {
      classificationCap: 3,
      retention: RetentionDuration.PERMANENT,
      generalizationConditions: [
        'Only within TypeScript codebases',
        'No personal data patterns',
      ],
    }
  );

  // Activate
  let active = system.submitForReview(contract.contract_id, 'carol');
  active = system.activateContract(active.contract_id, 'carol');

  // Check if we can create heuristics
  const abstractionCheck = system.checkAbstraction(
    active.contract_id,
    BoundaryMode.NORMAL,
    AbstractionLevel.HEURISTIC,
    { domain: 'code-review' }
  );

  console.log('Can create heuristics?', abstractionCheck.allowed);
  console.log('Max abstraction:', active.scope.max_abstraction);
}

/**
 * Example 4: Strategic learning with high trust
 */
function example4_strategicLearning() {
  console.log('\n=== Example 4: Strategic Learning ===');

  // Strategic contracts require high trust
  const contract = system.createStrategicContract(
    'dave',
    {
      domains: ['business-strategy'],
    },
    {
      classificationCap: 4,
      generalizationConditions: [
        'High-confidence patterns only',
        'Owner review required',
      ],
    }
  );

  let active = system.submitForReview(contract.contract_id, 'dave');
  active = system.activateContract(active.contract_id, 'dave');

  // Try to recall with different boundary modes
  const normalRecall = system.checkRecall(
    active.contract_id,
    BoundaryMode.NORMAL,
    { domain: 'business-strategy' }
  );

  const trustedRecall = system.checkRecall(
    active.contract_id,
    BoundaryMode.TRUSTED,
    { domain: 'business-strategy' }
  );

  console.log('Recall with NORMAL mode?', normalRecall.allowed); // false
  console.log('Recall with TRUSTED mode?', trustedRecall.allowed); // true
}

/**
 * Example 5: Prohibited domains
 */
function example5_prohibitedDomains() {
  console.log('\n=== Example 5: Prohibited Domains ===');

  // Create prohibited contract - explicitly forbids learning
  const contract = system.createProhibitedContract('eve', {
    domains: ['medical', 'financial', 'legal'],
  });

  let active = system.submitForReview(contract.contract_id, 'eve');
  active = system.activateContract(active.contract_id, 'eve');

  // Try to create memory (will be denied)
  const result = system.checkMemoryCreation(
    active.contract_id,
    BoundaryMode.NORMAL,
    1,
    { domain: 'medical' }
  );

  console.log('Memory creation allowed?', result.allowed); // false
  console.log('Reason:', result.reason);
  console.log('Contract is revocable?', active.revocable); // false
}

/**
 * Example 6: Contract revocation and forgetting
 */
function example6_revocation() {
  console.log('\n=== Example 6: Revocation and Forgetting ===');

  // Create and activate a contract
  const contract = system.createEpisodicContract('frank', {
    domains: ['personal'],
  });

  let active = system.submitForReview(contract.contract_id, 'frank');
  active = system.activateContract(active.contract_id, 'frank');

  console.log('Contract state:', active.state); // ACTIVE

  // Revoke the contract
  const revoked = system.revokeContract(
    active.contract_id,
    'frank',
    'Privacy concerns - removing all learned data'
  );

  console.log('Contract state after revocation:', revoked.state); // REVOKED

  // Try to recall (will be denied)
  const recallCheck = system.checkRecall(
    revoked.contract_id,
    BoundaryMode.NORMAL,
    { domain: 'personal' }
  );

  console.log('Can recall after revocation?', recallCheck.allowed); // false
  console.log('Reason:', recallCheck.reason);
}

/**
 * Example 7: Contract amendment
 */
function example7_amendment() {
  console.log('\n=== Example 7: Contract Amendment ===');

  // Create initial contract
  const contract = system.createEpisodicContract('grace', {
    domains: ['project-alpha'],
  });

  let active = system.submitForReview(contract.contract_id, 'grace');
  active = system.activateContract(active.contract_id, 'grace');

  console.log('Original domains:', active.scope.domains);

  // Amend to expand scope
  const { original, newDraft } = system.amendContract(
    active.contract_id,
    'grace',
    {
      scope: {
        domains: ['project-alpha', 'project-beta'],
        contexts: [],
        tools: [],
      },
    },
    'Expanding to include project-beta'
  );

  console.log('Original contract state:', original.state); // AMENDED
  console.log('New draft state:', newDraft.state); // DRAFT
  console.log('New draft domains:', newDraft.scope.domains);
  console.log('Amendment link:', newDraft.metadata?.amended_from);
}

/**
 * Example 8: Audit trail
 */
function example8_auditTrail() {
  console.log('\n=== Example 8: Audit Trail ===');

  // Create and transition a contract
  const contract = system.createEpisodicContract('henry', {
    domains: ['test'],
  });

  let active = system.submitForReview(contract.contract_id, 'henry');
  active = system.activateContract(active.contract_id, 'henry');

  // Make some enforcement checks
  system.checkMemoryCreation(active.contract_id, BoundaryMode.NORMAL, 2, {
    domain: 'test',
  });

  system.checkMemoryCreation(active.contract_id, BoundaryMode.NORMAL, 10, {
    domain: 'test',
  }); // Will fail - exceeds cap

  // Get audit history
  const history = system.getContractHistory(active.contract_id);
  console.log('Total audit events:', history.length);

  // Get violations
  const violations = system.getViolations();
  console.log('Total violations:', violations.length);

  // Print history
  console.log('\nAudit history:');
  history.forEach((event) => {
    console.log(
      `- ${event.event_type} by ${event.actor} at ${event.timestamp.toISOString()}`
    );
  });
}

/**
 * Example 9: Scope enforcement
 */
function example9_scopeEnforcement() {
  console.log('\n=== Example 9: Scope Enforcement ===');

  // Create contract with specific scope
  const contract = system.createEpisodicContract('iris', {
    domains: ['work'],
    contexts: ['project-x'],
    tools: ['editor', 'terminal'],
  });

  let active = system.submitForReview(contract.contract_id, 'iris');
  active = system.activateContract(active.contract_id, 'iris');

  // Try different scopes
  const tests = [
    { domain: 'work', context: 'project-x', tool: 'editor' }, // allowed
    { domain: 'work', context: 'project-y', tool: 'editor' }, // denied - wrong context
    { domain: 'personal', context: 'project-x', tool: 'editor' }, // denied - wrong domain
    { domain: 'work', context: 'project-x', tool: 'browser' }, // denied - wrong tool
  ];

  tests.forEach((test, i) => {
    const result = system.checkMemoryCreation(
      active.contract_id,
      BoundaryMode.NORMAL,
      2,
      test
    );
    console.log(`Test ${i + 1}:`, test, '→', result.allowed);
  });
}

/**
 * Example 10: Finding applicable contracts
 */
function example10_findingContracts() {
  console.log('\n=== Example 10: Finding Applicable Contracts ===');

  // Create multiple contracts
  const coding = system.createEpisodicContract('user', {
    domains: ['coding'],
  });
  const personal = system.createEpisodicContract('user', {
    domains: ['personal'],
  });
  const prohibited = system.createProhibitedContract('user', {
    domains: ['medical'],
  });

  // Activate them
  [coding, personal, prohibited].forEach((c) => {
    let active = system.submitForReview(c.contract_id, 'user');
    system.activateContract(active.contract_id, 'user');
  });

  // Find applicable contracts
  const codingContract = system.findApplicableContract('coding');
  const medicalContract = system.findApplicableContract('medical');

  console.log('Found contract for coding?', !!codingContract);
  console.log('Found contract for medical?', !!medicalContract);
  console.log(
    'Medical contract type:',
    medicalContract?.contract_type
  ); // PROHIBITED
}

// Run all examples
function runAllExamples() {
  example1_observation();
  example2_sessionLearning();
  example3_proceduralLearning();
  example4_strategicLearning();
  example5_prohibitedDomains();
  example6_revocation();
  example7_amendment();
  example8_auditTrail();
  example9_scopeEnforcement();
  example10_findingContracts();

  console.log('\n=== All examples completed ===');
}

// Uncomment to run
// runAllExamples();

export {
  example1_observation,
  example2_sessionLearning,
  example3_proceduralLearning,
  example4_strategicLearning,
  example5_prohibitedDomains,
  example6_revocation,
  example7_amendment,
  example8_auditTrail,
  example9_scopeEnforcement,
  example10_findingContracts,
  runAllExamples,
};
