/**
 * Integration Tests
 *
 * Tests the ContractGovernedStore and enforcement middleware
 * as an external consumer would use them.
 */

import {
  LearningContractsSystem,
  BoundaryMode,
  RetentionDuration,
  ContractGovernedStore,
  InMemoryStore,
  createEnforcementMiddleware,
} from '../src';

describe('ContractGovernedStore', () => {
  let system: LearningContractsSystem;
  let store: InMemoryStore;
  let governed: ContractGovernedStore;

  beforeEach(() => {
    system = new LearningContractsSystem();
    store = new InMemoryStore();
    governed = new ContractGovernedStore(store, system);
  });

  function activateContract(
    createdBy: string,
    domains: string[],
    options: {
      contexts?: string[];
      tools?: string[];
      retention?: RetentionDuration;
      classificationCap?: number;
    } = {}
  ) {
    let contract = system.createEpisodicContract(createdBy, {
      domains,
      contexts: options.contexts ?? [],
      tools: options.tools ?? [],
    }, {
      classificationCap: options.classificationCap ?? 3,
      retention: options.retention ?? RetentionDuration.PERMANENT,
    });
    contract = system.submitForReview(contract.contract_id, createdBy);
    contract = system.activateContract(contract.contract_id, createdBy);
    return contract;
  }

  // ── Store operations ────────────────────────────────────────

  describe('store()', () => {
    test('should allow storing memory within contract scope', async () => {
      const contract = activateContract('alice', ['coding'], { contexts: ['project-x'] });

      const result = await governed.store({
        content: 'Use async/await',
        classification: 2,
        domain: 'coding',
        context: 'project-x',
      }, contract.contract_id);

      expect(result.allowed).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.content).toBe('Use async/await');
      expect(result.result!.contract_id).toBe(contract.contract_id);
      expect(store.size()).toBe(1);
    });

    test('should deny storing memory outside domain scope', async () => {
      const contract = activateContract('alice', ['coding']);

      const result = await governed.store({
        content: 'Financial data',
        classification: 2,
        domain: 'finance', // not in scope
      }, contract.contract_id);

      expect(result.allowed).toBe(false);
      expect(result.enforcement.reason).toBeDefined();
      expect(result.result).toBeUndefined();
      expect(store.size()).toBe(0);
    });

    test('should deny storing memory with classification exceeding cap', async () => {
      const contract = activateContract('alice', ['coding'], { classificationCap: 2 });

      const result = await governed.store({
        content: 'Top secret code',
        classification: 4, // exceeds cap of 2
        domain: 'coding',
      }, contract.contract_id);

      expect(result.allowed).toBe(false);
      expect(store.size()).toBe(0);
    });

    test('should deny storing under revoked contract', async () => {
      const contract = activateContract('alice', ['coding']);
      system.revokeContract(contract.contract_id, 'alice', 'Done');

      const result = await governed.store({
        content: 'Test',
        classification: 1,
        domain: 'coding',
      }, contract.contract_id);

      expect(result.allowed).toBe(false);
    });

    test('should deny storing under draft contract', async () => {
      const draft = system.createEpisodicContract('alice', { domains: ['coding'] });

      const result = await governed.store({
        content: 'Test',
        classification: 1,
        domain: 'coding',
      }, draft.contract_id);

      expect(result.allowed).toBe(false);
    });
  });

  // ── Store with discovery ────────────────────────────────────

  describe('storeWithDiscovery()', () => {
    test('should find applicable contract and store', async () => {
      activateContract('alice', ['coding'], { contexts: ['project-x'] });

      const result = await governed.storeWithDiscovery({
        content: 'Pattern found',
        classification: 2,
        domain: 'coding',
        context: 'project-x',
      });

      expect(result.allowed).toBe(true);
      expect(result.result).toBeDefined();
    });

    test('should deny when no applicable contract exists', async () => {
      // No contracts at all
      const result = await governed.storeWithDiscovery({
        content: 'Data',
        classification: 1,
        domain: 'unknown-domain',
      });

      expect(result.allowed).toBe(false);
      expect(result.enforcement.reason).toContain('No applicable contract');
    });

    test('should find prohibited contract and deny', async () => {
      // Create a prohibited contract for 'medical'
      let prohibited = system.createProhibitedContract('alice', {
        domains: ['medical'],
      });
      prohibited = system.submitForReview(prohibited.contract_id, 'alice');
      prohibited = system.activateContract(prohibited.contract_id, 'alice');

      const result = await governed.storeWithDiscovery({
        content: 'Medical info',
        classification: 1,
        domain: 'medical',
      });

      expect(result.allowed).toBe(false);
    });
  });

  // ── Recall operations ───────────────────────────────────────

  describe('recall()', () => {
    test('should allow recalling memories within scope', async () => {
      const contract = activateContract('alice', ['coding']);

      // Store a memory first
      await governed.store({
        content: 'Important pattern',
        classification: 2,
        domain: 'coding',
      }, contract.contract_id);

      // Recall
      const result = await governed.recall({
        domain: 'coding',
        requester: 'alice',
      }, contract.contract_id);

      expect(result.allowed).toBe(true);
      expect(result.result).toHaveLength(1);
      expect(result.result![0].content).toBe('Important pattern');
    });

    test('should deny recall under revoked contract', async () => {
      const contract = activateContract('alice', ['coding']);

      await governed.store({
        content: 'Data',
        classification: 1,
        domain: 'coding',
      }, contract.contract_id);

      system.revokeContract(contract.contract_id, 'alice', 'Done');

      const result = await governed.recall({
        domain: 'coding',
      }, contract.contract_id);

      expect(result.allowed).toBe(false);
    });

    test('should only return memories from the specified contract', async () => {
      const contract1 = activateContract('alice', ['coding']);
      const contract2 = activateContract('bob', ['coding']);

      await governed.store({
        content: 'From contract 1',
        classification: 1,
        domain: 'coding',
      }, contract1.contract_id);

      await governed.store({
        content: 'From contract 2',
        classification: 1,
        domain: 'coding',
      }, contract2.contract_id);

      const result = await governed.recall({
        domain: 'coding',
        requester: 'alice', // required: episodic contracts require owner for recall
      }, contract1.contract_id);

      expect(result.allowed).toBe(true);
      expect(result.result).toHaveLength(1);
      expect(result.result![0].content).toBe('From contract 1');
    });
  });

  // ── Forget operations ───────────────────────────────────────

  describe('forgetByContract()', () => {
    test('should forget all memories under a contract', async () => {
      const contract = activateContract('alice', ['coding']);

      await governed.store({
        content: 'Memory 1',
        classification: 1,
        domain: 'coding',
      }, contract.contract_id);

      await governed.store({
        content: 'Memory 2',
        classification: 1,
        domain: 'coding',
      }, contract.contract_id);

      expect(store.size()).toBe(2);

      const forgotten = await governed.forgetByContract(contract.contract_id);

      expect(forgotten).toHaveLength(2);
      expect(store.size()).toBe(0);
    });

    test('should not affect memories from other contracts', async () => {
      const contract1 = activateContract('alice', ['coding']);
      const contract2 = activateContract('bob', ['coding']);

      await governed.store({
        content: 'Alice memory',
        classification: 1,
        domain: 'coding',
      }, contract1.contract_id);

      await governed.store({
        content: 'Bob memory',
        classification: 1,
        domain: 'coding',
      }, contract2.contract_id);

      expect(store.size()).toBe(2);

      await governed.forgetByContract(contract1.contract_id);

      expect(store.size()).toBe(1);
    });
  });

  // ── Contract discovery ──────────────────────────────────────

  describe('findContract()', () => {
    test('should find applicable contract', () => {
      const contract = activateContract('alice', ['coding']);

      const found = governed.findContract('coding');

      expect(found).not.toBeNull();
      expect(found!.contract_id).toBe(contract.contract_id);
    });

    test('should return null when no contract applies', () => {
      const found = governed.findContract('unknown');
      expect(found).toBeNull();
    });
  });
});

