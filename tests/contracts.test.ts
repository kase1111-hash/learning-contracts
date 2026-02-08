/**
 * Comprehensive tests for the contracts module:
 *   - ContractValidator (validate + validateTransition)
 *   - ContractLifecycleManager (full lifecycle + edge cases)
 *   - ContractFactory (branch edge cases for defaults)
 */

import { ContractFactory } from '../src/contracts/factory';
import { ContractLifecycleManager, ContractDraft } from '../src/contracts/lifecycle';
import { ContractValidator } from '../src/contracts/validator';
import {
  ContractType,
  ContractState,
  AbstractionLevel,
  RetentionDuration,
  BoundaryMode,
  LearningContract,
} from '../src/types';
import { AuditLogger } from '../src/audit/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal valid LearningContract suitable for use in validator tests.
 * All fields satisfy every validation rule so individual tests can override
 * exactly the field(s) they want to break.
 */
function createValidContract(overrides: Partial<LearningContract> = {}): LearningContract {
  const now = new Date();
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // +90 days

  return {
    contract_id: 'test-contract-001',
    created_at: now,
    created_by: 'alice',
    state: ContractState.DRAFT,
    contract_type: ContractType.EPISODIC,
    scope: {
      domains: ['finance'],
      contexts: ['project-alpha'],
      tools: ['calculator'],
      max_abstraction: AbstractionLevel.RAW,
      transferable: false,
    },
    memory_permissions: {
      may_store: true,
      classification_cap: 3,
      retention: RetentionDuration.TIMEBOUND,
      retention_until: future,
    },
    generalization_rules: {
      allowed: false,
      conditions: [],
    },
    recall_rules: {
      requires_owner: true,
      boundary_mode_min: BoundaryMode.NORMAL,
    },
    expiration: future,
    revocable: true,
    ...overrides,
  };
}

/**
 * Creates a valid ContractDraft for use with the lifecycle manager.
 */
