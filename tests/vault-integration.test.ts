/**
 * Memory Vault Integration Tests
 */

import {
  LearningContractsSystem,
  MockMemoryVaultAdapter,
  ContractEnforcedVault,
  BoundaryMode,
  ClassificationLevel,
} from '../src';

describe('MockMemoryVaultAdapter', () => {
  let adapter: MockMemoryVaultAdapter;

  beforeEach(() => {
    adapter = new MockMemoryVaultAdapter();
  });

  describe('checkConnection', () => {
    test('should report connection status', async () => {
      const status = await adapter.checkConnection();

      expect(status.connected).toBe(true);
      expect(status.version).toBe('1.0.0-mock');
    });
  });

  describe('storeMemory', () => {
    test('should store a memory successfully', async () => {
      const result = await adapter.storeMemory({
        content: 'Test memory content',
        classification: ClassificationLevel.LOW,
        created_by: 'test-user',
      });

      expect(result.success).toBe(true);
      expect(result.memory_id).toBeDefined();
      expect(result.content_hash).toBeDefined();
    });

    test('should fail to store when vault is locked', async () => {
      await adapter.lockdown('Test lockdown');

      const result = await adapter.storeMemory({
        content: 'Test memory content',
        classification: ClassificationLevel.LOW,
        created_by: 'test-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('locked');
    });
  });

  describe('recallMemory', () => {
    test('should recall a stored memory', async () => {
      const storeResult = await adapter.storeMemory({
        content: 'Test memory content',
        classification: ClassificationLevel.LOW,
        created_by: 'test-user',
      });

      const recallResult = await adapter.recallMemory({
        memory_id: storeResult.memory_id!,
        requester: 'test-user',
        justification: 'Testing',
      });

      expect(recallResult.success).toBe(true);
      expect(recallResult.memory).toBeDefined();
      expect(recallResult.content).toBeDefined();
    });

    test('should fail to recall non-existent memory', async () => {
      const result = await adapter.recallMemory({
        memory_id: 'non-existent-id',
        requester: 'test-user',
        justification: 'Testing',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should fail to recall tombstoned memory', async () => {
      const storeResult = await adapter.storeMemory({
        content: 'Test memory content',
        classification: ClassificationLevel.LOW,
        created_by: 'test-user',
      });

      await adapter.tombstoneMemory({
        memory_id: storeResult.memory_id!,
        reason: 'Test tombstone',
        requested_by: 'admin',
      });

      const recallResult = await adapter.recallMemory({
        memory_id: storeResult.memory_id!,
        requester: 'test-user',
        justification: 'Testing',
      });

      expect(recallResult.success).toBe(false);
      expect(recallResult.error).toContain('tombstoned');
    });
  });

  describe('queryMemories', () => {
    beforeEach(async () => {
      // Store some test memories
      await adapter.storeMemory({
        content: 'Memory 1',
        classification: ClassificationLevel.LOW,
        created_by: 'user-1',
        metadata: { contract_id: 'contract-1', domain: 'coding' },
      });

      await adapter.storeMemory({
        content: 'Memory 2',
        classification: ClassificationLevel.MEDIUM,
        created_by: 'user-2',
        metadata: { contract_id: 'contract-1', domain: 'testing' },
      });

      await adapter.storeMemory({
        content: 'Memory 3',
        classification: ClassificationLevel.LOW,
        created_by: 'user-1',
        metadata: { contract_id: 'contract-2', domain: 'coding' },
      });
    });

    test('should return all memories when no filter', async () => {
      const memories = await adapter.queryMemories({});

      expect(memories.length).toBe(3);
    });

    test('should filter by classification', async () => {
      const memories = await adapter.queryMemories({
        classification: ClassificationLevel.LOW,
      });

      expect(memories.length).toBe(2);
    });

    test('should apply pagination', async () => {
      const memories = await adapter.queryMemories({
        limit: 2,
        offset: 1,
      });

      expect(memories.length).toBe(2);
    });
  });

  describe('lockdown', () => {
    test('should lock and unlock vault', async () => {
      await adapter.lockdown('Security incident');
      let status = await adapter.getLockdownStatus();

      expect(status.is_locked).toBe(true);
      expect(status.reason).toBe('Security incident');

      await adapter.unlock();
      status = await adapter.getLockdownStatus();

      expect(status.is_locked).toBe(false);
    });
  });

  describe('verifyIntegrity', () => {
    test('should verify vault integrity', async () => {
      const result = await adapter.verifyIntegrity();

      expect(result.valid).toBe(true);
      expect(result.merkle_root).toBeDefined();
    });
  });
});

describe('ContractEnforcedVault', () => {
  let system: LearningContractsSystem;
  let adapter: MockMemoryVaultAdapter;
  let vault: ContractEnforcedVault;

  beforeEach(() => {
    system = new LearningContractsSystem();
    adapter = new MockMemoryVaultAdapter();
    vault = system.createContractEnforcedVault(
      adapter,
      BoundaryMode.NORMAL,
      'test-agent'
    );
  });

  describe('storeMemory - Contract Enforcement', () => {
    test('should allow memory storage with valid active contract', async () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
        contexts: ['project-x'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = await vault.storeMemory(
        {
          content: 'Test memory',
          classification: ClassificationLevel.LOW,
          domain: 'coding',
          context: 'project-x',
        },
        contract.contract_id
      );

      expect(result.success).toBe(true);
      expect(result.enforcement.allowed).toBe(true);
      expect(result.contract_id).toBe(contract.contract_id);
    });

    test('should deny memory storage without contract', async () => {
      const result = await vault.storeMemory({
        content: 'Test memory',
        classification: ClassificationLevel.LOW,
        domain: 'unknown-domain',
      });

      expect(result.success).toBe(false);
      expect(result.enforcement.allowed).toBe(false);
      expect(result.enforcement.reason).toContain('No applicable contract');
    });

    test('should deny memory storage for observation contract', async () => {
      let contract = system.createObservationContract('alice', {
        domains: ['finance'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = await vault.storeMemory(
        {
          content: 'Financial data',
          classification: ClassificationLevel.LOW,
          domain: 'finance',
        },
        contract.contract_id
      );

      expect(result.success).toBe(false);
      expect(result.enforcement.allowed).toBe(false);
      expect(result.enforcement.reason).toContain('Observation');
    });

    test('should deny memory storage for prohibited domain', async () => {
      let contract = system.createProhibitedContract('alice', {
        domains: ['medical'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = await vault.storeMemory(
        {
          content: 'Medical records',
          classification: ClassificationLevel.LOW,
          domain: 'medical',
        },
        contract.contract_id
      );

      expect(result.success).toBe(false);
      expect(result.enforcement.allowed).toBe(false);
      expect(result.enforcement.reason).toContain('Prohibited');
    });

    test('should deny memory storage exceeding classification cap', async () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      }, { classificationCap: 2 });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = await vault.storeMemory(
        {
          content: 'High classification data',
          classification: ClassificationLevel.CRITICAL,
          domain: 'test',
        },
        contract.contract_id
      );

      expect(result.success).toBe(false);
      expect(result.enforcement.allowed).toBe(false);
      expect(result.enforcement.reason).toContain('exceeds');
    });

    test('should deny memory storage for out-of-scope domain', async () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = await vault.storeMemory(
        {
          content: 'Finance data',
          classification: ClassificationLevel.LOW,
          domain: 'finance',
        },
        contract.contract_id
      );

      expect(result.success).toBe(false);
      expect(result.enforcement.allowed).toBe(false);
      expect(result.enforcement.reason).toContain('not in contract scope');
    });

    test('should deny memory storage for inactive contract', async () => {
      const contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      // Contract is still in DRAFT state

      const result = await vault.storeMemory(
        {
          content: 'Test data',
          classification: ClassificationLevel.LOW,
          domain: 'coding',
        },
        contract.contract_id
      );

      expect(result.success).toBe(false);
      expect(result.enforcement.allowed).toBe(false);
      expect(result.enforcement.reason).toContain('not active');
    });
  });

  describe('recallMemory - Contract Enforcement', () => {
    let contract: any;
    let storedMemoryId: string;

    beforeEach(async () => {
      contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Store a memory first
      const storeResult = await vault.storeMemory(
        {
          content: 'Test memory for recall',
          classification: ClassificationLevel.LOW,
          domain: 'coding',
        },
        contract.contract_id
      );

      storedMemoryId = storeResult.result!.memory_id!;
    });

    test('should allow recall with valid active contract', async () => {
      const result = await vault.recallMemory({
        memory_id: storedMemoryId,
        requester: 'alice',
        justification: 'Need to review',
        domain: 'coding',
      });

      expect(result.success).toBe(true);
      expect(result.enforcement.allowed).toBe(true);
    });

    test('should deny recall for revoked contract', async () => {
      system.revokeContract(contract.contract_id, 'alice', 'No longer needed');

      const result = await vault.recallMemory({
        memory_id: storedMemoryId,
        requester: 'alice',
        justification: 'Need to review',
        domain: 'coding',
      });

      expect(result.success).toBe(false);
      expect(result.enforcement.allowed).toBe(false);
      expect(result.enforcement.reason).toContain('revoked');
    });

    test('should deny recall with insufficient boundary mode', async () => {
      // Create strategic contract that requires TRUSTED mode
      let strategicContract = system.createStrategicContract('alice', {
        domains: ['business'],
      });
      strategicContract = system.submitForReview(strategicContract.contract_id, 'alice');
      strategicContract = system.activateContract(strategicContract.contract_id, 'alice');

      // Create a vault with TRUSTED mode for storing
      const trustedVault = system.createContractEnforcedVault(
        adapter,
        BoundaryMode.TRUSTED,
        'test-agent'
      );

      const storeResult = await trustedVault.storeMemory(
        {
          content: 'Strategic data',
          classification: ClassificationLevel.LOW,
          domain: 'business',
        },
        strategicContract.contract_id
      );

      // Now try to recall with NORMAL mode vault
      const result = await vault.recallMemory({
        memory_id: storeResult.result!.memory_id!,
        requester: 'alice',
        justification: 'Need to review',
        domain: 'business',
      });

      expect(result.success).toBe(false);
      expect(result.enforcement.allowed).toBe(false);
      expect(result.enforcement.reason).toContain('boundary mode');
    });
  });

  describe('tombstoneContractMemories', () => {
    test('should tombstone all memories for a contract', async () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Store multiple memories
      await vault.storeMemory(
        { content: 'Memory 1', classification: ClassificationLevel.LOW, domain: 'coding' },
        contract.contract_id
      );
      await vault.storeMemory(
        { content: 'Memory 2', classification: ClassificationLevel.LOW, domain: 'coding' },
        contract.contract_id
      );
      await vault.storeMemory(
        { content: 'Memory 3', classification: ClassificationLevel.LOW, domain: 'coding' },
        contract.contract_id
      );

      const tombstones = await vault.tombstoneContractMemories(
        contract.contract_id,
        'Contract revoked',
        'alice'
      );

      expect(tombstones.length).toBe(3);
      tombstones.forEach(t => {
        expect(t.reason).toBe('Contract revoked');
        expect(t.tombstoned_by).toBe('alice');
      });
    });
  });

  describe('queryMemories', () => {
    test('should query memories with contract filtering', async () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      await vault.storeMemory(
        { content: 'Memory 1', classification: ClassificationLevel.LOW, domain: 'coding' },
        contract.contract_id
      );
      await vault.storeMemory(
        { content: 'Memory 2', classification: ClassificationLevel.LOW, domain: 'coding' },
        contract.contract_id
      );

      const memories = await vault.queryMemories(
        { contract_id: contract.contract_id },
        'alice'
      );

      expect(memories.length).toBe(2);
    });
  });

  describe('Boundary Mode Changes', () => {
    test('should respect boundary mode changes', async () => {
      let contract = system.createStrategicContract('alice', {
        domains: ['business'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Start with TRUSTED mode
      vault.setBoundaryMode(BoundaryMode.TRUSTED);

      const storeResult = await vault.storeMemory(
        { content: 'Strategic data', classification: ClassificationLevel.LOW, domain: 'business' },
        contract.contract_id
      );

      expect(storeResult.success).toBe(true);

      // Recall should work in TRUSTED mode
      let recallResult = await vault.recallMemory({
        memory_id: storeResult.result!.memory_id!,
        requester: 'alice',
        justification: 'Review',
        domain: 'business',
      });

      expect(recallResult.success).toBe(true);

      // Downgrade to NORMAL mode
      vault.setBoundaryMode(BoundaryMode.NORMAL);

      // Recall should now fail
      recallResult = await vault.recallMemory({
        memory_id: storeResult.result!.memory_id!,
        requester: 'alice',
        justification: 'Review',
        domain: 'business',
      });

      expect(recallResult.success).toBe(false);
      expect(recallResult.enforcement.reason).toContain('boundary mode');
    });
  });
});

describe('LearningContractsSystem - Vault Integration', () => {
  let system: LearningContractsSystem;
  let adapter: MockMemoryVaultAdapter;

  beforeEach(() => {
    system = new LearningContractsSystem();
    adapter = new MockMemoryVaultAdapter();
  });

  describe('createContractEnforcedVault', () => {
    test('should create a contract-enforced vault', () => {
      const vault = system.createContractEnforcedVault(
        adapter,
        BoundaryMode.NORMAL,
        'test-agent'
      );

      expect(vault).toBeInstanceOf(ContractEnforcedVault);
      expect(vault.getBoundaryMode()).toBe(BoundaryMode.NORMAL);
    });

    test('should use system contract resolver', async () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const vault = system.createContractEnforcedVault(
        adapter,
        BoundaryMode.NORMAL,
        'test-agent'
      );

      const result = await vault.storeMemory(
        { content: 'Test', classification: ClassificationLevel.LOW, domain: 'test' },
        contract.contract_id
      );

      expect(result.success).toBe(true);
      expect(result.contract_id).toBe(contract.contract_id);
    });

    test('should use system contract finder', async () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
        contexts: ['project-x'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const vault = system.createContractEnforcedVault(
        adapter,
        BoundaryMode.NORMAL,
        'test-agent'
      );

      // Store without explicit contract_id - should find matching contract
      const result = await vault.storeMemory({
        content: 'Test',
        classification: ClassificationLevel.LOW,
        domain: 'coding',
        context: 'project-x',
      });

      expect(result.success).toBe(true);
      expect(result.contract_id).toBe(contract.contract_id);
    });
  });

  describe('Audit Integration', () => {
    test('should log vault events to audit log', async () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const vault = system.createContractEnforcedVault(
        adapter,
        BoundaryMode.NORMAL,
        'test-agent'
      );

      await vault.storeMemory(
        { content: 'Test', classification: ClassificationLevel.LOW, domain: 'test' },
        contract.contract_id
      );

      const auditLog = system.getAuditLog();
      const memoryCreatedEvents = auditLog.filter(
        e => e.details?.memory_id !== undefined
      );

      expect(memoryCreatedEvents.length).toBeGreaterThan(0);
    });
  });
});
