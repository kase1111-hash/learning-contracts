/**
 * Enforcement Engine Tests
 *
 * Comprehensive tests for the four mandatory enforcement hooks:
 * 1. checkMemoryCreation - permission check before memory storage
 * 2. checkAbstraction - generalization gate during abstraction
 * 3. checkRecall - scope revalidation before recall
 * 4. checkExport - transfer prohibition during export
 *
 * Also covers emergency override blocking across all hooks,
 * and the private checkScope logic (domain/context/tool mismatch,
 * fail-closed when all scope arrays are empty).
 */

import { AuditLogger } from '../src/audit/logger';
import { ContractLifecycleManager } from '../src/contracts/lifecycle';
import { ContractFactory } from '../src/contracts/factory';
import { EnforcementEngine } from '../src/enforcement/engine';
import { EmergencyOverrideManager } from '../src/emergency-override/manager';
import {
  AbstractionLevel,
  BoundaryMode,
  EnforcementContext,
  LearningContract,
} from '../src/types';

describe('EnforcementEngine', () => {
  let auditLogger: AuditLogger;
  let lifecycleManager: ContractLifecycleManager;
  let engine: EnforcementEngine;

  beforeEach(() => {
    auditLogger = new AuditLogger();
    lifecycleManager = new ContractLifecycleManager(auditLogger);
    engine = new EnforcementEngine(lifecycleManager, auditLogger);
  });

  /**
   * Moves a contract draft through the full lifecycle to ACTIVE state.
   */
  function activateContract(
    draft: ReturnType<typeof ContractFactory.createEpisodicContract>
  ): LearningContract {
    let contract = lifecycleManager.createDraft(draft);
    contract = lifecycleManager.submitForReview(contract, draft.created_by);
    contract = lifecycleManager.activate(contract, draft.created_by);
    return contract;
  }

  /**
   * Builds an EnforcementContext with sensible defaults.
   */
  function makeContext(
    contract: LearningContract,
    overrides: Partial<EnforcementContext> = {}
  ): EnforcementContext {
    return {
      contract,
      boundary_mode: BoundaryMode.NORMAL,
      ...overrides,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Hook 1: checkMemoryCreation
  // ─────────────────────────────────────────────────────────────
  describe('checkMemoryCreation', () => {
    test('should deny when contract is not active (DRAFT state)', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      // Stay in DRAFT - do not activate
      const contract = lifecycleManager.createDraft(draft);

      const ctx = makeContext(contract);
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not active');
      expect(result.contract_id).toBe(contract.contract_id);
    });

    test('should deny when contract type is PROHIBITED', () => {
      const draft = ContractFactory.createProhibitedContract('owner', {
        domains: ['personal'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'personal' });
      const result = engine.checkMemoryCreation(ctx, 0);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        'Prohibited contract forbids memory creation'
      );
    });

    test('should deny when memory_permissions.may_store is false (observation contract)', () => {
      const draft = ContractFactory.createObservationContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkMemoryCreation(ctx, 0);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not permit memory storage');
    });

    test('should deny when classification exceeds cap', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      // Episodic default classification_cap is 3; use 5 to exceed it
      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkMemoryCreation(ctx, 5);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds cap');
      expect(result.reason).toContain('5');
      expect(result.reason).toContain('3');
    });

    test('should deny when domain is not in scope', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'cooking' });
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Domain 'cooking' not in contract scope");
    });

    test('should deny when context is not in scope', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
        contexts: ['project-x'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, {
        domain: 'coding',
        context: 'project-y',
      });
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        "Context 'project-y' not in contract scope"
      );
    });

    test('should deny when tool is not in scope', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
        tools: ['git'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding', tool: 'docker' });
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        "Tool 'docker' not in contract scope"
      );
    });

    test('should deny when all scope arrays are empty and domain is specified (fail-closed)', () => {
      // No scope options -> all arrays default to []
      const draft = ContractFactory.createEpisodicContract('owner');
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'anything' });
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('scope is empty');
    });

    test('should allow valid memory creation with all checks passing', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(true);
      expect(result.contract_id).toBe(contract.contract_id);
      expect(result.reason).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Hook 2: checkAbstraction
  // ─────────────────────────────────────────────────────────────
  describe('checkAbstraction', () => {
    test('should deny when contract is not enforceable (DRAFT state)', () => {
      const draft = ContractFactory.createProceduralContract('owner', {
        domains: ['coding'],
      });
      const contract = lifecycleManager.createDraft(draft);

      const ctx = makeContext(contract);
      const result = engine.checkAbstraction(ctx, AbstractionLevel.PATTERN);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not active');
    });

    test('should deny when contract type is PROHIBITED', () => {
      const draft = ContractFactory.createProhibitedContract('owner', {
        domains: ['personal'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'personal' });
      const result = engine.checkAbstraction(ctx, AbstractionLevel.RAW);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        'Prohibited contract forbids abstraction'
      );
    });

    test('should deny when generalization is not allowed (episodic contract)', () => {
      // Episodic contracts have generalization_rules.allowed = false
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkAbstraction(ctx, AbstractionLevel.PATTERN);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not permit generalization');
    });

    test('should deny when abstraction level exceeds maximum', () => {
      // Procedural contracts default max_abstraction to HEURISTIC
      const draft = ContractFactory.createProceduralContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding' });
      // STRATEGY exceeds HEURISTIC
      const result = engine.checkAbstraction(ctx, AbstractionLevel.STRATEGY);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds maximum');
      expect(result.reason).toContain(AbstractionLevel.STRATEGY);
      expect(result.reason).toContain(AbstractionLevel.HEURISTIC);
    });

    test('should deny when scope check fails due to domain mismatch', () => {
      const draft = ContractFactory.createProceduralContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'cooking' });
      // PATTERN is within HEURISTIC max, so scope check is reached
      const result = engine.checkAbstraction(ctx, AbstractionLevel.PATTERN);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        "Domain 'cooking' not in contract scope"
      );
    });

    test('should deny when scope check fails due to context mismatch', () => {
      const draft = ContractFactory.createProceduralContract('owner', {
        domains: ['coding'],
        contexts: ['project-alpha'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, {
        domain: 'coding',
        context: 'project-beta',
      });
      const result = engine.checkAbstraction(ctx, AbstractionLevel.PATTERN);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        "Context 'project-beta' not in contract scope"
      );
    });

    test('should allow valid abstraction within scope and level', () => {
      const draft = ContractFactory.createProceduralContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkAbstraction(ctx, AbstractionLevel.PATTERN);

      expect(result.allowed).toBe(true);
      expect(result.contract_id).toBe(contract.contract_id);
      expect(result.reason).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Hook 3: checkRecall
  // ─────────────────────────────────────────────────────────────
  describe('checkRecall', () => {
    test('should deny when contract state is EXPIRED (memory frozen)', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      let contract = activateContract(draft);
      contract = lifecycleManager.expire(contract, 'owner');

      const ctx = makeContext(contract, {
        domain: 'coding',
        requester: 'owner',
      });
      const result = engine.checkRecall(ctx);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('expired');
      expect(result.reason).toContain('frozen');
    });

    test('should deny when contract state is REVOKED (memory tombstoned)', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      let contract = activateContract(draft);
      contract = lifecycleManager.revoke(contract, 'owner', 'User requested');

      const ctx = makeContext(contract, {
        domain: 'coding',
        requester: 'owner',
      });
      const result = engine.checkRecall(ctx);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('revoked');
      expect(result.reason).toContain('tombstoned');
    });

    test('should deny when requires_owner is true but no requester is provided', () => {
      // Episodic contracts default to requires_owner: true
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      // Omit requester from context
      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkRecall(ctx);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('requires owner presence');
      expect(result.reason).toContain('no requester');
    });

    test('should deny when requires_owner is true but requester is not the owner', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, {
        domain: 'coding',
        requester: 'imposter',
      });
      const result = engine.checkRecall(ctx);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('requires owner presence');
      expect(result.reason).toContain('imposter');
      expect(result.reason).toContain('owner');
    });

    test('should deny when boundary mode is insufficient', () => {
      // Strategic contracts require boundary_mode_min: TRUSTED
      const draft = ContractFactory.createStrategicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, {
        domain: 'coding',
        requester: 'owner',
        boundary_mode: BoundaryMode.RESTRICTED,
      });
      const result = engine.checkRecall(ctx);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not meet minimum');
      expect(result.reason).toContain(BoundaryMode.RESTRICTED);
      expect(result.reason).toContain(BoundaryMode.TRUSTED);
    });

    test('should deny when scope check fails for recall', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, {
        domain: 'cooking',
        requester: 'owner',
      });
      const result = engine.checkRecall(ctx);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        "Domain 'cooking' not in contract scope"
      );
    });

    test('should allow valid recall with owner present and scope matching', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, {
        domain: 'coding',
        requester: 'owner',
      });
      const result = engine.checkRecall(ctx);

      expect(result.allowed).toBe(true);
      expect(result.contract_id).toBe(contract.contract_id);
      expect(result.reason).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Hook 4: checkExport
  // ─────────────────────────────────────────────────────────────
  describe('checkExport', () => {
    test('should deny when contract is not enforceable (DRAFT state)', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = lifecycleManager.createDraft(draft);

      const ctx = makeContext(contract);
      const result = engine.checkExport(ctx);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not active');
    });

    test('should deny when contract is not transferable', () => {
      // All factory-created contracts default to transferable: false
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkExport(ctx);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('prohibits memory transfer');
    });

    test('should allow export when contract is transferable', () => {
      const draft = ContractFactory.createProceduralContract('owner', {
        domains: ['coding'],
      });
      // Override transferable to true before creating the contract
      draft.scope.transferable = true;
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkExport(ctx);

      expect(result.allowed).toBe(true);
      expect(result.contract_id).toBe(contract.contract_id);
      expect(result.reason).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Emergency Override - blocks all four hooks
  // ─────────────────────────────────────────────────────────────
  // Scope edge cases (no domain/context/tool specified)
  // ─────────────────────────────────────────────────────────────
  describe('Scope edge cases', () => {
    test('should allow memory creation when no domain/context/tool specified', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      // No domain, context, or tool in the enforcement context
      const ctx: EnforcementContext = {
        contract,
        boundary_mode: BoundaryMode.NORMAL,
      };
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(true);
    });

    test('should deny when context is specified but not in scope', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
        contexts: ['project-a'],
      });
      const contract = activateContract(draft);

      const ctx: EnforcementContext = {
        contract,
        boundary_mode: BoundaryMode.NORMAL,
        context: 'project-b',
      };
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Context');
    });

    test('should deny when tool is specified but not in scope', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
        tools: ['vscode'],
      });
      const contract = activateContract(draft);

      const ctx: EnforcementContext = {
        contract,
        boundary_mode: BoundaryMode.NORMAL,
        tool: 'vim',
      };
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Tool');
    });

    test('should deny all operations when scope is completely empty (fail-closed)', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: [],
        contexts: [],
        tools: [],
      });
      const contract = activateContract(draft);

      const ctx: EnforcementContext = {
        contract,
        boundary_mode: BoundaryMode.NORMAL,
        domain: 'anything',
      };
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('empty');
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('Emergency Override', () => {
    let overrideManager: EmergencyOverrideManager;

    beforeEach(() => {
      overrideManager = new EmergencyOverrideManager(auditLogger);
      engine.setEmergencyOverrideManager(overrideManager);
      overrideManager.triggerOverride('admin', 'Security incident detected');
    });

    test('should block checkMemoryCreation when emergency override is active', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkMemoryCreation(ctx, 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Emergency override active');
      expect(result.reason).toContain('Security incident detected');
    });

    test('should block checkAbstraction when emergency override is active', () => {
      const draft = ContractFactory.createProceduralContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkAbstraction(ctx, AbstractionLevel.PATTERN);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Emergency override active');
    });

    test('should block checkRecall when emergency override is active', () => {
      const draft = ContractFactory.createEpisodicContract('owner', {
        domains: ['coding'],
      });
      const contract = activateContract(draft);

      const ctx = makeContext(contract, {
        domain: 'coding',
        requester: 'owner',
      });
      const result = engine.checkRecall(ctx);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Emergency override active');
    });

    test('should block checkExport when emergency override is active', () => {
      const draft = ContractFactory.createProceduralContract('owner', {
        domains: ['coding'],
      });
      draft.scope.transferable = true;
      const contract = activateContract(draft);

      const ctx = makeContext(contract, { domain: 'coding' });
      const result = engine.checkExport(ctx);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Emergency override active');
    });
  });
});
