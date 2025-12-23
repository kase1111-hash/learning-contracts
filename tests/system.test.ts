/**
 * Learning Contracts System Tests
 */

import {
  LearningContractsSystem,
  ContractType,
  ContractState,
  AbstractionLevel,
  BoundaryMode,
} from '../src';

describe('LearningContractsSystem', () => {
  let system: LearningContractsSystem;

  beforeEach(() => {
    system = new LearningContractsSystem();
  });

  describe('Contract Creation', () => {
    test('should create an observation contract', () => {
      const contract = system.createObservationContract('alice', {
        domains: ['finance'],
      });

      expect(contract.contract_type).toBe(ContractType.OBSERVATION);
      expect(contract.state).toBe(ContractState.DRAFT);
      expect(contract.memory_permissions.may_store).toBe(false);
      expect(contract.generalization_rules.allowed).toBe(false);
    });

    test('should create an episodic contract', () => {
      const contract = system.createEpisodicContract('bob', {
        domains: ['personal'],
        contexts: ['project-alpha'],
      });

      expect(contract.contract_type).toBe(ContractType.EPISODIC);
      expect(contract.memory_permissions.may_store).toBe(true);
      expect(contract.generalization_rules.allowed).toBe(false);
    });

    test('should create a procedural contract', () => {
      const contract = system.createProceduralContract('carol', {
        domains: ['coding'],
      });

      expect(contract.contract_type).toBe(ContractType.PROCEDURAL);
      expect(contract.generalization_rules.allowed).toBe(true);
      expect(contract.scope.max_abstraction).toBe(AbstractionLevel.HEURISTIC);
    });

    test('should create a strategic contract', () => {
      const contract = system.createStrategicContract('dave', {
        domains: ['business'],
      });

      expect(contract.contract_type).toBe(ContractType.STRATEGIC);
      expect(contract.recall_rules.boundary_mode_min).toBe(BoundaryMode.TRUSTED);
    });

    test('should create a prohibited contract', () => {
      const contract = system.createProhibitedContract('eve', {
        domains: ['medical'],
      });

      expect(contract.contract_type).toBe(ContractType.PROHIBITED);
      expect(contract.memory_permissions.may_store).toBe(false);
      expect(contract.revocable).toBe(false);
    });
  });

  describe('Contract Lifecycle', () => {
    test('should transition contract from draft to review to active', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });

      expect(contract.state).toBe(ContractState.DRAFT);

      contract = system.submitForReview(contract.contract_id, 'alice');
      expect(contract.state).toBe(ContractState.REVIEW);

      contract = system.activateContract(contract.contract_id, 'alice');
      expect(contract.state).toBe(ContractState.ACTIVE);
    });

    test('should revoke an active contract', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const revoked = system.revokeContract(
        contract.contract_id,
        'alice',
        'No longer needed'
      );

      expect(revoked.state).toBe(ContractState.REVOKED);
    });

    test('should amend a contract', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.amendContract(
        contract.contract_id,
        'alice',
        { scope: { domains: ['updated'], contexts: [], tools: [], max_abstraction: AbstractionLevel.RAW, transferable: false } },
        'Expanding scope'
      );

      expect(result.original.state).toBe(ContractState.AMENDED);
      expect(result.newDraft.state).toBe(ContractState.DRAFT);
      expect(result.newDraft.metadata?.amended_from).toBe(contract.contract_id);
    });
  });

  describe('Enforcement - Memory Creation', () => {
    test('should allow memory creation for valid episodic contract', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkMemoryCreation(
        contract.contract_id,
        BoundaryMode.NORMAL,
        2,
        { domain: 'coding' }
      );

      expect(result.allowed).toBe(true);
    });

    test('should deny memory creation for observation contract', () => {
      let contract = system.createObservationContract('alice', {
        domains: ['finance'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkMemoryCreation(
        contract.contract_id,
        BoundaryMode.NORMAL,
        1,
        { domain: 'finance' }
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not permit memory storage');
    });

    test('should deny memory creation if classification exceeds cap', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      }, { classificationCap: 2 });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkMemoryCreation(
        contract.contract_id,
        BoundaryMode.NORMAL,
        5,
        { domain: 'test' }
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds cap');
    });

    test('should deny memory creation for out-of-scope domain', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkMemoryCreation(
        contract.contract_id,
        BoundaryMode.NORMAL,
        2,
        { domain: 'finance' }
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in contract scope');
    });
  });

  describe('Enforcement - Abstraction', () => {
    test('should allow abstraction for procedural contract', () => {
      let contract = system.createProceduralContract('alice', {
        domains: ['coding'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkAbstraction(
        contract.contract_id,
        BoundaryMode.NORMAL,
        AbstractionLevel.HEURISTIC,
        { domain: 'coding' }
      );

      expect(result.allowed).toBe(true);
    });

    test('should deny abstraction for episodic contract', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkAbstraction(
        contract.contract_id,
        BoundaryMode.NORMAL,
        AbstractionLevel.PATTERN,
        { domain: 'test' }
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not permit generalization');
    });

    test('should deny abstraction exceeding max level', () => {
      let contract = system.createProceduralContract('alice', {
        domains: ['test'],
        max_abstraction: AbstractionLevel.PATTERN,
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkAbstraction(
        contract.contract_id,
        BoundaryMode.NORMAL,
        AbstractionLevel.STRATEGY,
        { domain: 'test' }
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds maximum');
    });
  });

  describe('Enforcement - Recall', () => {
    test('should allow recall with sufficient boundary mode', () => {
      let contract = system.createStrategicContract('alice', {
        domains: ['test'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkRecall(
        contract.contract_id,
        BoundaryMode.TRUSTED,
        { domain: 'test', requester: 'alice' }
      );

      expect(result.allowed).toBe(true);
    });

    test('should deny recall with insufficient boundary mode', () => {
      let contract = system.createStrategicContract('alice', {
        domains: ['test'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkRecall(
        contract.contract_id,
        BoundaryMode.NORMAL,
        { domain: 'test', requester: 'alice' }
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not meet minimum');
    });

    test('should deny recall for revoked contract', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');
      contract = system.revokeContract(contract.contract_id, 'alice', 'Test');

      const result = system.checkRecall(
        contract.contract_id,
        BoundaryMode.NORMAL,
        { domain: 'test', requester: 'alice' }
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('revoked');
    });
  });

  describe('Enforcement - Export', () => {
    test('should deny export for non-transferable contract', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const result = system.checkExport(
        contract.contract_id,
        BoundaryMode.NORMAL
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('prohibits memory transfer');
    });
  });

  describe('Audit', () => {
    test('should log all contract transitions', () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      const history = system.getContractHistory(contract.contract_id);

      expect(history.length).toBeGreaterThanOrEqual(3);
    });

    test('should log enforcement violations', () => {
      let contract = system.createObservationContract('alice', {
        domains: ['test'],
      });

      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      system.checkMemoryCreation(
        contract.contract_id,
        BoundaryMode.NORMAL,
        1,
        { domain: 'test' }
      );

      const violations = system.getViolations();
      expect(violations.length).toBeGreaterThan(0);
    });
  });
});
