/**
 * Session Management Tests
 */

import {
  LearningContractsSystem,
  ContractState,
  RetentionDuration,
  SessionStatus,
} from '../src';

describe('Session Management', () => {
  let system: LearningContractsSystem;

  beforeEach(() => {
    system = new LearningContractsSystem();
  });

  describe('Session Lifecycle', () => {
    test('should start a new session', () => {
      const session = system.sessions.startSession('alice');

      expect(session).toBeDefined();
      expect(session.session_id).toBeDefined();
      expect(session.user_id).toBe('alice');
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.contract_ids).toEqual([]);
      expect(session.ended_at).toBeNull();
    });

    test('should start session with metadata', () => {
      const session = system.sessions.startSession('alice', {
        project: 'test-project',
        timeoutMs: 3600000,
      });

      expect(session.metadata).toEqual({
        project: 'test-project',
        timeoutMs: 3600000,
      });
    });

    test('should get session by ID', () => {
      const session = system.sessions.startSession('alice');
      const retrieved = system.sessions.getSession(session.session_id);

      expect(retrieved).toEqual(session);
    });

    test('should return null for non-existent session', () => {
      const retrieved = system.sessions.getSession('non-existent');
      expect(retrieved).toBeNull();
    });

    test('should get all active sessions', () => {
      system.sessions.startSession('alice');
      system.sessions.startSession('bob');

      const activeSessions = system.sessions.getActiveSessions();
      expect(activeSessions).toHaveLength(2);
    });

    test('should get sessions for a specific user', () => {
      system.sessions.startSession('alice');
      system.sessions.startSession('alice');
      system.sessions.startSession('bob');

      const aliceSessions = system.sessions.getUserSessions('alice');
      expect(aliceSessions).toHaveLength(2);
      expect(aliceSessions.every(s => s.user_id === 'alice')).toBe(true);
    });

    test('should end a session', () => {
      const session = system.sessions.startSession('alice');
      const result = system.sessions.endSession(session.session_id);

      expect(result.session_id).toBe(session.session_id);
      expect(result.ended_at).toBeDefined();
      expect(result.errors).toHaveLength(0);

      const endedSession = system.sessions.getSession(session.session_id);
      expect(endedSession?.status).toBe(SessionStatus.ENDED);
      expect(endedSession?.ended_at).toBeDefined();
    });

    test('should handle ending non-existent session', () => {
      const result = system.sessions.endSession('non-existent');

      expect(result.errors).toContain('Session not found');
    });

    test('should handle ending already ended session', () => {
      const session = system.sessions.startSession('alice');
      system.sessions.endSession(session.session_id);

      const result = system.sessions.endSession(session.session_id);
      expect(result.errors).toContain('Session already ended');
    });
  });

  describe('Contract Association', () => {
    test('should associate session-scoped contract with session', () => {
      const session = system.sessions.startSession('alice');

      // Create a session-scoped contract
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: RetentionDuration.SESSION,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const associated = system.sessions.associateContract(
        session.session_id,
        contract.contract_id
      );

      expect(associated).toBe(true);
      expect(system.sessions.isContractInSession(contract.contract_id)).toBe(true);
      expect(system.sessions.getContractSession(contract.contract_id)).toBe(session.session_id);

      const updatedSession = system.sessions.getSession(session.session_id);
      expect(updatedSession?.contract_ids).toContain(contract.contract_id);
    });

    test('should not associate non-session-scoped contract', () => {
      const session = system.sessions.startSession('alice');

      // Create a permanent contract
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: RetentionDuration.PERMANENT,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const associated = system.sessions.associateContract(
        session.session_id,
        contract.contract_id
      );

      expect(associated).toBe(false);
      expect(system.sessions.isContractInSession(contract.contract_id)).toBe(false);
    });

    test('should not associate contract with non-existent session', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: RetentionDuration.SESSION,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const associated = system.sessions.associateContract(
        'non-existent',
        contract.contract_id
      );

      expect(associated).toBe(false);
    });

    test('should not associate contract with ended session', () => {
      const session = system.sessions.startSession('alice');
      system.sessions.endSession(session.session_id);

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: RetentionDuration.SESSION,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const associated = system.sessions.associateContract(
        session.session_id,
        contract.contract_id
      );

      expect(associated).toBe(false);
    });
  });

  describe('Session Cleanup', () => {
    test('should expire contracts when session ends', () => {
      const session = system.sessions.startSession('alice');

      // Create and associate a session-scoped contract
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, {
        retention: RetentionDuration.SESSION,
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.sessions.associateContract(session.session_id, contract.contract_id);

      // End the session
      const result = system.sessions.endSession(session.session_id);

      expect(result.contracts_cleaned).toContain(contract.contract_id);

      // Contract should be expired
      const expiredContract = system.getContract(contract.contract_id);
      expect(expiredContract?.state).toBe(ContractState.EXPIRED);
    });

    test('should clean up multiple contracts when session ends', () => {
      const session = system.sessions.startSession('alice');

      // Create multiple session-scoped contracts
      const contracts = [];
      for (let i = 0; i < 3; i++) {
        let contract = system.createEpisodicContract('alice', {
          domains: [`domain-${i}`],
        }, {
          retention: RetentionDuration.SESSION,
        });
        contract = system.submitForReview(contract.contract_id, 'alice');
        contract = system.activateContract(contract.contract_id, 'alice');
        system.sessions.associateContract(session.session_id, contract.contract_id);
        contracts.push(contract);
      }

      // End the session
      const result = system.sessions.endSession(session.session_id);

      expect(result.contracts_cleaned).toHaveLength(3);

      // All contracts should be expired
      for (const contract of contracts) {
        const expiredContract = system.getContract(contract.contract_id);
        expect(expiredContract?.state).toBe(ContractState.EXPIRED);
      }
    });

    test('should not affect non-session contracts when session ends', () => {
      const session = system.sessions.startSession('alice');

      // Create a permanent contract (not associated with session)
      let permanentContract = system.createEpisodicContract('alice', {
        domains: ['permanent-domain'],
      }, {
        retention: RetentionDuration.PERMANENT,
      });
      permanentContract = system.submitForReview(permanentContract.contract_id, 'alice');
      permanentContract = system.activateContract(permanentContract.contract_id, 'alice');

      // Create a session-scoped contract
      let sessionContract = system.createEpisodicContract('alice', {
        domains: ['session-domain'],
      }, {
        retention: RetentionDuration.SESSION,
      });
      sessionContract = system.submitForReview(sessionContract.contract_id, 'alice');
      sessionContract = system.activateContract(sessionContract.contract_id, 'alice');
      system.sessions.associateContract(session.session_id, sessionContract.contract_id);

      // End the session
      system.sessions.endSession(session.session_id);

      // Permanent contract should still be active
      const stillActive = system.getContract(permanentContract.contract_id);
      expect(stillActive?.state).toBe(ContractState.ACTIVE);

      // Session contract should be expired
      const expired = system.getContract(sessionContract.contract_id);
      expect(expired?.state).toBe(ContractState.EXPIRED);
    });
  });

  describe('Session End Listeners', () => {
    test('should notify listeners when session ends', () => {
      const session = system.sessions.startSession('alice');

      let notified = false;
      let receivedSession: any = null;
      let receivedResult: any = null;

      system.sessions.onSessionEnd((s, r) => {
        notified = true;
        receivedSession = s;
        receivedResult = r;
      });

      system.sessions.endSession(session.session_id);

      expect(notified).toBe(true);
      expect(receivedSession.session_id).toBe(session.session_id);
      expect(receivedResult.session_id).toBe(session.session_id);
    });

    test('should allow unsubscribing from session end events', () => {
      const session = system.sessions.startSession('alice');

      let callCount = 0;
      const unsubscribe = system.sessions.onSessionEnd(() => {
        callCount++;
      });

      unsubscribe();
      system.sessions.endSession(session.session_id);

      expect(callCount).toBe(0);
    });
  });

  describe('Session Statistics', () => {
    test('should provide session statistics', () => {
      // Start some sessions
      system.sessions.startSession('alice');
      const session2 = system.sessions.startSession('bob');
      system.sessions.startSession('charlie');

      // End one session
      system.sessions.endSession(session2.session_id);

      const stats = system.sessions.getStats();

      expect(stats.totalSessions).toBe(3);
      expect(stats.activeSessions).toBe(2);
      expect(stats.endedSessions).toBe(1);
    });

    test('should track contracts in sessions', () => {
      const session = system.sessions.startSession('alice');

      let contract1 = system.createEpisodicContract('alice', {
        domains: ['domain1'],
      }, { retention: RetentionDuration.SESSION });
      contract1 = system.submitForReview(contract1.contract_id, 'alice');
      contract1 = system.activateContract(contract1.contract_id, 'alice');

      let contract2 = system.createEpisodicContract('alice', {
        domains: ['domain2'],
      }, { retention: RetentionDuration.SESSION });
      contract2 = system.submitForReview(contract2.contract_id, 'alice');
      contract2 = system.activateContract(contract2.contract_id, 'alice');

      system.sessions.associateContract(session.session_id, contract1.contract_id);
      system.sessions.associateContract(session.session_id, contract2.contract_id);

      const stats = system.sessions.getStats();
      expect(stats.totalContractsInSessions).toBe(2);
    });
  });

  describe('Session Cleanup Utility', () => {
    test('should clean up old ended sessions', () => {
      const session1 = system.sessions.startSession('alice');
      const session2 = system.sessions.startSession('bob');

      system.sessions.endSession(session1.session_id);
      system.sessions.endSession(session2.session_id);

      // Both sessions should still be in memory
      expect(system.sessions.getStats().totalSessions).toBe(2);

      // Clean up with 0 maxAge (all ended sessions)
      const cleaned = system.sessions.cleanupOldSessions(0);

      expect(cleaned).toBe(2);
      expect(system.sessions.getStats().totalSessions).toBe(0);
    });

    test('should not clean up active sessions', () => {
      system.sessions.startSession('alice');
      system.sessions.startSession('bob');

      const cleaned = system.sessions.cleanupOldSessions(0);

      expect(cleaned).toBe(0);
      expect(system.sessions.getStats().activeSessions).toBe(2);
    });
  });

  describe('End All User Sessions', () => {
    test('should end all sessions for a user', () => {
      // Create multiple sessions for alice
      const session1 = system.sessions.startSession('alice');
      const session2 = system.sessions.startSession('alice');
      system.sessions.startSession('bob'); // Should not be affected

      // Associate contracts with alice's sessions
      let contract1 = system.createEpisodicContract('alice', {
        domains: ['domain1'],
      }, { retention: RetentionDuration.SESSION });
      contract1 = system.submitForReview(contract1.contract_id, 'alice');
      contract1 = system.activateContract(contract1.contract_id, 'alice');
      system.sessions.associateContract(session1.session_id, contract1.contract_id);

      let contract2 = system.createEpisodicContract('alice', {
        domains: ['domain2'],
      }, { retention: RetentionDuration.SESSION });
      contract2 = system.submitForReview(contract2.contract_id, 'alice');
      contract2 = system.activateContract(contract2.contract_id, 'alice');
      system.sessions.associateContract(session2.session_id, contract2.contract_id);

      // End all of alice's sessions
      const results = system.sessions.endUserSessions('alice');

      expect(results).toHaveLength(2);

      // Both contracts should be expired
      expect(system.getContract(contract1.contract_id)?.state).toBe(ContractState.EXPIRED);
      expect(system.getContract(contract2.contract_id)?.state).toBe(ContractState.EXPIRED);

      // Bob's session should still be active
      const stats = system.sessions.getStats();
      expect(stats.activeSessions).toBe(1);
    });
  });

  describe('Audit Logging', () => {
    test('should log session events to audit log', () => {
      const session = system.sessions.startSession('alice');

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      }, { retention: RetentionDuration.SESSION });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');
      system.sessions.associateContract(session.session_id, contract.contract_id);

      system.sessions.endSession(session.session_id);

      const auditLog = system.getAuditLog();

      // Should have custom events for session operations
      const customEvents = auditLog.filter(
        e => e.details?.custom_event_name
      );

      expect(customEvents.length).toBeGreaterThan(0);
    });
  });
});
