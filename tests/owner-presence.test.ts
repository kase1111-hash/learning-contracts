/**
 * Owner Presence Validation Tests
 */

import {
  LearningContractsSystem,
  BoundaryMode,
} from '../src';

describe('Owner Presence Validation', () => {
  let system: LearningContractsSystem;

  beforeEach(() => {
    system = new LearningContractsSystem();
  });

  describe('Enforcement Engine - checkRecall', () => {
    test('should allow recall when requires_owner is false', () => {
      // Create a contract with requires_owner = false
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, { requiresOwner: false });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Anyone should be able to recall
      const result = system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
        requester: 'bob',
      });

      expect(result.allowed).toBe(true);
    });

    test('should allow recall when requester is the owner', () => {
      // Create a contract with requires_owner = true
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // The contract by default has requires_owner = true
      expect(contract.recall_rules.requires_owner).toBe(true);

      // Owner should be able to recall
      const result = system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
        requester: 'alice',
      });

      expect(result.allowed).toBe(true);
    });

    test('should deny recall when requires_owner is true and requester is not owner', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Non-owner should be denied
      const result = system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
        requester: 'bob',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('owner presence');
      expect(result.reason).toContain('bob');
      expect(result.reason).toContain('alice');
    });

    test('should deny recall when requires_owner is true and no requester provided', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // No requester provided
      const result = system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('no requester was provided');
    });

    test('should check owner presence before other checks', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Even with wrong boundary mode, owner check should happen first
      const result = system.checkRecall(contract.contract_id, BoundaryMode.RESTRICTED, {
        domain: 'coding',
        requester: 'bob',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('owner presence');
    });
  });

  describe('Contract Factory - requires_owner defaults', () => {
    test('episodic contracts should have requires_owner = true by default', () => {
      const contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });

      expect(contract.recall_rules.requires_owner).toBe(true);
    });

    test('procedural contracts should have requires_owner = true by default', () => {
      const contract = system.createProceduralContract('alice', {
        domains: ['coding'],
      });

      expect(contract.recall_rules.requires_owner).toBe(true);
    });

    test('strategic contracts should have requires_owner = true by default', () => {
      const contract = system.createStrategicContract('alice', {
        domains: ['coding'],
      });

      expect(contract.recall_rules.requires_owner).toBe(true);
    });

    test('observation contracts should have requires_owner = true by default', () => {
      const contract = system.createObservationContract('alice', {
        domains: ['coding'],
      });

      expect(contract.recall_rules.requires_owner).toBe(true);
    });

    test('prohibited contracts should have requires_owner = true by default', () => {
      const contract = system.createProhibitedContract('alice', {
        domains: ['coding'],
      });

      expect(contract.recall_rules.requires_owner).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    test('should log owner presence violations', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Attempt recall as non-owner
      system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
        requester: 'bob',
      });

      const violations = system.getViolations();
      expect(violations.length).toBeGreaterThan(0);

      const ownerViolation = violations.find(
        (v) => v.reason?.includes('owner presence')
      );
      expect(ownerViolation).toBeDefined();
    });
  });

  describe('Multiple Contract Owners', () => {
    test('each contract should enforce its own owner', () => {
      // Alice creates a contract
      let aliceContract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      aliceContract = system.submitForReview(aliceContract.contract_id, 'alice');
      aliceContract = system.activateContract(aliceContract.contract_id, 'alice');

      // Bob creates a contract
      let bobContract = system.createEpisodicContract('bob', {
        domains: ['design'],
      });
      bobContract = system.submitForReview(bobContract.contract_id, 'bob');
      bobContract = system.activateContract(bobContract.contract_id, 'bob');

      // Alice can recall her contract
      const aliceRecall = system.checkRecall(
        aliceContract.contract_id,
        BoundaryMode.NORMAL,
        { domain: 'coding', requester: 'alice' }
      );
      expect(aliceRecall.allowed).toBe(true);

      // Alice cannot recall Bob's contract
      const aliceRecallBob = system.checkRecall(
        bobContract.contract_id,
        BoundaryMode.NORMAL,
        { domain: 'design', requester: 'alice' }
      );
      expect(aliceRecallBob.allowed).toBe(false);

      // Bob can recall his contract
      const bobRecall = system.checkRecall(
        bobContract.contract_id,
        BoundaryMode.NORMAL,
        { domain: 'design', requester: 'bob' }
      );
      expect(bobRecall.allowed).toBe(true);

      // Bob cannot recall Alice's contract
      const bobRecallAlice = system.checkRecall(
        aliceContract.contract_id,
        BoundaryMode.NORMAL,
        { domain: 'coding', requester: 'bob' }
      );
      expect(bobRecallAlice.allowed).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty requester string', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
        requester: '',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('owner presence');
    });

    test('should be case-sensitive for owner matching', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // 'Alice' (capitalized) is not the same as 'alice'
      const result = system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
        requester: 'Alice',
      });

      expect(result.allowed).toBe(false);
    });

    test('should still enforce other rules after owner check passes', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Owner passes, but wrong domain
      const result = system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'finance', // Wrong domain
        requester: 'alice',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Domain');
    });
  });

  describe('Plain Language Summary', () => {
    test('should describe owner requirement in summary', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const summary = system.getContractSummary(contract.contract_id);
      expect(summary).toBeDefined();
      expect(summary).toContain('approval');
    });
  });
});
