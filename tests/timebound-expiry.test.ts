/**
 * Timebound Auto-Expiry Tests
 */

import {
  LearningContractsSystem,
  ContractState,
} from '../src';

describe('Timebound Auto-Expiry', () => {
  let system: LearningContractsSystem;

  beforeEach(() => {
    system = new LearningContractsSystem();
  });

  afterEach(() => {
    // Ensure any automatic checks are stopped
    system.stopTimeboundExpiryChecks();
  });

  describe('Repository - getTimeboundExpiredContracts', () => {
    test('should find contracts with expired retention_until', () => {
      // Create a timebound contract with past retention_until
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // 1 day ago

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: pastDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Run a manual expiry cycle
      const result = system.runTimeboundExpiryCycle();

      expect(result.contracts_checked).toBe(1);
      expect(result.contracts_expired).toBe(1);
      expect(result.results[0].expired).toBe(true);
    });

    test('should not find contracts with future retention_until', () => {
      // Create a timebound contract with future retention_until
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: futureDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Run a manual expiry cycle
      const result = system.runTimeboundExpiryCycle();

      expect(result.contracts_checked).toBe(0);
      expect(result.contracts_expired).toBe(0);
    });

    test('should not find non-timebound contracts', () => {
      // Create a permanent contract
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'permanent',
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Run a manual expiry cycle
      const result = system.runTimeboundExpiryCycle();

      expect(result.contracts_checked).toBe(0);
    });

    test('should not find already expired contracts', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: pastDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Manually expire the contract
      system.revokeContract(contract.contract_id, 'alice', 'Manual revocation');

      // Run a manual expiry cycle
      const result = system.runTimeboundExpiryCycle();

      expect(result.contracts_checked).toBe(0);
    });
  });

  describe('Manual Expiry Cycle', () => {
    test('should expire multiple contracts in one cycle', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      // Create multiple timebound contracts with past retention
      for (let i = 0; i < 3; i++) {
        let contract = system.createEpisodicContract('alice', {
          domains: [`domain-${i}`],
        }, {
          retention: 'timebound',
          retentionUntil: pastDate,
        });
        contract = system.submitForReview(contract.contract_id, 'alice');
        system.activateContract(contract.contract_id, 'alice');
      }

      // Run a manual expiry cycle
      const result = system.runTimeboundExpiryCycle();

      expect(result.contracts_checked).toBe(3);
      expect(result.contracts_expired).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    test('should return cycle metadata', () => {
      const result = system.runTimeboundExpiryCycle();

      expect(result.cycle_id).toBeDefined();
      expect(result.started_at).toBeInstanceOf(Date);
      expect(result.completed_at).toBeInstanceOf(Date);
      expect(result.completed_at.getTime()).toBeGreaterThanOrEqual(
        result.started_at.getTime()
      );
    });

    test('should update statistics after each cycle', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: pastDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      system.activateContract(contract.contract_id, 'alice');

      // Run multiple cycles
      system.runTimeboundExpiryCycle();
      system.runTimeboundExpiryCycle();

      const stats = system.getTimeboundExpiryStats();
      expect(stats.cyclesCompleted).toBe(2);
      expect(stats.totalContractsExpired).toBe(1); // Only 1 contract to expire
    });
  });

  describe('Contract State After Expiry', () => {
    test('should set contract state to EXPIRED', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: pastDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.runTimeboundExpiryCycle();

      const expired = system.getContract(contract.contract_id);
      expect(expired?.state).toBe(ContractState.EXPIRED);
    });

    test('should not affect contracts with future retention_until', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: futureDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.runTimeboundExpiryCycle();

      const stillActive = system.getContract(contract.contract_id);
      expect(stillActive?.state).toBe(ContractState.ACTIVE);
    });
  });

  describe('Check Contract (Dry Run)', () => {
    test('should check if contract would be expired without expiring it', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: pastDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkTimeboundExpiry(contract.contract_id);

      expect(result?.expired).toBe(true);
      expect(result?.retention_until).toEqual(pastDate);

      // Contract should still be active
      const stillActive = system.getContract(contract.contract_id);
      expect(stillActive?.state).toBe(ContractState.ACTIVE);
    });

    test('should return null for non-existent contract', () => {
      const result = system.checkTimeboundExpiry('non-existent');
      expect(result).toBeNull();
    });

    test('should indicate non-timebound contracts', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'permanent',
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkTimeboundExpiry(contract.contract_id);

      expect(result?.expired).toBe(false);
      expect(result?.error).toContain('not timebound');
    });
  });

  describe('Force Expire', () => {
    test('should expire contract immediately regardless of retention_until', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: futureDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.forceTimeboundExpiry(contract.contract_id);

      expect(result.expired).toBe(true);

      const expired = system.getContract(contract.contract_id);
      expect(expired?.state).toBe(ContractState.EXPIRED);
    });

    test('should handle non-existent contract', () => {
      const result = system.forceTimeboundExpiry('non-existent');

      expect(result.expired).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should handle already expired contract', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: pastDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Expire once
      system.forceTimeboundExpiry(contract.contract_id);

      // Try to expire again
      const result = system.forceTimeboundExpiry(contract.contract_id);

      expect(result.expired).toBe(false);
      expect(result.error).toContain('not active');
    });
  });

  describe('Event Listeners', () => {
    test('should notify listeners on contract expiry', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: pastDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      let notified = false;
      let receivedContractId: string | null = null;

      system.onTimeboundExpiry((c, _result) => {
        notified = true;
        receivedContractId = c.contract_id;
      });

      system.runTimeboundExpiryCycle();

      expect(notified).toBe(true);
      expect(receivedContractId).toBe(contract.contract_id);
    });

    test('should notify cycle completion listeners', () => {
      let notified = false;
      let receivedCycleId: string | null = null;

      system.onExpiryCycleComplete((result) => {
        notified = true;
        receivedCycleId = result.cycle_id;
      });

      system.runTimeboundExpiryCycle();

      expect(notified).toBe(true);
      expect(receivedCycleId).toBeDefined();
    });

    test('should allow unsubscribing from events', () => {
      let callCount = 0;

      const unsubscribe = system.onExpiryCycleComplete(() => {
        callCount++;
      });

      system.runTimeboundExpiryCycle();
      expect(callCount).toBe(1);

      unsubscribe();
      system.runTimeboundExpiryCycle();
      expect(callCount).toBe(1); // Should not have incremented
    });
  });

  describe('Automatic Expiry Checking', () => {
    test('should start and stop automatic checking', () => {
      expect(system.isTimeboundExpiryRunning()).toBe(false);

      system.startTimeboundExpiryChecks();
      expect(system.isTimeboundExpiryRunning()).toBe(true);

      system.stopTimeboundExpiryChecks();
      expect(system.isTimeboundExpiryRunning()).toBe(false);
    });

    test('should not start multiple times', () => {
      system.startTimeboundExpiryChecks();
      system.startTimeboundExpiryChecks();

      // Should only have one interval running
      expect(system.isTimeboundExpiryRunning()).toBe(true);

      system.stopTimeboundExpiryChecks();
      expect(system.isTimeboundExpiryRunning()).toBe(false);
    });

    test('should get and set check interval', () => {
      const defaultInterval = system.getTimeboundExpiryInterval();
      expect(defaultInterval).toBe(60000); // Default is 1 minute

      system.setTimeboundExpiryInterval(30000);
      expect(system.getTimeboundExpiryInterval()).toBe(30000);
    });

    test('should restart with new interval if running', () => {
      system.startTimeboundExpiryChecks();
      expect(system.isTimeboundExpiryRunning()).toBe(true);

      system.setTimeboundExpiryInterval(30000);

      // Should still be running with new interval
      expect(system.isTimeboundExpiryRunning()).toBe(true);
      expect(system.getTimeboundExpiryInterval()).toBe(30000);
    });

    test('should run initial check when starting', (done) => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: pastDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.onExpiryCycleComplete((result) => {
        expect(result.contracts_expired).toBe(1);
        system.stopTimeboundExpiryChecks();
        done();
      });

      system.startTimeboundExpiryChecks();
    });
  });

  describe('Statistics', () => {
    test('should track statistics across cycles', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      // Create some contracts to expire
      for (let i = 0; i < 2; i++) {
        let contract = system.createEpisodicContract('alice', {
          domains: [`domain-${i}`],
        }, {
          retention: 'timebound',
          retentionUntil: pastDate,
        });
        contract = system.submitForReview(contract.contract_id, 'alice');
        system.activateContract(contract.contract_id, 'alice');
      }

      system.runTimeboundExpiryCycle();

      const stats = system.getTimeboundExpiryStats();
      expect(stats.cyclesCompleted).toBe(1);
      expect(stats.totalContractsExpired).toBe(2);
      expect(stats.lastCheckAt).toBeInstanceOf(Date);
    });

    test('should reset statistics', () => {
      system.runTimeboundExpiryCycle();
      system.runTimeboundExpiryCycle();

      let stats = system.getTimeboundExpiryStats();
      expect(stats.cyclesCompleted).toBe(2);

      system.resetTimeboundExpiryStats();

      stats = system.getTimeboundExpiryStats();
      expect(stats.cyclesCompleted).toBe(0);
      expect(stats.totalContractsExpired).toBe(0);
    });

    test('should calculate next check time when running', () => {
      system.setTimeboundExpiryInterval(60000);
      system.startTimeboundExpiryChecks();

      const stats = system.getTimeboundExpiryStats();
      expect(stats.isRunning).toBe(true);
      expect(stats.lastCheckAt).toBeInstanceOf(Date);
      expect(stats.nextCheckAt).toBeInstanceOf(Date);

      // Next check should be approximately 1 minute after last check
      const timeDiff = stats.nextCheckAt!.getTime() - stats.lastCheckAt!.getTime();
      expect(timeDiff).toBe(60000);
    });
  });

  describe('Mixed Retention Types', () => {
    test('should only expire timebound contracts, not permanent or session', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      // Create timebound contract (should expire)
      let timeboundContract = system.createEpisodicContract('alice', {
        domains: ['timebound-domain'],
      }, {
        retention: 'timebound',
        retentionUntil: pastDate,
      });
      timeboundContract = system.submitForReview(timeboundContract.contract_id, 'alice');
      timeboundContract = system.activateContract(timeboundContract.contract_id, 'alice');

      // Create permanent contract (should not expire)
      let permanentContract = system.createEpisodicContract('alice', {
        domains: ['permanent-domain'],
      }, {
        retention: 'permanent',
      });
      permanentContract = system.submitForReview(permanentContract.contract_id, 'alice');
      permanentContract = system.activateContract(permanentContract.contract_id, 'alice');

      // Create session contract (should not expire via timebound check)
      let sessionContract = system.createEpisodicContract('alice', {
        domains: ['session-domain'],
      }, {
        retention: 'session',
      });
      sessionContract = system.submitForReview(sessionContract.contract_id, 'alice');
      sessionContract = system.activateContract(sessionContract.contract_id, 'alice');

      const result = system.runTimeboundExpiryCycle();

      expect(result.contracts_expired).toBe(1);
      expect(result.results[0].contract_id).toBe(timeboundContract.contract_id);

      // Verify states
      expect(system.getContract(timeboundContract.contract_id)?.state).toBe(ContractState.EXPIRED);
      expect(system.getContract(permanentContract.contract_id)?.state).toBe(ContractState.ACTIVE);
      expect(system.getContract(sessionContract.contract_id)?.state).toBe(ContractState.ACTIVE);
    });
  });

  describe('Audit Logging', () => {
    test('should log expiry events to audit log', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: 'timebound',
        retentionUntil: pastDate,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.runTimeboundExpiryCycle();

      const auditLog = system.getAuditLog();
      const contractEvents = auditLog.filter(e => e.contract_id === contract.contract_id);

      // Should have: created, reviewed, activated, expired
      expect(contractEvents.length).toBeGreaterThanOrEqual(4);

      // Find the expiry event
      const expiryEvent = contractEvents.find(e => e.new_state === ContractState.EXPIRED);
      expect(expiryEvent).toBeDefined();
    });
  });
});
