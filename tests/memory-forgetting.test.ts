import {
  generatePurgeToken,
  MemoryForgetting,
  MemoryStatus,
  MemoryReference,
} from '../src/memory/forgetting';
import { AuditLogger } from '../src/audit/logger';
import { ContractFactory } from '../src/contracts/factory';
import { ContractLifecycleManager } from '../src/contracts/lifecycle';
import { LearningContract } from '../src/types';

describe('Memory Forgetting', () => {
  let auditLogger: AuditLogger;
  let lifecycleManager: ContractLifecycleManager;
  let forgetting: MemoryForgetting;

  beforeEach(() => {
    auditLogger = new AuditLogger();
    lifecycleManager = new ContractLifecycleManager(auditLogger);
    forgetting = new MemoryForgetting(auditLogger);
  });

  function createContract(state: 'active' | 'expired' | 'revoked'): LearningContract {
    const draft = ContractFactory.createEpisodicContract('owner', {
      domains: ['coding'],
    });
    let contract = lifecycleManager.createDraft(draft);
    contract = lifecycleManager.submitForReview(contract, 'owner');
    contract = lifecycleManager.activate(contract, 'owner');

    if (state === 'expired') {
      contract = lifecycleManager.expire(contract, 'system');
    } else if (state === 'revoked') {
      contract = lifecycleManager.revoke(contract, 'owner', 'test revocation');
    }
    return contract;
  }

  function makeMemories(contractId: string): MemoryReference[] {
    return [
      {
        memory_id: 'mem-1',
        contract_id: contractId,
        created_at: new Date(),
        classification: 2,
        is_derived: false,
      },
      {
        memory_id: 'mem-2',
        contract_id: contractId,
        created_at: new Date(),
        classification: 1,
        is_derived: false,
      },
      {
        memory_id: 'mem-3',
        contract_id: 'other-contract',
        created_at: new Date(),
        classification: 1,
        is_derived: false,
      },
    ];
  }

  describe('generatePurgeToken', () => {
    it('should return a token in nonce.timestamp.signature format', () => {
      const token = generatePurgeToken('contract-1', 'owner');
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // 16 bytes hex
      expect(parseInt(parts[1], 10)).toBeGreaterThan(0);
      expect(parts[2]).toHaveLength(64); // sha256 hex
    });

    it('should generate different tokens each call', () => {
      const token1 = generatePurgeToken('contract-1', 'owner');
      const token2 = generatePurgeToken('contract-1', 'owner');
      expect(token1).not.toBe(token2);
    });
  });

  describe('freezeMemories', () => {
    it('should freeze memories for an expired contract', () => {
      const contract = createContract('expired');
      const memories = makeMemories(contract.contract_id);

      const result = forgetting.freezeMemories(contract, memories);

      expect(result.status).toBe(MemoryStatus.FROZEN);
      expect(result.affected_memories).toHaveLength(2);
      expect(result.affected_memories).toContain('mem-1');
      expect(result.affected_memories).toContain('mem-2');
      expect(result.affected_derived).toHaveLength(0);
      expect(result.audit_preserved).toBe(true);
    });

    it('should only affect memories belonging to the contract', () => {
      const contract = createContract('expired');
      const memories = makeMemories(contract.contract_id);

      const result = forgetting.freezeMemories(contract, memories);

      expect(result.affected_memories).not.toContain('mem-3');
    });

    it('should throw if contract is not EXPIRED', () => {
      const contract = createContract('active');
      const memories = makeMemories(contract.contract_id);

      expect(() => forgetting.freezeMemories(contract, memories)).toThrow(
        'Can only freeze memories for expired contracts'
      );
    });

    it('should throw if contract is REVOKED', () => {
      const contract = createContract('revoked');
      const memories = makeMemories(contract.contract_id);

      expect(() => forgetting.freezeMemories(contract, memories)).toThrow(
        'Can only freeze memories for expired contracts'
      );
    });

    it('should log the freeze to audit', () => {
      const contract = createContract('expired');
      const memories = makeMemories(contract.contract_id);

      forgetting.freezeMemories(contract, memories);

      const events = auditLogger.export();
      const tombstoneEvents = events.filter(
        (e) => e.details?.action === 'frozen'
      );
      expect(tombstoneEvents).toHaveLength(1);
    });
  });

  describe('tombstoneMemories', () => {
    it('should tombstone memories for a revoked contract', () => {
      const contract = createContract('revoked');
      const memories = makeMemories(contract.contract_id);

      const result = forgetting.tombstoneMemories(contract, memories);

      expect(result.status).toBe(MemoryStatus.TOMBSTONED);
      expect(result.affected_memories).toHaveLength(2);
      expect(result.audit_preserved).toBe(true);
    });

    it('should throw if contract is not REVOKED', () => {
      const contract = createContract('active');
      const memories = makeMemories(contract.contract_id);

      expect(() => forgetting.tombstoneMemories(contract, memories)).toThrow(
        'Can only tombstone memories for revoked contracts'
      );
    });

    it('should find derived memories recursively', () => {
      const contract = createContract('revoked');
      const memories: MemoryReference[] = [
        {
          memory_id: 'direct-1',
          contract_id: contract.contract_id,
          created_at: new Date(),
          classification: 2,
          is_derived: false,
        },
        {
          memory_id: 'derived-1',
          contract_id: contract.contract_id,
          created_at: new Date(),
          classification: 2,
          is_derived: true,
          derived_from: ['direct-1'],
        },
        {
          memory_id: 'derived-2',
          contract_id: contract.contract_id,
          created_at: new Date(),
          classification: 2,
          is_derived: true,
          derived_from: ['derived-1'],
        },
      ];

      const result = forgetting.tombstoneMemories(contract, memories);

      expect(result.affected_memories).toContain('direct-1');
      expect(result.affected_derived).toContain('derived-1');
      expect(result.affected_derived).toContain('derived-2');
    });

    it('should handle a chain of derived memories (A->B->C) across contracts', () => {
      const contract = createContract('revoked');
      // A is a direct memory of the revoked contract
      // B is derived from A but belongs to a different contract
      // C is derived from B and also belongs to a different contract
      const memories: MemoryReference[] = [
        {
          memory_id: 'A',
          contract_id: contract.contract_id,
          created_at: new Date(),
          classification: 1,
          is_derived: false,
        },
        {
          memory_id: 'B',
          contract_id: 'other-contract',
          created_at: new Date(),
          classification: 1,
          is_derived: true,
          derived_from: ['A'],
        },
        {
          memory_id: 'C',
          contract_id: 'other-contract',
          created_at: new Date(),
          classification: 1,
          is_derived: true,
          derived_from: ['B'],
        },
      ];

      const result = forgetting.tombstoneMemories(contract, memories);

      expect(result.affected_memories).toEqual(['A']);
      expect(result.affected_derived).toContain('B');
      expect(result.affected_derived).toContain('C');
    });
  });

  describe('deepPurge', () => {
    it('should purge memories with a valid token and correct owner', () => {
      const contract = createContract('revoked');
      const memories = makeMemories(contract.contract_id);
      const token = generatePurgeToken(contract.contract_id, 'owner');

      const result = forgetting.deepPurge(contract, memories, {
        owner: 'owner',
        confirmation_token: token,
        timestamp: new Date(),
      });

      expect(result.status).toBe(MemoryStatus.PURGED);
      expect(result.affected_memories).toHaveLength(2);
      expect(result.audit_preserved).toBe(true);
    });

    it('should throw if owner does not match contract creator', () => {
      const contract = createContract('revoked');
      const memories = makeMemories(contract.contract_id);
      const token = generatePurgeToken(contract.contract_id, 'imposter');

      expect(() =>
        forgetting.deepPurge(contract, memories, {
          owner: 'imposter',
          confirmation_token: token,
          timestamp: new Date(),
        })
      ).toThrow('Only contract owner can perform deep purge');
    });

    it('should throw if token has invalid format', () => {
      const contract = createContract('revoked');
      const memories = makeMemories(contract.contract_id);

      expect(() =>
        forgetting.deepPurge(contract, memories, {
          owner: 'owner',
          confirmation_token: 'invalid-token-no-dots',
          timestamp: new Date(),
        })
      ).toThrow('Invalid purge token: Invalid token format');
    });

    it('should throw if token signature is wrong', () => {
      const contract = createContract('revoked');
      const memories = makeMemories(contract.contract_id);
      const token = generatePurgeToken(contract.contract_id, 'owner');
      const parts = token.split('.');
      // Corrupt the signature
      const corruptedToken = `${parts[0]}.${parts[1]}.${'a'.repeat(64)}`;

      expect(() =>
        forgetting.deepPurge(contract, memories, {
          owner: 'owner',
          confirmation_token: corruptedToken,
          timestamp: new Date(),
        })
      ).toThrow('Invalid purge token: Invalid token signature');
    });

    it('should throw if confirmation timestamp precedes token creation', () => {
      const contract = createContract('revoked');
      const memories = makeMemories(contract.contract_id);
      const token = generatePurgeToken(contract.contract_id, 'owner');

      expect(() =>
        forgetting.deepPurge(contract, memories, {
          owner: 'owner',
          confirmation_token: token,
          timestamp: new Date(0), // Far in the past
        })
      ).toThrow('Invalid purge token: Confirmation timestamp precedes token creation');
    });

    it('should find and include derived memories in purge', () => {
      const contract = createContract('revoked');
      const memories: MemoryReference[] = [
        {
          memory_id: 'source',
          contract_id: contract.contract_id,
          created_at: new Date(),
          classification: 2,
          is_derived: false,
        },
        {
          memory_id: 'derived',
          contract_id: contract.contract_id,
          created_at: new Date(),
          classification: 2,
          is_derived: true,
          derived_from: ['source'],
        },
      ];
      const token = generatePurgeToken(contract.contract_id, 'owner');

      const result = forgetting.deepPurge(contract, memories, {
        owner: 'owner',
        confirmation_token: token,
        timestamp: new Date(),
      });

      expect(result.affected_memories).toContain('source');
      expect(result.affected_derived).toContain('derived');
    });

    it('should log the purge to audit with owner confirmation details', () => {
      const contract = createContract('revoked');
      const memories = makeMemories(contract.contract_id);
      const token = generatePurgeToken(contract.contract_id, 'owner');

      forgetting.deepPurge(contract, memories, {
        owner: 'owner',
        confirmation_token: token,
        timestamp: new Date(),
      });

      const events = auditLogger.export();
      const purgeEvents = events.filter((e) => e.details?.action === 'purged');
      expect(purgeEvents).toHaveLength(1);
      expect(purgeEvents[0].details?.owner_confirmation).toBeDefined();
    });
  });

  describe('invalidateHeuristics', () => {
    it('should return heuristic IDs that have revoked source memories', () => {
      const heuristics = [
        { heuristic_id: 'h1', derived_from: ['mem-1', 'mem-2'] },
        { heuristic_id: 'h2', derived_from: ['mem-3', 'mem-4'] },
        { heuristic_id: 'h3', derived_from: ['mem-1'] },
      ];

      const result = forgetting.invalidateHeuristics(['mem-1'], heuristics);

      expect(result).toContain('h1');
      expect(result).toContain('h3');
      expect(result).not.toContain('h2');
    });

    it('should return empty array when no heuristics match', () => {
      const heuristics = [
        { heuristic_id: 'h1', derived_from: ['mem-5'] },
      ];

      const result = forgetting.invalidateHeuristics(['mem-1'], heuristics);

      expect(result).toHaveLength(0);
    });

    it('should return empty array with empty memoryIds', () => {
      const heuristics = [
        { heuristic_id: 'h1', derived_from: ['mem-1'] },
      ];

      const result = forgetting.invalidateHeuristics([], heuristics);

      expect(result).toHaveLength(0);
    });

    it('should return empty array with empty heuristics list', () => {
      const result = forgetting.invalidateHeuristics(['mem-1'], []);

      expect(result).toHaveLength(0);
    });

    it('should log invalidated heuristics to audit', () => {
      const heuristics = [
        { heuristic_id: 'h1', derived_from: ['mem-1'] },
      ];

      forgetting.invalidateHeuristics(['mem-1'], heuristics);

      const events = auditLogger.export();
      const invalidationEvents = events.filter(
        (e) => e.details?.action === 'invalidated'
      );
      expect(invalidationEvents).toHaveLength(1);
    });

    it('should not log when no heuristics are invalidated', () => {
      const countBefore = auditLogger.getEventCount();

      forgetting.invalidateHeuristics(['mem-1'], []);

      expect(auditLogger.getEventCount()).toBe(countBefore);
    });
  });

  describe('isMemoryAccessible', () => {
    const dummyMemory: MemoryReference = {
      memory_id: 'mem-1',
      contract_id: 'contract-1',
      created_at: new Date(),
      classification: 2,
      is_derived: false,
    };

    it('should return false for EXPIRED contract (frozen)', () => {
      const contract = createContract('expired');
      const result = forgetting.isMemoryAccessible(dummyMemory, contract);

      expect(result.accessible).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should return false for REVOKED contract (tombstoned)', () => {
      const contract = createContract('revoked');
      const result = forgetting.isMemoryAccessible(dummyMemory, contract);

      expect(result.accessible).toBe(false);
      expect(result.reason).toContain('revoked');
    });

    it('should return false for DRAFT contract (not active)', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = lifecycleManager.createDraft(draft);
      const result = forgetting.isMemoryAccessible(dummyMemory, contract);

      expect(result.accessible).toBe(false);
      expect(result.reason).toContain('not active');
    });

    it('should return true for ACTIVE contract', () => {
      const contract = createContract('active');
      const result = forgetting.isMemoryAccessible(dummyMemory, contract);

      expect(result.accessible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false for REVIEW contract (not active)', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      let contract = lifecycleManager.createDraft(draft);
      contract = lifecycleManager.submitForReview(contract, 'owner');
      const result = forgetting.isMemoryAccessible(dummyMemory, contract);

      expect(result.accessible).toBe(false);
      expect(result.reason).toContain('not active');
    });
  });
});