function createValidDraft(overrides: Partial<ContractDraft> = {}): ContractDraft {
  const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  return {
    created_by: 'alice',
    contract_type: ContractType.EPISODIC,
    scope: {
      domains: ['finance'],
      contexts: ['project-alpha'],
      tools: ['calculator'],
      max_abstraction: AbstractionLevel.RAW,
      transferable: false,
    },
    memory_permissions: {
      may_store: true,
      classification_cap: 3,
      retention: RetentionDuration.TIMEBOUND,
      retention_until: future,
    },
    generalization_rules: {
      allowed: false,
      conditions: [],
    },
    recall_rules: {
      requires_owner: true,
      boundary_mode_min: BoundaryMode.NORMAL,
    },
    expiration: future,
    revocable: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ContractValidator.validate()
// ---------------------------------------------------------------------------

describe('ContractValidator', () => {
  describe('validate()', () => {
    // -- Basic required fields --

    test('should error when contract_id is an empty string', () => {
      const contract = createValidContract({ contract_id: '' });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Contract ID is required');
    });

    test('should error when created_by is an empty string', () => {
      const contract = createValidContract({ created_by: '' });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Creator (created_by) is required');
    });

    test('should error for an invalid contract_type', () => {
      const contract = createValidContract({
        contract_type: 'unknown' as ContractType,
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Invalid contract type')])
      );
    });

    // -- Observation type-specific rules --

    test('should error when observation contract has may_store=true', () => {
      const contract = createValidContract({
        contract_type: ContractType.OBSERVATION,
        memory_permissions: {
          may_store: true,
          classification_cap: 0,
          retention: RetentionDuration.SESSION,
        },
        generalization_rules: { allowed: false, conditions: [] },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Observation contracts must not allow memory storage'
      );
    });

    test('should error when observation contract allows generalization', () => {
      const contract = createValidContract({
        contract_type: ContractType.OBSERVATION,
        memory_permissions: {
          may_store: false,
          classification_cap: 0,
          retention: RetentionDuration.SESSION,
        },
        generalization_rules: {
          allowed: true,
          conditions: ['some condition'],
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Observation contracts must not allow generalization'
      );
    });

    // -- Episodic type-specific rules --

    test('should error when episodic contract allows generalization', () => {
      const contract = createValidContract({
        contract_type: ContractType.EPISODIC,
        generalization_rules: {
          allowed: true,
          conditions: ['some condition'],
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Episodic contracts must not allow generalization'
      );
    });

    // -- Procedural type-specific rules --

    test('should warn when procedural contract has generalization with abstraction above HEURISTIC', () => {
      const contract = createValidContract({
        contract_type: ContractType.PROCEDURAL,
        scope: {
          domains: ['coding'],
          contexts: ['dev'],
          tools: ['lint'],
          max_abstraction: AbstractionLevel.STRATEGY,
          transferable: false,
        },
        generalization_rules: {
          allowed: true,
          conditions: ['Within specified domains only'],
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        'Procedural contracts should limit abstraction to pattern or heuristic'
      );
    });

    test('should not warn when procedural contract has generalization with HEURISTIC abstraction', () => {
      const contract = createValidContract({
        contract_type: ContractType.PROCEDURAL,
        scope: {
          domains: ['coding'],
          contexts: ['dev'],
          tools: ['lint'],
          max_abstraction: AbstractionLevel.HEURISTIC,
          transferable: false,
        },
        generalization_rules: {
          allowed: true,
          conditions: ['Within specified domains only'],
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.warnings).not.toContain(
        'Procedural contracts should limit abstraction to pattern or heuristic'
      );
    });

    test('should not warn when procedural contract has generalization with PATTERN abstraction', () => {
      const contract = createValidContract({
        contract_type: ContractType.PROCEDURAL,
        scope: {
          domains: ['coding'],
          contexts: ['dev'],
          tools: ['lint'],
          max_abstraction: AbstractionLevel.PATTERN,
          transferable: false,
        },
        generalization_rules: {
          allowed: true,
          conditions: ['Within specified domains only'],
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.warnings).not.toContain(
        'Procedural contracts should limit abstraction to pattern or heuristic'
      );
    });

    // -- Strategic type-specific rules --

    test('should error when strategic contract has non-TRUSTED/PRIVILEGED boundary mode', () => {
      const contract = createValidContract({
        contract_type: ContractType.STRATEGIC,
        memory_permissions: {
          may_store: true,
          classification_cap: 4,
          retention: RetentionDuration.PERMANENT,
        },
        generalization_rules: {
          allowed: true,
          conditions: ['High-confidence patterns only'],
        },
        recall_rules: {
          requires_owner: true,
          boundary_mode_min: BoundaryMode.NORMAL,
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Strategic contracts require trusted or privileged boundary mode'
      );
    });

    test('should pass for strategic contract with TRUSTED boundary mode', () => {
      const contract = createValidContract({
        contract_type: ContractType.STRATEGIC,
        memory_permissions: {
          may_store: true,
          classification_cap: 4,
          retention: RetentionDuration.PERMANENT,
        },
        generalization_rules: {
          allowed: true,
          conditions: ['High-confidence patterns only'],
        },
        recall_rules: {
          requires_owner: true,
          boundary_mode_min: BoundaryMode.TRUSTED,
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.errors).not.toContain(
        'Strategic contracts require trusted or privileged boundary mode'
      );
    });

    test('should pass for strategic contract with PRIVILEGED boundary mode', () => {
      const contract = createValidContract({
        contract_type: ContractType.STRATEGIC,
        memory_permissions: {
          may_store: true,
          classification_cap: 4,
          retention: RetentionDuration.PERMANENT,
        },
        generalization_rules: {
          allowed: true,
          conditions: ['High-confidence patterns only'],
        },
        recall_rules: {
          requires_owner: true,
          boundary_mode_min: BoundaryMode.PRIVILEGED,
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.errors).not.toContain(
        'Strategic contracts require trusted or privileged boundary mode'
      );
    });

    // -- Prohibited type-specific rules --

    test('should error when prohibited contract has may_store=true', () => {
      const contract = createValidContract({
        contract_type: ContractType.PROHIBITED,
        memory_permissions: {
          may_store: true,
          classification_cap: 0,
          retention: RetentionDuration.SESSION,
        },
        generalization_rules: { allowed: false, conditions: [] },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Prohibited contracts must not allow memory storage'
      );
    });

    test('should error when prohibited contract allows generalization', () => {
      const contract = createValidContract({
        contract_type: ContractType.PROHIBITED,
        memory_permissions: {
          may_store: false,
          classification_cap: 0,
          retention: RetentionDuration.SESSION,
        },
        generalization_rules: {
          allowed: true,
          conditions: ['some condition'],
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Prohibited contracts must not allow generalization'
      );
    });

    // -- Scope validation --

    test('should error when scope.domains is not an array', () => {
      const contract = createValidContract();
      (contract.scope as any).domains = 'not-an-array';
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Scope domains must be an array');
    });

    test('should error when scope.contexts is not an array', () => {
      const contract = createValidContract();
      (contract.scope as any).contexts = 'not-an-array';
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Scope contexts must be an array');
    });

    test('should error when scope.tools is not an array', () => {
      const contract = createValidContract();
      (contract.scope as any).tools = null;
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Scope tools must be an array');
    });

    test('should error for an invalid max_abstraction value', () => {
      const contract = createValidContract({
        scope: {
          domains: ['finance'],
          contexts: ['ctx'],
          tools: ['tool'],
          max_abstraction: 'invalid' as AbstractionLevel,
          transferable: false,
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Invalid abstraction level')])
      );
    });

    test('should warn when all scope arrays are empty', () => {
      const contract = createValidContract({
        scope: {
          domains: [],
          contexts: [],
          tools: [],
          max_abstraction: AbstractionLevel.RAW,
          transferable: false,
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.warnings).toContain(
        'All scope dimensions are empty - contract will deny all operations'
      );
    });

    // -- Memory permissions validation --

    test('should error when classification_cap is less than 0', () => {
      const contract = createValidContract({
        memory_permissions: {
          may_store: true,
          classification_cap: -1,
          retention: RetentionDuration.PERMANENT,
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Classification cap must be between 0 and 5'
      );
    });

    test('should error when classification_cap is greater than 5', () => {
      const contract = createValidContract({
        memory_permissions: {
          may_store: true,
          classification_cap: 6,
          retention: RetentionDuration.PERMANENT,
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Classification cap must be between 0 and 5'
      );
    });

    test('should error when timebound retention has no retention_until', () => {
      const contract = createValidContract({
        memory_permissions: {
          may_store: true,
          classification_cap: 3,
          retention: RetentionDuration.TIMEBOUND,
          // retention_until intentionally omitted
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Timebound retention requires retention_until timestamp'
      );
    });

    test('should warn when retention_until is in the past', () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
      const contract = createValidContract({
        memory_permissions: {
          may_store: true,
          classification_cap: 3,
          retention: RetentionDuration.TIMEBOUND,
          retention_until: past,
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.warnings).toContain('Retention timestamp is in the past');
    });

    // -- Generalization rules validation --

    test('should warn when generalization allowed but no conditions specified', () => {
      const contract = createValidContract({
        contract_type: ContractType.PROCEDURAL,
        scope: {
          domains: ['coding'],
          contexts: ['dev'],
          tools: ['lint'],
          max_abstraction: AbstractionLevel.HEURISTIC,
          transferable: false,
        },
        generalization_rules: {
          allowed: true,
          conditions: [],
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.warnings).toContain(
        'Generalization is allowed but no conditions are specified'
      );
    });

    // -- Recall rules validation --

    test('should error for an invalid boundary_mode_min value', () => {
      const contract = createValidContract({
        recall_rules: {
          requires_owner: true,
          boundary_mode_min: 'invalid' as BoundaryMode,
        },
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Invalid boundary mode')])
      );
    });

    // -- Expiration validation --

    test('should error when expiration is before creation date', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const contract = createValidContract({
        created_at: now,
        expiration: past,
      });
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Expiration date cannot be before creation date'
      );
    });

    // -- Happy path: fully valid contract --

    test('should pass for a valid contract with all checks satisfied', () => {
      const contract = createValidContract();
      const result = ContractValidator.validate(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // ContractValidator.validateTransition()
  // -------------------------------------------------------------------------

  describe('validateTransition()', () => {
    // All valid transitions
    const validTransitions: [ContractState, ContractState][] = [
      [ContractState.DRAFT, ContractState.REVIEW],
      [ContractState.REVIEW, ContractState.ACTIVE],
      [ContractState.REVIEW, ContractState.DRAFT],
      [ContractState.ACTIVE, ContractState.EXPIRED],
      [ContractState.ACTIVE, ContractState.REVOKED],
      [ContractState.ACTIVE, ContractState.AMENDED],
      [ContractState.AMENDED, ContractState.REVIEW],
    ];

    test.each(validTransitions)(
      'should allow transition from %s to %s',
      (from, to) => {
        const result = ContractValidator.validateTransition(from, to);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    );

    // Invalid transitions
    const invalidTransitions: [ContractState, ContractState][] = [
      [ContractState.DRAFT, ContractState.ACTIVE],
      [ContractState.ACTIVE, ContractState.DRAFT],
      [ContractState.EXPIRED, ContractState.ACTIVE],
      [ContractState.REVOKED, ContractState.ACTIVE],
      [ContractState.REVIEW, ContractState.REVOKED],
    ];

    test.each(invalidTransitions)(
      'should reject transition from %s to %s',
      (from, to) => {
        const result = ContractValidator.validateTransition(from, to);
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.stringContaining(`Invalid transition from ${from} to ${to}`),
          ])
        );
      }
    );
  });
});

// ---------------------------------------------------------------------------
// ContractLifecycleManager
// ---------------------------------------------------------------------------

describe('ContractLifecycleManager', () => {
  let auditLogger: AuditLogger;
  let lifecycleManager: ContractLifecycleManager;

  beforeEach(() => {
    auditLogger = new AuditLogger();
    lifecycleManager = new ContractLifecycleManager(auditLogger);
  });

  // -------------------------------------------------------------------------
  // createDraft
  // -------------------------------------------------------------------------

  describe('createDraft()', () => {
    test('should create a contract in DRAFT state from a valid draft', () => {
      const draft = createValidDraft();
      const contract = lifecycleManager.createDraft(draft);

      expect(contract.state).toBe(ContractState.DRAFT);
      expect(contract.contract_id).toBeDefined();
      expect(contract.contract_id.length).toBeGreaterThan(0);
      expect(contract.created_at).toBeInstanceOf(Date);
      expect(contract.created_by).toBe('alice');
      expect(contract.contract_type).toBe(ContractType.EPISODIC);
      expect(contract.revocable).toBe(true);
    });

    test('should throw for an invalid draft', () => {
      const draft = createValidDraft({
        created_by: '',
      });

      expect(() => lifecycleManager.createDraft(draft)).toThrow(
        /Invalid contract draft/
      );
    });

    test('should default revocable to true when not provided', () => {
      const draft = createValidDraft();
      delete (draft as any).revocable;
      const contract = lifecycleManager.createDraft(draft);
      expect(contract.revocable).toBe(true);
    });

    test('should default expiration to null when not provided', () => {
      const draft = createValidDraft();
      delete (draft as any).expiration;
      const contract = lifecycleManager.createDraft(draft);
      expect(contract.expiration).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // submitForReview
  // -------------------------------------------------------------------------

  describe('submitForReview()', () => {
    test('should transition a DRAFT contract to REVIEW', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');

      expect(reviewed.state).toBe(ContractState.REVIEW);
      expect(reviewed.contract_id).toBe(contract.contract_id);
    });

    test('should throw when submitting a non-DRAFT contract for review', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      const activated = lifecycleManager.activate(reviewed, 'carol');

      expect(() =>
        lifecycleManager.submitForReview(activated, 'dave')
      ).toThrow(/Invalid state transition/);
    });
  });

  // -------------------------------------------------------------------------
  // activate
  // -------------------------------------------------------------------------

  describe('activate()', () => {
    test('should transition a REVIEW contract to ACTIVE', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      const activated = lifecycleManager.activate(reviewed, 'carol');

      expect(activated.state).toBe(ContractState.ACTIVE);
      expect(activated.contract_id).toBe(contract.contract_id);
    });

    test('should throw when activating a contract that fails re-validation', () => {
      // Create a valid contract, then tamper with it after review so it
      // fails the validate() call inside activate().
      const contract = lifecycleManager.createDraft(createValidDraft());
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');

      // Tamper: clear the created_by field so validation fails
      const tampered = { ...reviewed, created_by: '' };

      expect(() => lifecycleManager.activate(tampered, 'carol')).toThrow(
        /Cannot activate invalid contract/
      );
    });

    test('should throw when trying to activate a non-REVIEW contract', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());

      expect(() => lifecycleManager.activate(contract, 'carol')).toThrow(
        /Invalid state transition/
      );
    });
  });

  // -------------------------------------------------------------------------
  // expire
  // -------------------------------------------------------------------------

  describe('expire()', () => {
    test('should transition an ACTIVE contract to EXPIRED', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      const activated = lifecycleManager.activate(reviewed, 'carol');
      const expired = lifecycleManager.expire(activated, 'system');

      expect(expired.state).toBe(ContractState.EXPIRED);
      expect(expired.contract_id).toBe(contract.contract_id);
    });

    test('should throw when expiring a non-ACTIVE contract', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());

      expect(() => lifecycleManager.expire(contract, 'system')).toThrow(
        /Invalid state transition/
      );
    });
  });

  // -------------------------------------------------------------------------
  // revoke
  // -------------------------------------------------------------------------

  describe('revoke()', () => {
    test('should transition an ACTIVE revocable contract to REVOKED', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      const activated = lifecycleManager.activate(reviewed, 'carol');
      const revoked = lifecycleManager.revoke(activated, 'alice', 'No longer needed');

      expect(revoked.state).toBe(ContractState.REVOKED);
      expect(revoked.contract_id).toBe(contract.contract_id);
    });

    test('should throw when revoking a non-revocable contract', () => {
      const draft = createValidDraft({
        contract_type: ContractType.OBSERVATION,
        memory_permissions: {
          may_store: false,
          classification_cap: 0,
          retention: RetentionDuration.SESSION,
        },
        generalization_rules: { allowed: false, conditions: [] },
        revocable: false,
      });
      const contract = lifecycleManager.createDraft(draft);
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      const activated = lifecycleManager.activate(reviewed, 'carol');

      expect(() =>
        lifecycleManager.revoke(activated, 'alice', 'Trying to revoke')
      ).toThrow('Contract is not revocable');
    });

    test('should throw when revoking a non-ACTIVE contract', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());

      expect(() =>
        lifecycleManager.revoke(contract, 'alice', 'Too early')
      ).toThrow(/Invalid state transition/);
    });
  });

  // -------------------------------------------------------------------------
  // amend
  // -------------------------------------------------------------------------

  describe('amend()', () => {
    test('should transition an ACTIVE contract to AMENDED and return a new draft', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      const activated = lifecycleManager.activate(reviewed, 'carol');

      const { original, newDraft } = lifecycleManager.amend(
        activated,
        'alice',
        { created_by: 'alice' },
        'Updating scope'
      );

      expect(original.state).toBe(ContractState.AMENDED);
      expect(original.contract_id).toBe(contract.contract_id);

      expect(newDraft.state).toBe(ContractState.DRAFT);
      expect(newDraft.contract_id).not.toBe(contract.contract_id);
    });

    test('should set metadata.amended_from on the new draft', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      const activated = lifecycleManager.activate(reviewed, 'carol');

      const { newDraft } = lifecycleManager.amend(
        activated,
        'alice',
        {},
        'Minor tweak'
      );

      expect(newDraft.metadata).toBeDefined();
      expect(newDraft.metadata!.amended_from).toBe(activated.contract_id);
      expect(newDraft.metadata!.amendment_reason).toBe('Minor tweak');
    });

    test('should apply partial changes to the new draft', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      const activated = lifecycleManager.activate(reviewed, 'carol');

      const newScope = {
        domains: ['finance', 'analytics'],
        contexts: ['project-beta'],
        tools: ['calculator', 'spreadsheet'],
        max_abstraction: AbstractionLevel.RAW,
        transferable: false,
      };

      const { newDraft } = lifecycleManager.amend(
        activated,
        'alice',
        { scope: newScope },
        'Expanding scope'
      );

      expect(newDraft.scope.domains).toEqual(['finance', 'analytics']);
      expect(newDraft.scope.contexts).toEqual(['project-beta']);
    });

    test('should throw when amending a non-ACTIVE contract', () => {
      const contract = lifecycleManager.createDraft(createValidDraft());

      expect(() =>
        lifecycleManager.amend(contract, 'alice', {}, 'Nope')
      ).toThrow(/Invalid state transition/);
    });
  });

  // -------------------------------------------------------------------------
  // isExpired
  // -------------------------------------------------------------------------

  describe('isExpired()', () => {
    test('should return true for a contract in EXPIRED state', () => {
      const contract = createValidContract({ state: ContractState.EXPIRED });
      expect(lifecycleManager.isExpired(contract)).toBe(true);
    });

    test('should return true for a contract whose expiration date is in the past', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const contract = createValidContract({
        state: ContractState.ACTIVE,
        expiration: pastDate,
      });
      expect(lifecycleManager.isExpired(contract)).toBe(true);
    });

    test('should return false for an active contract with a future expiration', () => {
      const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const contract = createValidContract({
        state: ContractState.ACTIVE,
        expiration: futureDate,
      });
      expect(lifecycleManager.isExpired(contract)).toBe(false);
    });

    test('should return false for an active contract with null expiration', () => {
      const contract = createValidContract({
        state: ContractState.ACTIVE,
        expiration: null,
      });
      expect(lifecycleManager.isExpired(contract)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isEnforceable
  // -------------------------------------------------------------------------

  describe('isEnforceable()', () => {
    test('should return true for an ACTIVE non-expired contract', () => {
      const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const contract = createValidContract({
        state: ContractState.ACTIVE,
        expiration: futureDate,
      });
      expect(lifecycleManager.isEnforceable(contract)).toBe(true);
    });

    test('should return true for an ACTIVE contract with null expiration', () => {
      const contract = createValidContract({
        state: ContractState.ACTIVE,
        expiration: null,
      });
      expect(lifecycleManager.isEnforceable(contract)).toBe(true);
    });

    test('should return false for a non-ACTIVE contract', () => {
      const contract = createValidContract({
        state: ContractState.DRAFT,
      });
      expect(lifecycleManager.isEnforceable(contract)).toBe(false);
    });

    test('should return false for an ACTIVE contract that is expired by date', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const contract = createValidContract({
        state: ContractState.ACTIVE,
        expiration: pastDate,
      });
      expect(lifecycleManager.isEnforceable(contract)).toBe(false);
    });

    test('should return false for a REVOKED contract', () => {
      const contract = createValidContract({
        state: ContractState.REVOKED,
      });
      expect(lifecycleManager.isEnforceable(contract)).toBe(false);
    });

    test('should return false for an EXPIRED contract', () => {
      const contract = createValidContract({
        state: ContractState.EXPIRED,
      });
      expect(lifecycleManager.isEnforceable(contract)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// ContractFactory (edge cases for branch coverage)
// ---------------------------------------------------------------------------

describe('ContractFactory', () => {
  describe('createObservationContract()', () => {
    test('should set correct defaults', () => {
      const draft = ContractFactory.createObservationContract('alice');

      expect(draft.contract_type).toBe(ContractType.OBSERVATION);
      expect(draft.created_by).toBe('alice');
      expect(draft.memory_permissions.may_store).toBe(false);
      expect(draft.memory_permissions.classification_cap).toBe(0);
      expect(draft.memory_permissions.retention).toBe(RetentionDuration.SESSION);
      expect(draft.generalization_rules.allowed).toBe(false);
      expect(draft.generalization_rules.conditions).toEqual([]);
      expect(draft.scope.max_abstraction).toBe(AbstractionLevel.RAW);
      expect(draft.scope.transferable).toBe(false);
      expect(draft.scope.domains).toEqual([]);
      expect(draft.scope.contexts).toEqual([]);
      expect(draft.scope.tools).toEqual([]);
      expect(draft.recall_rules.requires_owner).toBe(true);
      expect(draft.recall_rules.boundary_mode_min).toBe(BoundaryMode.NORMAL);
      expect(draft.revocable).toBe(true);
    });

    test('should accept partial scope overrides', () => {
      const draft = ContractFactory.createObservationContract('alice', {
        domains: ['health'],
        contexts: ['clinic'],
      });

      expect(draft.scope.domains).toEqual(['health']);
      expect(draft.scope.contexts).toEqual(['clinic']);
      expect(draft.scope.tools).toEqual([]);
    });
  });

  describe('createEpisodicContract()', () => {
    test('should set correct defaults for timebound retention', () => {
      const draft = ContractFactory.createEpisodicContract('bob');

      expect(draft.contract_type).toBe(ContractType.EPISODIC);
      expect(draft.memory_permissions.may_store).toBe(true);
      expect(draft.memory_permissions.classification_cap).toBe(3);
      expect(draft.memory_permissions.retention).toBe(RetentionDuration.TIMEBOUND);
      expect(draft.memory_permissions.retention_until).toBeInstanceOf(Date);
      expect(draft.generalization_rules.allowed).toBe(false);
      expect(draft.scope.max_abstraction).toBe(AbstractionLevel.RAW);
      expect(draft.scope.transferable).toBe(false);
      expect(draft.recall_rules.requires_owner).toBe(true);
      expect(draft.revocable).toBe(true);
    });

    test('should default retention_until to approximately 30 days in the future for timebound', () => {
      const before = new Date();
      const draft = ContractFactory.createEpisodicContract('bob');
      const after = new Date();

      const expectedMin = new Date(before.getTime());
      expectedMin.setDate(expectedMin.getDate() + 30);
      const expectedMax = new Date(after.getTime());
      expectedMax.setDate(expectedMax.getDate() + 30);

      const retentionUntil = draft.memory_permissions.retention_until!;
      expect(retentionUntil.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime() - 1000);
      expect(retentionUntil.getTime()).toBeLessThanOrEqual(expectedMax.getTime() + 1000);
    });

    test('should use explicit retention and retentionUntil when provided', () => {
      const customDate = new Date('2030-06-15T00:00:00Z');
      const draft = ContractFactory.createEpisodicContract('bob', {}, {
        retention: RetentionDuration.TIMEBOUND,
        retentionUntil: customDate,
        classificationCap: 5,
      });

      expect(draft.memory_permissions.retention).toBe(RetentionDuration.TIMEBOUND);
      expect(draft.memory_permissions.retention_until).toBe(customDate);
      expect(draft.memory_permissions.classification_cap).toBe(5);
    });

    test('should not set retentionUntil default when retention is SESSION', () => {
      const draft = ContractFactory.createEpisodicContract('bob', {}, {
        retention: RetentionDuration.SESSION,
      });

      expect(draft.memory_permissions.retention).toBe(RetentionDuration.SESSION);
      expect(draft.memory_permissions.retention_until).toBeUndefined();
    });

    test('should not set retentionUntil default when retention is PERMANENT', () => {
      const draft = ContractFactory.createEpisodicContract('bob', {}, {
        retention: RetentionDuration.PERMANENT,
      });

      expect(draft.memory_permissions.retention).toBe(RetentionDuration.PERMANENT);
      expect(draft.memory_permissions.retention_until).toBeUndefined();
    });

    test('should allow overriding requiresOwner', () => {
      const draft = ContractFactory.createEpisodicContract('bob', {}, {
        requiresOwner: false,
      });

      expect(draft.recall_rules.requires_owner).toBe(false);
    });

    test('should allow overriding max_abstraction via scope', () => {
      const draft = ContractFactory.createEpisodicContract('bob', {
        max_abstraction: AbstractionLevel.PATTERN,
      });

      expect(draft.scope.max_abstraction).toBe(AbstractionLevel.PATTERN);
    });
  });

  describe('createProceduralContract()', () => {
    test('should set correct defaults', () => {
      const draft = ContractFactory.createProceduralContract('carol');

      expect(draft.contract_type).toBe(ContractType.PROCEDURAL);
      expect(draft.memory_permissions.may_store).toBe(true);
      expect(draft.memory_permissions.classification_cap).toBe(3);
      expect(draft.memory_permissions.retention).toBe(RetentionDuration.PERMANENT);
      expect(draft.generalization_rules.allowed).toBe(true);
      expect(draft.generalization_rules.conditions).toEqual([
        'Within specified domains only',
        'No cross-context application',
      ]);
      expect(draft.scope.max_abstraction).toBe(AbstractionLevel.HEURISTIC);
      expect(draft.scope.transferable).toBe(false);
      expect(draft.recall_rules.requires_owner).toBe(true);
      expect(draft.recall_rules.boundary_mode_min).toBe(BoundaryMode.NORMAL);
      expect(draft.revocable).toBe(true);
    });

    test('should accept all optional overrides', () => {
      const draft = ContractFactory.createProceduralContract(
        'carol',
        {
          domains: ['ml'],
          contexts: ['training'],
          tools: ['jupyter'],
          max_abstraction: AbstractionLevel.PATTERN,
        },
        {
          classificationCap: 5,
          retention: RetentionDuration.TIMEBOUND,
          generalizationConditions: ['Only in lab environments'],
        }
      );

      expect(draft.scope.domains).toEqual(['ml']);
      expect(draft.scope.contexts).toEqual(['training']);
      expect(draft.scope.tools).toEqual(['jupyter']);
      expect(draft.scope.max_abstraction).toBe(AbstractionLevel.PATTERN);
      expect(draft.memory_permissions.classification_cap).toBe(5);
      expect(draft.memory_permissions.retention).toBe(RetentionDuration.TIMEBOUND);
      expect(draft.generalization_rules.conditions).toEqual([
        'Only in lab environments',
      ]);
    });
  });

  describe('createStrategicContract()', () => {
    test('should set correct defaults', () => {
      const draft = ContractFactory.createStrategicContract('dave');

      expect(draft.contract_type).toBe(ContractType.STRATEGIC);
      expect(draft.memory_permissions.may_store).toBe(true);
      expect(draft.memory_permissions.classification_cap).toBe(4);
      expect(draft.memory_permissions.retention).toBe(RetentionDuration.PERMANENT);
      expect(draft.generalization_rules.allowed).toBe(true);
      expect(draft.generalization_rules.conditions).toEqual([
        'High-confidence patterns only',
        'Within specified domains',
        'Reviewed by owner',
      ]);
      expect(draft.scope.max_abstraction).toBe(AbstractionLevel.STRATEGY);
      expect(draft.scope.transferable).toBe(false);
      expect(draft.recall_rules.requires_owner).toBe(true);
      expect(draft.recall_rules.boundary_mode_min).toBe(BoundaryMode.TRUSTED);
      expect(draft.revocable).toBe(true);
    });

    test('should accept all optional overrides', () => {
      const draft = ContractFactory.createStrategicContract(
        'dave',
        {
          domains: ['enterprise'],
          contexts: ['strategy-session'],
          tools: ['analytics'],
          max_abstraction: AbstractionLevel.HEURISTIC,
        },
        {
          classificationCap: 2,
          generalizationConditions: ['Board approval required'],
        }
      );

      expect(draft.scope.domains).toEqual(['enterprise']);
      expect(draft.scope.contexts).toEqual(['strategy-session']);
      expect(draft.scope.tools).toEqual(['analytics']);
      expect(draft.scope.max_abstraction).toBe(AbstractionLevel.HEURISTIC);
      expect(draft.memory_permissions.classification_cap).toBe(2);
      expect(draft.generalization_rules.conditions).toEqual([
        'Board approval required',
      ]);
    });
  });

  describe('createProhibitedContract()', () => {
    test('should set correct defaults', () => {
      const draft = ContractFactory.createProhibitedContract('eve');

      expect(draft.contract_type).toBe(ContractType.PROHIBITED);
      expect(draft.memory_permissions.may_store).toBe(false);
      expect(draft.memory_permissions.classification_cap).toBe(0);
      expect(draft.memory_permissions.retention).toBe(RetentionDuration.SESSION);
      expect(draft.generalization_rules.allowed).toBe(false);
      expect(draft.generalization_rules.conditions).toEqual([]);
      expect(draft.scope.max_abstraction).toBe(AbstractionLevel.RAW);
      expect(draft.scope.transferable).toBe(false);
      expect(draft.recall_rules.requires_owner).toBe(true);
      expect(draft.recall_rules.boundary_mode_min).toBe(BoundaryMode.RESTRICTED);
      expect(draft.revocable).toBe(false);
    });

    test('should accept partial scope overrides', () => {
      const draft = ContractFactory.createProhibitedContract('eve', {
        domains: ['personal', 'health'],
        tools: ['diary'],
      });

      expect(draft.scope.domains).toEqual(['personal', 'health']);
      expect(draft.scope.tools).toEqual(['diary']);
      expect(draft.scope.contexts).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Integration: Factory -> Lifecycle round-trip
  // -------------------------------------------------------------------------

  describe('Factory + Lifecycle integration', () => {
    let auditLogger: AuditLogger;
    let lifecycleManager: ContractLifecycleManager;

    beforeEach(() => {
      auditLogger = new AuditLogger();
      lifecycleManager = new ContractLifecycleManager(auditLogger);
    });

    test('should create a valid lifecycle from a factory-produced observation draft', () => {
      const draft = ContractFactory.createObservationContract('alice', {
        domains: ['finance'],
      });
      const contract = lifecycleManager.createDraft(draft);

      expect(contract.state).toBe(ContractState.DRAFT);
      expect(contract.contract_type).toBe(ContractType.OBSERVATION);
    });

    test('should create a valid lifecycle from a factory-produced episodic draft', () => {
      const draft = ContractFactory.createEpisodicContract('bob', {
        domains: ['personal'],
        contexts: ['journal'],
      });
      const contract = lifecycleManager.createDraft(draft);

      expect(contract.state).toBe(ContractState.DRAFT);
      expect(contract.contract_type).toBe(ContractType.EPISODIC);
    });

    test('should create a valid lifecycle from a factory-produced procedural draft', () => {
      const draft = ContractFactory.createProceduralContract('carol', {
        domains: ['coding'],
      });
      const contract = lifecycleManager.createDraft(draft);

      expect(contract.state).toBe(ContractState.DRAFT);
      expect(contract.contract_type).toBe(ContractType.PROCEDURAL);
    });

    test('should create a valid lifecycle from a factory-produced strategic draft', () => {
      const draft = ContractFactory.createStrategicContract('dave', {
        domains: ['business'],
      });
      const contract = lifecycleManager.createDraft(draft);

      expect(contract.state).toBe(ContractState.DRAFT);
      expect(contract.contract_type).toBe(ContractType.STRATEGIC);
    });

    test('should create a valid lifecycle from a factory-produced prohibited draft', () => {
      const draft = ContractFactory.createProhibitedContract('eve', {
        domains: ['health'],
      });
      const contract = lifecycleManager.createDraft(draft);

      expect(contract.state).toBe(ContractState.DRAFT);
      expect(contract.contract_type).toBe(ContractType.PROHIBITED);
      expect(contract.revocable).toBe(false);
    });

    test('should run a full lifecycle: DRAFT -> REVIEW -> ACTIVE -> EXPIRED', () => {
      const draft = ContractFactory.createEpisodicContract('alice', {
        domains: ['finance'],
      });
      const contract = lifecycleManager.createDraft(draft);
      expect(contract.state).toBe(ContractState.DRAFT);

      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      expect(reviewed.state).toBe(ContractState.REVIEW);

      const activated = lifecycleManager.activate(reviewed, 'carol');
      expect(activated.state).toBe(ContractState.ACTIVE);
      expect(lifecycleManager.isEnforceable(activated)).toBe(true);

      const expired = lifecycleManager.expire(activated, 'system');
      expect(expired.state).toBe(ContractState.EXPIRED);
      expect(lifecycleManager.isEnforceable(expired)).toBe(false);
    });

    test('should run a full lifecycle: DRAFT -> REVIEW -> ACTIVE -> REVOKED', () => {
      const draft = ContractFactory.createEpisodicContract('alice', {
        domains: ['finance'],
      });
      const contract = lifecycleManager.createDraft(draft);
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      const activated = lifecycleManager.activate(reviewed, 'carol');
      const revoked = lifecycleManager.revoke(activated, 'alice', 'Changed mind');

      expect(revoked.state).toBe(ContractState.REVOKED);
      expect(lifecycleManager.isEnforceable(revoked)).toBe(false);
    });

    test('should run a full lifecycle: DRAFT -> REVIEW -> ACTIVE -> AMENDED -> new DRAFT', () => {
      const draft = ContractFactory.createEpisodicContract('alice', {
        domains: ['finance'],
      });
      const contract = lifecycleManager.createDraft(draft);
      const reviewed = lifecycleManager.submitForReview(contract, 'bob');
      const activated = lifecycleManager.activate(reviewed, 'carol');

      const { original, newDraft } = lifecycleManager.amend(
        activated,
        'alice',
        {},
        'Updating terms'
      );

      expect(original.state).toBe(ContractState.AMENDED);
      expect(newDraft.state).toBe(ContractState.DRAFT);
      expect(newDraft.metadata!.amended_from).toBe(activated.contract_id);

      // The new draft can continue through its own lifecycle
      const newReviewed = lifecycleManager.submitForReview(newDraft, 'bob');
      expect(newReviewed.state).toBe(ContractState.REVIEW);
    });
  });
});
