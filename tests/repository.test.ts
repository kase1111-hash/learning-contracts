/**
 * ContractRepository Tests
 *
 * Comprehensive tests for the storage repository including
 * initialization, CRUD operations, query filters, scope matching,
 * prohibited contract handling, expiration, and async operations.
 */

import { AuditLogger } from '../src/audit/logger';
import { ContractLifecycleManager } from '../src/contracts/lifecycle';
import { ContractFactory } from '../src/contracts/factory';
import { ContractRepository } from '../src/storage/repository';
import { MemoryStorageAdapter } from '../src/storage/memory-adapter';
import {
  ContractState,
  ContractType,
  LearningContract,
  RetentionDuration,
} from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const auditLogger = new AuditLogger();
const lifecycleManager = new ContractLifecycleManager(auditLogger);

function createActiveContract(
  type: string,
  owner: string,
  domains: string[] = ['coding'],
  options: { contexts?: string[]; tools?: string[]; expiration?: Date | null } = {}
): LearningContract {
  let draft;
  const scope: Record<string, unknown> = { domains };
  if (options.contexts) {
    scope.contexts = options.contexts;
  }
  if (options.tools) {
    scope.tools = options.tools;
  }

  switch (type) {
    case 'episodic':
      draft = ContractFactory.createEpisodicContract(owner, scope);
      break;
    case 'procedural':
      draft = ContractFactory.createProceduralContract(owner, scope);
      break;
    case 'strategic':
      draft = ContractFactory.createStrategicContract(owner, scope);
      break;
    case 'prohibited':
      draft = ContractFactory.createProhibitedContract(owner, scope);
      break;
    default:
      draft = ContractFactory.createObservationContract(owner, scope);
  }

  if (options.expiration !== undefined) {
    draft.expiration = options.expiration;
  }

  let contract = lifecycleManager.createDraft(draft);
  contract = lifecycleManager.submitForReview(contract, owner);
  contract = lifecycleManager.activate(contract, owner);
  return contract;
}

function createDraftContract(owner: string): LearningContract {
  const draft = ContractFactory.createObservationContract(owner, {
    domains: ['testing'],
  });
  return lifecycleManager.createDraft(draft);
}