describe('createEnforcementMiddleware', () => {
  let system: LearningContractsSystem;

  beforeEach(() => {
    system = new LearningContractsSystem();
  });

  function activateContract(domains: string[]) {
    let contract = system.createEpisodicContract('alice', { domains });
    contract = system.submitForReview(contract.contract_id, 'alice');
    contract = system.activateContract(contract.contract_id, 'alice');
    return contract;
  }

  test('beforeStore should check memory creation', () => {
    const middleware = createEnforcementMiddleware(system);
    const contract = activateContract(['coding']);

    const result = middleware.beforeStore(contract.contract_id, {
      domain: 'coding',
      classification: 2,
    });

    expect(result.allowed).toBe(true);
  });

  test('beforeStore should deny out-of-scope', () => {
    const middleware = createEnforcementMiddleware(system);
    const contract = activateContract(['coding']);

    const result = middleware.beforeStore(contract.contract_id, {
      domain: 'finance',
      classification: 2,
    });

    expect(result.allowed).toBe(false);
  });

  test('beforeRecall should check recall (with owner)', () => {
    const middleware = createEnforcementMiddleware(system);
    const contract = activateContract(['coding']);

    const result = middleware.beforeRecall(contract.contract_id, {
      domain: 'coding',
      requester: 'alice', // episodic contracts require owner for recall
    });

    expect(result.allowed).toBe(true);
  });

  test('beforeRecall should deny without requester (owner required)', () => {
    const middleware = createEnforcementMiddleware(system);
    const contract = activateContract(['coding']);

    const result = middleware.beforeRecall(contract.contract_id, {
      domain: 'coding',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('owner presence');
  });

  test('beforeExport should deny non-transferable contracts', () => {
    const middleware = createEnforcementMiddleware(system);
    const contract = activateContract(['coding']);

    const result = middleware.beforeExport(contract.contract_id);

    // Episodic contracts are non-transferable by default
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('transfer');
  });

  test('findContract should return contract ID', () => {
    const middleware = createEnforcementMiddleware(system);
    const contract = activateContract(['coding']);

    const found = middleware.findContract('coding');

    expect(found).toBe(contract.contract_id);
  });

  test('findContract should return null for unknown domain', () => {
    const middleware = createEnforcementMiddleware(system);

    const found = middleware.findContract('unknown');

    expect(found).toBeNull();
  });

  test('checkOrDeny should find contract and check in one call', () => {
    const middleware = createEnforcementMiddleware(system);
    activateContract(['coding']);

    const result = middleware.checkOrDeny({
      domain: 'coding',
      classification: 2,
    });

    expect(result.allowed).toBe(true);
  });

  test('checkOrDeny should deny when no contract exists', () => {
    const middleware = createEnforcementMiddleware(system);

    const result = middleware.checkOrDeny({
      domain: 'unknown',
      classification: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No applicable contract');
  });

  test('should respect custom boundary mode', () => {
    const middleware = createEnforcementMiddleware(system, BoundaryMode.RESTRICTED);

    let contract = system.createStrategicContract('alice', {
      domains: ['strategy'],
    });
    contract = system.submitForReview(contract.contract_id, 'alice');
    contract = system.activateContract(contract.contract_id, 'alice');

    // Strategic contracts require TRUSTED or higher boundary mode
    const result = middleware.beforeRecall(contract.contract_id, {
      domain: 'strategy',
    });

    // With RESTRICTED mode, strategic recall should be denied
    expect(result.allowed).toBe(false);
  });
});
