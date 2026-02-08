/**
 * Emergency Override System Tests
 */

import {
  LearningContractsSystem,
  BoundaryMode,
  AbstractionLevel,
} from '../src';

describe('Emergency Override System', () => {
  let system: LearningContractsSystem;

  beforeEach(() => {
    system = new LearningContractsSystem();
  });

  describe('Triggering Emergency Override', () => {
    test('should successfully trigger emergency override', () => {
      const result = system.triggerEmergencyOverride(
        'admin',
        'Security incident detected'
      );

      expect(result.success).toBe(true);
      expect(result.event_id).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should fail to trigger when already active', () => {
      system.triggerEmergencyOverride('admin', 'First trigger');

      const result = system.triggerEmergencyOverride('admin', 'Second trigger');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already active');
    });

    test('should report active contracts blocked count', () => {
      // Create and activate some contracts
      let contract1 = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract1 = system.submitForReview(contract1.contract_id, 'alice');
      contract1 = system.activateContract(contract1.contract_id, 'alice');

      let contract2 = system.createEpisodicContract('bob', {
        domains: ['design'],
      });
      contract2 = system.submitForReview(contract2.contract_id, 'bob');
      contract2 = system.activateContract(contract2.contract_id, 'bob');

      const result = system.triggerEmergencyOverride(
        'admin',
        'Security incident'
      );

      expect(result.success).toBe(true);
      expect(result.active_contracts_blocked).toBe(2);
    });
  });

  describe('Disabling Emergency Override', () => {
    test('should successfully disable active override', () => {
      system.triggerEmergencyOverride('admin', 'Security incident');

      const result = system.emergencyOverride.disableOverride('admin', 'Incident resolved');

      expect(result.success).toBe(true);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });

    test('should fail to disable when not active', () => {
      const result = system.emergencyOverride.disableOverride('admin', 'No active override');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });

    test('should track operations blocked during override', () => {
      // Create and activate a contract
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.triggerEmergencyOverride('admin', 'Security incident');

      // Attempt operations that will be blocked
      system.checkMemoryCreation(contract.contract_id, BoundaryMode.NORMAL, 1, {
        domain: 'coding',
      });
      system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
        requester: 'alice',
      });

      const result = system.emergencyOverride.disableOverride('admin', 'Resolved');

      expect(result.success).toBe(true);
      expect(result.operations_blocked_during).toBe(2);
    });
  });

  describe('Emergency Override Status', () => {
    test('should report inactive when not triggered', () => {
      const status = system.emergencyOverride.getStatus();

      expect(status.active).toBe(false);
      expect(status.reason).toBeUndefined();
      expect(status.triggered_at).toBeUndefined();
      expect(status.triggered_by).toBeUndefined();
    });

    test('should report active when triggered', () => {
      system.triggerEmergencyOverride('admin', 'Security incident');

      const status = system.emergencyOverride.getStatus();

      expect(status.active).toBe(true);
      expect(status.reason).toBe('Security incident');
      expect(status.triggered_by).toBe('admin');
      expect(status.triggered_at).toBeInstanceOf(Date);
    });

    test('isEmergencyOverrideActive should return correct value', () => {
      expect(system.emergencyOverride.isActive()).toBe(false);

      system.triggerEmergencyOverride('admin', 'Test');

      expect(system.emergencyOverride.isActive()).toBe(true);

      system.emergencyOverride.disableOverride('admin');

      expect(system.emergencyOverride.isActive()).toBe(false);
    });
  });

  describe('Blocking Enforcement Operations', () => {
    test('should block memory creation during override', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Before override - should succeed
      const beforeResult = system.checkMemoryCreation(
        contract.contract_id,
        BoundaryMode.NORMAL,
        1,
        { domain: 'coding' }
      );
      expect(beforeResult.allowed).toBe(true);

      // Trigger override
      system.triggerEmergencyOverride('admin', 'Pause all learning');

      // During override - should be blocked
      const duringResult = system.checkMemoryCreation(
        contract.contract_id,
        BoundaryMode.NORMAL,
        1,
        { domain: 'coding' }
      );
      expect(duringResult.allowed).toBe(false);
      expect(duringResult.reason).toContain('Emergency override active');

      // After override disabled - should succeed again
      system.emergencyOverride.disableOverride('admin');
      const afterResult = system.checkMemoryCreation(
        contract.contract_id,
        BoundaryMode.NORMAL,
        1,
        { domain: 'coding' }
      );
      expect(afterResult.allowed).toBe(true);
    });

    test('should block abstraction during override', () => {
      let contract = system.createProceduralContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.triggerEmergencyOverride('admin', 'Pause all learning');

      const result = system.checkAbstraction(
        contract.contract_id,
        BoundaryMode.NORMAL,
        AbstractionLevel.PATTERN,
        { domain: 'coding' }
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Emergency override active');
    });

    test('should block recall during override', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.triggerEmergencyOverride('admin', 'Pause all learning');

      const result = system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
        requester: 'alice',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Emergency override active');
    });

    test('should block export during override', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.triggerEmergencyOverride('admin', 'Pause all learning');

      const result = system.checkExport(contract.contract_id, BoundaryMode.NORMAL);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Emergency override active');
    });
  });

  describe('Event Listeners', () => {
    test('should notify trigger listeners', () => {
      let triggered = false;
      let receivedEvent: any = null;

      system.emergencyOverride.onTrigger((event) => {
        triggered = true;
        receivedEvent = event;
      });

      system.triggerEmergencyOverride('admin', 'Security incident');

      expect(triggered).toBe(true);
      expect(receivedEvent.triggered_by).toBe('admin');
      expect(receivedEvent.reason).toBe('Security incident');
    });

    test('should notify disable listeners', () => {
      let disabled = false;
      let receivedEvent: any = null;

      system.emergencyOverride.onDisable((event) => {
        disabled = true;
        receivedEvent = event;
      });

      system.triggerEmergencyOverride('admin', 'Security incident');
      system.emergencyOverride.disableOverride('admin', 'Resolved');

      expect(disabled).toBe(true);
      expect(receivedEvent.disabled_by).toBe('admin');
      expect(receivedEvent.reason).toBe('Resolved');
    });

    test('should notify blocked operation listeners', () => {
      const blockedOps: { operation: string; contractId: string }[] = [];

      system.emergencyOverride.onBlockedOperation((op, contractId) => {
        blockedOps.push({ operation: op, contractId });
      });

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.triggerEmergencyOverride('admin', 'Security incident');

      system.checkMemoryCreation(contract.contract_id, BoundaryMode.NORMAL, 1, {
        domain: 'coding',
      });
      system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
        requester: 'alice',
      });

      expect(blockedOps.length).toBe(2);
      expect(blockedOps[0].operation).toBe('memory_creation');
      expect(blockedOps[1].operation).toBe('recall');
    });

    test('should allow unsubscribing from listeners', () => {
      let count = 0;

      const unsubscribe = system.emergencyOverride.onTrigger(() => {
        count++;
      });

      system.triggerEmergencyOverride('admin', 'First');
      system.emergencyOverride.disableOverride('admin');

      unsubscribe();

      system.triggerEmergencyOverride('admin', 'Second');

      expect(count).toBe(1);
    });
  });

  describe('Audit Trail', () => {
    test('should log trigger event to audit trail', () => {
      system.triggerEmergencyOverride('admin', 'Security incident');

      const audit = system.getAuditLog();
      const triggerEvent = audit.find(
        (e: any) => e.event_type === 'custom' && e.details?.custom_event_name === 'emergency_override_triggered'
      );

      expect(triggerEvent).toBeDefined();
    });

    test('should log disable event to audit trail', () => {
      system.triggerEmergencyOverride('admin', 'Security incident');
      system.emergencyOverride.disableOverride('admin', 'Resolved');

      const audit = system.getAuditLog();
      const disableEvent = audit.find(
        (e: any) => e.event_type === 'custom' && e.details?.custom_event_name === 'emergency_override_disabled'
      );

      expect(disableEvent).toBeDefined();
    });

    test('should log blocked operations to audit trail', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.triggerEmergencyOverride('admin', 'Security incident');

      system.checkMemoryCreation(contract.contract_id, BoundaryMode.NORMAL, 1, {
        domain: 'coding',
      });

      const audit = system.getAuditLog();
      const blockedEvent = audit.find(
        (e: any) => e.event_type === 'custom' && e.details?.custom_event_name === 'emergency_override_blocked_operation'
      );

      expect(blockedEvent).toBeDefined();
    });
  });

  describe('Multiple Contracts', () => {
    test('should block all contracts during override', () => {
      // Create multiple contracts
      let contract1 = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract1 = system.submitForReview(contract1.contract_id, 'alice');
      contract1 = system.activateContract(contract1.contract_id, 'alice');

      let contract2 = system.createProceduralContract('bob', {
        domains: ['design'],
      });
      contract2 = system.submitForReview(contract2.contract_id, 'bob');
      contract2 = system.activateContract(contract2.contract_id, 'bob');

      system.triggerEmergencyOverride('admin', 'Block all');

      // Both contracts should be blocked
      const result1 = system.checkMemoryCreation(
        contract1.contract_id,
        BoundaryMode.NORMAL,
        1,
        { domain: 'coding' }
      );
      const result2 = system.checkMemoryCreation(
        contract2.contract_id,
        BoundaryMode.NORMAL,
        1,
        { domain: 'design' }
      );

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid trigger/disable cycles', () => {
      for (let i = 0; i < 5; i++) {
        const trigger = system.triggerEmergencyOverride('admin', `Trigger ${i}`);
        expect(trigger.success).toBe(true);

        const disable = system.emergencyOverride.disableOverride('admin', `Disable ${i}`);
        expect(disable.success).toBe(true);
      }

      expect(system.emergencyOverride.isActive()).toBe(false);
    });

    test('should preserve override state across multiple operations', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.triggerEmergencyOverride('admin', 'Block all');

      // Multiple operations should all be blocked
      for (let i = 0; i < 10; i++) {
        const result = system.checkMemoryCreation(
          contract.contract_id,
          BoundaryMode.NORMAL,
          1,
          { domain: 'coding' }
        );
        expect(result.allowed).toBe(false);
      }

      // Status should reflect all blocked operations
      const status = system.emergencyOverride.getStatus();
      expect(status.operations_blocked).toBe(10);
    });

    test('should include override reason in denial message', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.triggerEmergencyOverride('admin', 'Security breach detected');

      const result = system.checkRecall(contract.contract_id, BoundaryMode.NORMAL, {
        domain: 'coding',
        requester: 'alice',
      });

      expect(result.reason).toContain('Security breach detected');
    });
  });
});