function createReviewContract(owner: string): LearningContract {
  const draft = ContractFactory.createObservationContract(owner, {
    domains: ['testing'],
  });
  let contract = lifecycleManager.createDraft(draft);
  contract = lifecycleManager.submitForReview(contract, owner);
  return contract;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContractRepository', () => {
  let repo: ContractRepository;

  beforeEach(() => {
    repo = new ContractRepository();
  });

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  describe('initialize', () => {
    test('should load contracts from adapter and set initialized to true', async () => {
      const adapter = new MemoryStorageAdapter();
      const contract = createActiveContract('observation', 'alice');
      await adapter.save(contract);

      const customRepo = new ContractRepository({ adapter });
      expect(customRepo.isInitialized()).toBe(false);

      await customRepo.initialize();

      expect(customRepo.isInitialized()).toBe(true);
      expect(customRepo.count()).toBe(1);
      const retrieved = customRepo.get(contract.contract_id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.contract_id).toBe(contract.contract_id);
    });

    test('should be a no-op when called a second time', async () => {
      const adapter = new MemoryStorageAdapter();
      const repo2 = new ContractRepository({ adapter });

      await repo2.initialize();
      expect(repo2.isInitialized()).toBe(true);

      // Save a contract directly into the adapter after first initialize
      const contract = createActiveContract('observation', 'alice');
      await adapter.save(contract);

      // Second call should not re-load from adapter
      await repo2.initialize();
      expect(repo2.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // isInitialized / getAdapter
  // -------------------------------------------------------------------------

  describe('isInitialized', () => {
    test('should return false before initialization', () => {
      expect(repo.isInitialized()).toBe(false);
    });

    test('should return true after initialization', async () => {
      await repo.initialize();
      expect(repo.isInitialized()).toBe(true);
    });
  });

  describe('getAdapter', () => {
    test('should return the default MemoryStorageAdapter', () => {
      const adapter = repo.getAdapter();
      expect(adapter).toBeInstanceOf(MemoryStorageAdapter);
    });

    test('should return the custom adapter when one is provided', () => {
      const customAdapter = new MemoryStorageAdapter();
      const customRepo = new ContractRepository({ adapter: customAdapter });
      expect(customRepo.getAdapter()).toBe(customAdapter);
    });
  });

  // -------------------------------------------------------------------------
  // save / get
  // -------------------------------------------------------------------------

  describe('save and get', () => {
    test('should round-trip a contract correctly', () => {
      const contract = createActiveContract('episodic', 'alice');
      repo.save(contract);

      const retrieved = repo.get(contract.contract_id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.contract_id).toBe(contract.contract_id);
      expect(retrieved!.state).toBe(ContractState.ACTIVE);
      expect(retrieved!.contract_type).toBe(ContractType.EPISODIC);
      expect(retrieved!.created_by).toBe('alice');
    });

    test('should return null for a nonexistent contract ID', () => {
      const retrieved = repo.get('nonexistent-id');
      expect(retrieved).toBeNull();
    });

    test('should return a cloned object, not the same reference', () => {
      const contract = createActiveContract('observation', 'alice');
      repo.save(contract);

      const first = repo.get(contract.contract_id);
      const second = repo.get(contract.contract_id);

      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });

    test('should persist to adapter in background when initialized', async () => {
      const adapter = new MemoryStorageAdapter();
      const initRepo = new ContractRepository({ adapter });
      await initRepo.initialize();

      const contract = createActiveContract('observation', 'bob');
      initRepo.save(contract);

      // Wait for background write
      await initRepo.flush();

      const fromAdapter = await adapter.get(contract.contract_id);
      expect(fromAdapter).not.toBeNull();
      expect(fromAdapter!.contract_id).toBe(contract.contract_id);
    });
  });

  // -------------------------------------------------------------------------
  // saveAsync
  // -------------------------------------------------------------------------

  describe('saveAsync', () => {
    test('should persist contract to cache', async () => {
      const contract = createActiveContract('procedural', 'carol');
      await repo.saveAsync(contract);

      expect(repo.get(contract.contract_id)).not.toBeNull();
    });

    test('should persist to adapter when initialized', async () => {
      const adapter = new MemoryStorageAdapter();
      const initRepo = new ContractRepository({ adapter });
      await initRepo.initialize();

      const contract = createActiveContract('strategic', 'dave');
      await initRepo.saveAsync(contract);

      const fromAdapter = await adapter.get(contract.contract_id);
      expect(fromAdapter).not.toBeNull();
      expect(fromAdapter!.contract_id).toBe(contract.contract_id);
    });

    test('should not write to adapter when not initialized', async () => {
      const adapter = new MemoryStorageAdapter();
      const saveSpy = jest.spyOn(adapter, 'save');
      const uninitRepo = new ContractRepository({ adapter });

      const contract = createActiveContract('observation', 'eve');
      await uninitRepo.saveAsync(contract);

      expect(uninitRepo.get(contract.contract_id)).not.toBeNull();
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // exists
  // -------------------------------------------------------------------------

  describe('exists', () => {
    test('should return true for a saved contract', () => {
      const contract = createActiveContract('observation', 'alice');
      repo.save(contract);
      expect(repo.exists(contract.contract_id)).toBe(true);
    });

    test('should return false for a nonexistent contract', () => {
      expect(repo.exists('nonexistent-id')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    test('should remove contract from cache and return true', () => {
      const contract = createActiveContract('observation', 'alice');
      repo.save(contract);

      const result = repo.delete(contract.contract_id);
      expect(result).toBe(true);
      expect(repo.get(contract.contract_id)).toBeNull();
      expect(repo.exists(contract.contract_id)).toBe(false);
    });

    test('should return false for a nonexistent contract', () => {
      const result = repo.delete('nonexistent-id');
      expect(result).toBe(false);
    });

    test('should persist deletion to adapter in background when initialized', async () => {
      const adapter = new MemoryStorageAdapter();
      const initRepo = new ContractRepository({ adapter });
      await initRepo.initialize();

      const contract = createActiveContract('observation', 'alice');
      await initRepo.saveAsync(contract);

      initRepo.delete(contract.contract_id);
      await initRepo.flush();

      const fromAdapter = await adapter.get(contract.contract_id);
      expect(fromAdapter).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // deleteAsync
  // -------------------------------------------------------------------------

  describe('deleteAsync', () => {
    test('should remove from cache and adapter and return true', async () => {
      const adapter = new MemoryStorageAdapter();
      const initRepo = new ContractRepository({ adapter });
      await initRepo.initialize();

      const contract = createActiveContract('observation', 'alice');
      await initRepo.saveAsync(contract);

      const deleted = await initRepo.deleteAsync(contract.contract_id);
      expect(deleted).toBe(true);
      expect(initRepo.get(contract.contract_id)).toBeNull();

      const fromAdapter = await adapter.get(contract.contract_id);
      expect(fromAdapter).toBeNull();
    });

    test('should return false for a nonexistent contract', async () => {
      const deleted = await repo.deleteAsync('nonexistent-id');
      expect(deleted).toBe(false);
    });

    test('should not call adapter.delete when not initialized', async () => {
      const adapter = new MemoryStorageAdapter();
      const deleteSpy = jest.spyOn(adapter, 'delete');
      const uninitRepo = new ContractRepository({ adapter });

      const contract = createActiveContract('observation', 'alice');
      uninitRepo.save(contract);

      const deleted = await uninitRepo.deleteAsync(contract.contract_id);
      expect(deleted).toBe(true);
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getAll / count
  // -------------------------------------------------------------------------

  describe('getAll', () => {
    test('should return empty array when no contracts exist', () => {
      expect(repo.getAll()).toEqual([]);
    });

    test('should return all saved contracts', () => {
      const c1 = createActiveContract('observation', 'alice');
      const c2 = createActiveContract('episodic', 'bob');
      repo.save(c1);
      repo.save(c2);

      const all = repo.getAll();
      expect(all).toHaveLength(2);
    });

    test('should return cloned objects', () => {
      const contract = createActiveContract('observation', 'alice');
      repo.save(contract);

      const all = repo.getAll();
      const direct = repo.get(contract.contract_id);
      expect(all[0]).not.toBe(direct);
      expect(all[0]).toEqual(direct);
    });
  });

  describe('count', () => {
    test('should return 0 when empty', () => {
      expect(repo.count()).toBe(0);
    });

    test('should return correct count after saves', () => {
      repo.save(createActiveContract('observation', 'alice'));
      repo.save(createActiveContract('episodic', 'bob'));
      repo.save(createActiveContract('procedural', 'carol'));
      expect(repo.count()).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // countByState
  // -------------------------------------------------------------------------

  describe('countByState', () => {
    test('should return count of contracts in specified state', () => {
      repo.save(createActiveContract('observation', 'alice'));
      repo.save(createActiveContract('episodic', 'bob'));
      repo.save(createDraftContract('carol'));
      repo.save(createReviewContract('dave'));

      expect(repo.countByState(ContractState.ACTIVE)).toBe(2);
      expect(repo.countByState(ContractState.DRAFT)).toBe(1);
      expect(repo.countByState(ContractState.REVIEW)).toBe(1);
      expect(repo.countByState(ContractState.EXPIRED)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // query
  // -------------------------------------------------------------------------

  describe('query', () => {
    let activeObs: LearningContract;
    let activeEpi: LearningContract;
    let activeProc: LearningContract;
    let draftObs: LearningContract;

    beforeEach(() => {
      activeObs = createActiveContract('observation', 'alice', ['coding']);
      activeEpi = createActiveContract('episodic', 'bob', ['design'], {
        contexts: ['project-x'],
      });
      activeProc = createActiveContract('procedural', 'alice', ['finance'], {
        contexts: ['budgeting'],
      });
      draftObs = createDraftContract('carol');

      repo.save(activeObs);
      repo.save(activeEpi);
      repo.save(activeProc);
      repo.save(draftObs);
    });

    test('should return all contracts with empty options', () => {
      const results = repo.query({});
      expect(results).toHaveLength(4);
    });

    test('should filter by state', () => {
      const activeResults = repo.query({ state: ContractState.ACTIVE });
      expect(activeResults).toHaveLength(3);
      activeResults.forEach((c) => {
        expect(c.state).toBe(ContractState.ACTIVE);
      });

      const draftResults = repo.query({ state: ContractState.DRAFT });
      expect(draftResults).toHaveLength(1);
      expect(draftResults[0].state).toBe(ContractState.DRAFT);
    });

    test('should filter by contract_type', () => {
      const obsResults = repo.query({
        contract_type: ContractType.OBSERVATION,
      });
      expect(obsResults).toHaveLength(2); // activeObs + draftObs
      obsResults.forEach((c) => {
        expect(c.contract_type).toBe(ContractType.OBSERVATION);
      });

      const epiResults = repo.query({
        contract_type: ContractType.EPISODIC,
      });
      expect(epiResults).toHaveLength(1);
      expect(epiResults[0].contract_type).toBe(ContractType.EPISODIC);
    });

    test('should filter by created_by', () => {
      const aliceResults = repo.query({ created_by: 'alice' });
      expect(aliceResults).toHaveLength(2);
      aliceResults.forEach((c) => {
        expect(c.created_by).toBe('alice');
      });

      const bobResults = repo.query({ created_by: 'bob' });
      expect(bobResults).toHaveLength(1);
      expect(bobResults[0].created_by).toBe('bob');

      const noResults = repo.query({ created_by: 'nobody' });
      expect(noResults).toHaveLength(0);
    });

    test('should filter by domain', () => {
      const codingResults = repo.query({ domain: 'coding' });
      expect(codingResults.length).toBeGreaterThanOrEqual(1);
      codingResults.forEach((c) => {
        expect(c.scope.domains).toContain('coding');
      });

      const designResults = repo.query({ domain: 'design' });
      expect(designResults.length).toBeGreaterThanOrEqual(1);
      designResults.forEach((c) => {
        expect(c.scope.domains).toContain('design');
      });

      const noMatch = repo.query({ domain: 'nonexistent-domain' });
      expect(noMatch).toHaveLength(0);
    });

    test('should filter by context', () => {
      const projectResults = repo.query({ context: 'project-x' });
      expect(projectResults.length).toBeGreaterThanOrEqual(1);
      projectResults.forEach((c) => {
        expect(c.scope.contexts).toContain('project-x');
      });

      const budgetResults = repo.query({ context: 'budgeting' });
      expect(budgetResults.length).toBeGreaterThanOrEqual(1);
      budgetResults.forEach((c) => {
        expect(c.scope.contexts).toContain('budgeting');
      });

      const noCtx = repo.query({ context: 'nonexistent-context' });
      expect(noCtx).toHaveLength(0);
    });

    test('should filter by active_only (active state + non-expired)', () => {
      const activeOnly = repo.query({ active_only: true });
      expect(activeOnly).toHaveLength(3); // all three active contracts
      activeOnly.forEach((c) => {
        expect(c.state).toBe(ContractState.ACTIVE);
      });

      // Draft contract should be excluded
      const draftIds = activeOnly.map((c) => c.contract_id);
      expect(draftIds).not.toContain(draftObs.contract_id);
    });

    test('should exclude expired contracts from active_only', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      // Create contract first, then set expiration to past date
      // (validator rejects past expiration at creation time)
      const expiredActive = createActiveContract('observation', 'zara', ['coding']);
      expiredActive.expiration = pastDate;
      repo.save(expiredActive);

      const activeOnly = repo.query({ active_only: true });
      const ids = activeOnly.map((c) => c.contract_id);
      expect(ids).not.toContain(expiredActive.contract_id);
    });

    test('should combine multiple filters', () => {
      const results = repo.query({
        state: ContractState.ACTIVE,
        created_by: 'alice',
      });
      expect(results).toHaveLength(2); // activeObs + activeProc
      results.forEach((c) => {
        expect(c.state).toBe(ContractState.ACTIVE);
        expect(c.created_by).toBe('alice');
      });
    });
  });

  // -------------------------------------------------------------------------
  // getActiveContractsForScope
  // -------------------------------------------------------------------------

  describe('getActiveContractsForScope', () => {
    let codingContract: LearningContract;
    let designContract: LearningContract;
    let projectCtxContract: LearningContract;
    let gitToolContract: LearningContract;
    let emptyScope: LearningContract;

    beforeEach(() => {
      codingContract = createActiveContract('observation', 'alice', ['coding']);
      designContract = createActiveContract('episodic', 'bob', ['design'], {
        contexts: ['design-review'],
      });
      projectCtxContract = createActiveContract('procedural', 'carol', ['general'], {
        contexts: ['project-alpha'],
      });
      gitToolContract = createActiveContract('strategic', 'dave', ['devops'], {
        tools: ['git'],
      });
      // Contract with empty scope (matches anything)
      emptyScope = createActiveContract('observation', 'eve', []);

      repo.save(codingContract);
      repo.save(designContract);
      repo.save(projectCtxContract);
      repo.save(gitToolContract);
      repo.save(emptyScope);
    });

    test('should match contracts by domain', () => {
      const results = repo.getActiveContractsForScope('coding');
      const ids = results.map((c) => c.contract_id);
      expect(ids).toContain(codingContract.contract_id);
      expect(ids).not.toContain(designContract.contract_id);
    });

    test('should match contracts by context', () => {
      const results = repo.getActiveContractsForScope(undefined, 'project-alpha');
      const ids = results.map((c) => c.contract_id);
      expect(ids).toContain(projectCtxContract.contract_id);
    });

    test('should match contracts by tool', () => {
      const results = repo.getActiveContractsForScope(undefined, undefined, 'git');
      const ids = results.map((c) => c.contract_id);
      expect(ids).toContain(gitToolContract.contract_id);
    });

    test('should include contracts with empty scope (matches anything)', () => {
      const results = repo.getActiveContractsForScope('anything');
      const ids = results.map((c) => c.contract_id);
      expect(ids).toContain(emptyScope.contract_id);
    });

    test('should return all active contracts when no scope params given', () => {
      const results = repo.getActiveContractsForScope();
      expect(results).toHaveLength(5);
    });

    test('should match domain + context + tool together', () => {
      const multiScope = createActiveContract('procedural', 'frank', ['devops'], {
        contexts: ['ci-cd'],
        tools: ['docker'],
      });
      repo.save(multiScope);

      const results = repo.getActiveContractsForScope('devops', 'ci-cd', 'docker');
      const ids = results.map((c) => c.contract_id);
      expect(ids).toContain(multiScope.contract_id);
    });
  });

  // -------------------------------------------------------------------------
  // getProhibitedContracts
  // -------------------------------------------------------------------------

  describe('getProhibitedContracts', () => {
    test('should return active prohibited contracts', () => {
      const prohibited = createActiveContract('prohibited', 'admin', ['secrets']);
      const observation = createActiveContract('observation', 'alice', ['coding']);

      repo.save(prohibited);
      repo.save(observation);

      const results = repo.getProhibitedContracts();
      expect(results).toHaveLength(1);
      expect(results[0].contract_type).toBe(ContractType.PROHIBITED);
      expect(results[0].contract_id).toBe(prohibited.contract_id);
    });

    test('should return empty array when no prohibited contracts exist', () => {
      repo.save(createActiveContract('observation', 'alice'));
      expect(repo.getProhibitedContracts()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // findApplicableContract
  // -------------------------------------------------------------------------

  describe('findApplicableContract', () => {
    test('should return prohibited contract first when matching domain', () => {
      const prohibited = createActiveContract('prohibited', 'admin', ['secrets']);
      const regular = createActiveContract('observation', 'alice', ['secrets']);

      repo.save(regular);
      repo.save(prohibited);

      const result = repo.findApplicableContract('secrets');
      expect(result).not.toBeNull();
      expect(result!.contract_type).toBe(ContractType.PROHIBITED);
      expect(result!.contract_id).toBe(prohibited.contract_id);
    });

    test('should return prohibited contract first when matching context', () => {
      const prohibited = createActiveContract('prohibited', 'admin', [], {
        contexts: ['private-chat'],
      });
      const regular = createActiveContract('observation', 'alice', [], {
        contexts: ['private-chat'],
      });

      repo.save(regular);
      repo.save(prohibited);

      const result = repo.findApplicableContract(undefined, 'private-chat');
      expect(result).not.toBeNull();
      expect(result!.contract_type).toBe(ContractType.PROHIBITED);
    });

    test('should return prohibited contract first when matching tool', () => {
      const prohibited = createActiveContract('prohibited', 'admin', [], {
        tools: ['dangerous-tool'],
      });
      const regular = createActiveContract('observation', 'alice', [], {
        tools: ['dangerous-tool'],
      });

      repo.save(regular);
      repo.save(prohibited);

      const result = repo.findApplicableContract(undefined, undefined, 'dangerous-tool');
      expect(result).not.toBeNull();
      expect(result!.contract_type).toBe(ContractType.PROHIBITED);
    });

    test('should return regular active contract when no prohibited match', () => {
      const regular = createActiveContract('episodic', 'alice', ['coding']);
      repo.save(regular);

      const result = repo.findApplicableContract('coding');
      expect(result).not.toBeNull();
      expect(result!.contract_type).toBe(ContractType.EPISODIC);
      expect(result!.contract_id).toBe(regular.contract_id);
    });

    test('should return null when nothing matches', () => {
      const regular = createActiveContract('observation', 'alice', ['coding']);
      repo.save(regular);

      const result = repo.findApplicableContract('nonexistent-domain');
      expect(result).toBeNull();
    });

    test('should not return prohibited contract when scope does not match', () => {
      const prohibited = createActiveContract('prohibited', 'admin', ['secrets']);
      const regular = createActiveContract('observation', 'alice', ['coding']);

      repo.save(prohibited);
      repo.save(regular);

      const result = repo.findApplicableContract('coding');
      expect(result).not.toBeNull();
      expect(result!.contract_type).toBe(ContractType.OBSERVATION);
    });
  });

  // -------------------------------------------------------------------------
  // getExpiredContracts
  // -------------------------------------------------------------------------

  describe('getExpiredContracts', () => {
    test('should return active contracts with past expiration date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      // Create contract first, then set expiration to past date
      const expired = createActiveContract('observation', 'alice', ['coding']);
      expired.expiration = pastDate;
      const current = createActiveContract('episodic', 'bob', ['design']);

      repo.save(expired);
      repo.save(current);

      const results = repo.getExpiredContracts();
      expect(results).toHaveLength(1);
      expect(results[0].contract_id).toBe(expired.contract_id);
    });

    test('should not return contracts without expiration', () => {
      const noExpiry = createActiveContract('observation', 'alice', ['coding']);
      repo.save(noExpiry);

      const results = repo.getExpiredContracts();
      expect(results).toHaveLength(0);
    });

    test('should not return contracts with future expiration', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const future = createActiveContract('observation', 'alice', ['coding'], {
        expiration: futureDate,
      });
      repo.save(future);

      const results = repo.getExpiredContracts();
      expect(results).toHaveLength(0);
    });

    test('should not return non-active contracts even with past expiration', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const draft = createDraftContract('alice');
      draft.expiration = pastDate;
      repo.save(draft);

      const results = repo.getExpiredContracts();
      expect(results).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // getTimeboundExpiredContracts
  // -------------------------------------------------------------------------

  describe('getTimeboundExpiredContracts', () => {
    test('should return active timebound contracts with past retention_until', () => {
      const pastRetention = new Date();
      pastRetention.setDate(pastRetention.getDate() - 10);

      const contract = createActiveContract('episodic', 'alice', ['coding']);
      contract.memory_permissions.retention = RetentionDuration.TIMEBOUND;
      contract.memory_permissions.retention_until = pastRetention;
      repo.save(contract);

      const results = repo.getTimeboundExpiredContracts();
      expect(results).toHaveLength(1);
      expect(results[0].contract_id).toBe(contract.contract_id);
    });

    test('should not return contracts with future retention_until', () => {
      const futureRetention = new Date();
      futureRetention.setFullYear(futureRetention.getFullYear() + 1);

      const contract = createActiveContract('episodic', 'alice', ['coding']);
      contract.memory_permissions.retention = RetentionDuration.TIMEBOUND;
      contract.memory_permissions.retention_until = futureRetention;
      repo.save(contract);

      const results = repo.getTimeboundExpiredContracts();
      expect(results).toHaveLength(0);
    });

    test('should not return non-timebound contracts', () => {
      const contract = createActiveContract('procedural', 'alice', ['coding']);
      // procedural defaults to permanent retention
      repo.save(contract);

      const results = repo.getTimeboundExpiredContracts();
      expect(results).toHaveLength(0);
    });

    test('should not return non-active contracts', () => {
      const pastRetention = new Date();
      pastRetention.setDate(pastRetention.getDate() - 10);

      const draft = createDraftContract('alice');
      draft.memory_permissions.retention = RetentionDuration.TIMEBOUND;
      draft.memory_permissions.retention_until = pastRetention;
      repo.save(draft);

      const results = repo.getTimeboundExpiredContracts();
      expect(results).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // clear / clearAsync
  // -------------------------------------------------------------------------

  describe('clear', () => {
    test('should remove all contracts from cache', () => {
      repo.save(createActiveContract('observation', 'alice'));
      repo.save(createActiveContract('episodic', 'bob'));
      expect(repo.count()).toBe(2);

      repo.clear();
      expect(repo.count()).toBe(0);
      expect(repo.getAll()).toEqual([]);
    });

    test('should persist clearing to adapter when initialized', async () => {
      const adapter = new MemoryStorageAdapter();
      const initRepo = new ContractRepository({ adapter });
      await initRepo.initialize();

      const contract = createActiveContract('observation', 'alice');
      await initRepo.saveAsync(contract);

      initRepo.clear();
      await initRepo.flush();

      const adapterCount = await adapter.count();
      expect(adapterCount).toBe(0);
    });
  });

  describe('clearAsync', () => {
    test('should remove all contracts from cache', async () => {
      repo.save(createActiveContract('observation', 'alice'));
      repo.save(createActiveContract('episodic', 'bob'));
      expect(repo.count()).toBe(2);

      await repo.clearAsync();
      expect(repo.count()).toBe(0);
      expect(repo.getAll()).toEqual([]);
    });

    test('should persist clearing to adapter when initialized', async () => {
      const adapter = new MemoryStorageAdapter();
      const initRepo = new ContractRepository({ adapter });
      await initRepo.initialize();

      await initRepo.saveAsync(createActiveContract('observation', 'alice'));
      await initRepo.saveAsync(createActiveContract('episodic', 'bob'));

      await initRepo.clearAsync();

      const adapterCount = await adapter.count();
      expect(adapterCount).toBe(0);
    });

    test('should not call adapter.clear when not initialized', async () => {
      const adapter = new MemoryStorageAdapter();
      const clearSpy = jest.spyOn(adapter, 'clear');
      const uninitRepo = new ContractRepository({ adapter });

      uninitRepo.save(createActiveContract('observation', 'alice'));
      await uninitRepo.clearAsync();

      expect(uninitRepo.count()).toBe(0);
      expect(clearSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // flush / close
  // -------------------------------------------------------------------------

  describe('flush', () => {
    test('should wait for pending writes to complete', async () => {
      const adapter = new MemoryStorageAdapter();
      const initRepo = new ContractRepository({ adapter });
      await initRepo.initialize();

      const c1 = createActiveContract('observation', 'alice');
      const c2 = createActiveContract('episodic', 'bob');
      initRepo.save(c1);
      initRepo.save(c2);

      await initRepo.flush();

      const fromAdapter1 = await adapter.get(c1.contract_id);
      const fromAdapter2 = await adapter.get(c2.contract_id);
      expect(fromAdapter1).not.toBeNull();
      expect(fromAdapter2).not.toBeNull();
    });

    test('should be safe to call when no pending writes', async () => {
      await expect(repo.flush()).resolves.toBeUndefined();
    });
  });

  describe('close', () => {
    test('should flush pending writes and close adapter', async () => {
      const adapter = new MemoryStorageAdapter();
      const closeSpy = jest.spyOn(adapter, 'close');
      const initRepo = new ContractRepository({ adapter });
      await initRepo.initialize();

      const contract = createActiveContract('observation', 'alice');
      initRepo.save(contract);

      await initRepo.close();

      expect(closeSpy).toHaveBeenCalled();
      expect(initRepo.isInitialized()).toBe(false);
    });

    test('should set initialized to false', async () => {
      await repo.initialize();
      expect(repo.isInitialized()).toBe(true);

      await repo.close();
      expect(repo.isInitialized()).toBe(false);
    });
  });
});
