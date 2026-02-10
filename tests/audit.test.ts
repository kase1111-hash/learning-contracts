/**
 * AuditLogger Tests
 *
 * Comprehensive tests for the audit logging system that tracks
 * all contract transitions, enforcement decisions, memory operations,
 * and session events.
 */

import { AuditLogger } from '../src/audit/logger';
import {
  AuditEventType,
  ContractState,
  ContractType,
  BoundaryMode,
  AbstractionLevel,
  LearningContract,
  EnforcementContext,
  EnforcementResult,
  RetentionDuration,
} from '../src/types';

/**
 * Helper: creates a minimal valid LearningContract for testing.
 */
function makeContract(overrides: Partial<LearningContract> = {}): LearningContract {
  return {
    contract_id: 'contract-001',
    created_at: new Date('2026-01-01T00:00:00Z'),
    created_by: 'alice',
    state: ContractState.ACTIVE,
    contract_type: ContractType.EPISODIC,
    scope: {
      domains: ['coding'],
      contexts: ['project-x'],
      tools: ['editor'],
      max_abstraction: AbstractionLevel.PATTERN,
      transferable: false,
    },
    memory_permissions: {
      may_store: true,
      classification_cap: 3,
      retention: RetentionDuration.SESSION,
    },
    generalization_rules: {
      allowed: false,
      conditions: [],
    },
    recall_rules: {
      requires_owner: false,
      boundary_mode_min: BoundaryMode.NORMAL,
    },
    expiration: null,
    revocable: true,
    ...overrides,
  };
}

/**
 * Helper: creates an EnforcementContext for testing.
 */
function makeEnforcementContext(
  contract: LearningContract,
  overrides: Partial<EnforcementContext> = {}
): EnforcementContext {
  return {
    contract,
    boundary_mode: BoundaryMode.NORMAL,
    domain: 'coding',
    context: 'project-x',
    tool: 'editor',
    abstraction_level: AbstractionLevel.PATTERN,
    is_transfer: false,
    ...overrides,
  };
}

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  // ---------------------------------------------------------------
  // logContractCreated
  // ---------------------------------------------------------------
  describe('logContractCreated', () => {
    test('logs event with correct type and data', () => {
      const contract = makeContract();
      logger.logContractCreated(contract, 'alice');

      const events = logger.export();
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.event_id).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.event_type).toBe(AuditEventType.CONTRACT_CREATED);
      expect(event.contract_id).toBe('contract-001');
      expect(event.actor).toBe('alice');
      expect(event.new_state).toBe(ContractState.DRAFT);
      expect(event.details.contract_type).toBe(ContractType.EPISODIC);
      expect(event.details.scope).toEqual(contract.scope);
    });
  });

  // ---------------------------------------------------------------
  // logStateTransition
  // ---------------------------------------------------------------
  describe('logStateTransition', () => {
    test('logs transition to REVIEW state', () => {
      logger.logStateTransition(
        'contract-001',
        'alice',
        ContractState.DRAFT,
        ContractState.REVIEW,
        { reason: 'submitted for review' }
      );

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.CONTRACT_REVIEWED);
      expect(events[0].previous_state).toBe(ContractState.DRAFT);
      expect(events[0].new_state).toBe(ContractState.REVIEW);
      expect(events[0].details.reason).toBe('submitted for review');
    });

    test('logs transition to ACTIVE state', () => {
      logger.logStateTransition(
        'contract-001',
        'alice',
        ContractState.REVIEW,
        ContractState.ACTIVE
      );

      const events = logger.export();
      expect(events[0].event_type).toBe(AuditEventType.CONTRACT_ACTIVATED);
      expect(events[0].new_state).toBe(ContractState.ACTIVE);
    });

    test('logs transition to AMENDED state', () => {
      logger.logStateTransition(
        'contract-001',
        'alice',
        ContractState.ACTIVE,
        ContractState.AMENDED
      );

      const events = logger.export();
      expect(events[0].event_type).toBe(AuditEventType.CONTRACT_AMENDED);
    });

    test('logs transition to EXPIRED state', () => {
      logger.logStateTransition(
        'contract-001',
        'system',
        ContractState.ACTIVE,
        ContractState.EXPIRED
      );

      const events = logger.export();
      expect(events[0].event_type).toBe(AuditEventType.CONTRACT_EXPIRED);
    });

    test('logs transition to REVOKED state', () => {
      logger.logStateTransition(
        'contract-001',
        'alice',
        ContractState.ACTIVE,
        ContractState.REVOKED
      );

      const events = logger.export();
      expect(events[0].event_type).toBe(AuditEventType.CONTRACT_REVOKED);
    });

    test('stores previous and new state on the event', () => {
      logger.logStateTransition(
        'contract-001',
        'alice',
        ContractState.DRAFT,
        ContractState.REVIEW
      );

      const event = logger.export()[0];
      expect(event.previous_state).toBe(ContractState.DRAFT);
      expect(event.new_state).toBe(ContractState.REVIEW);
    });
  });

  // ---------------------------------------------------------------
  // logEnforcementCheck
  // ---------------------------------------------------------------
  describe('logEnforcementCheck', () => {
    test('logs check event when allowed', () => {
      const contract = makeContract();
      const context = makeEnforcementContext(contract);
      const result: EnforcementResult = {
        allowed: true,
        contract_id: contract.contract_id,
      };

      logger.logEnforcementCheck('memory_creation', context, result);

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.ENFORCEMENT_CHECK);
      expect(events[0].allowed).toBe(true);
      expect(events[0].actor).toBe('system');
      expect(events[0].details.hook_type).toBe('memory_creation');
      expect(events[0].details.boundary_mode).toBe(BoundaryMode.NORMAL);
    });

    test('logs both check and violation events when denied', () => {
      const contract = makeContract();
      const context = makeEnforcementContext(contract);
      const result: EnforcementResult = {
        allowed: false,
        reason: 'Domain not permitted',
        contract_id: contract.contract_id,
      };

      logger.logEnforcementCheck('abstraction', context, result);

      const events = logger.export();
      expect(events).toHaveLength(2);

      // First event: enforcement check
      expect(events[0].event_type).toBe(AuditEventType.ENFORCEMENT_CHECK);
      expect(events[0].allowed).toBe(false);
      expect(events[0].reason).toBe('Domain not permitted');

      // Second event: enforcement violation
      expect(events[1].event_type).toBe(AuditEventType.ENFORCEMENT_VIOLATION);
      expect(events[1].allowed).toBe(false);
      expect(events[1].details.hook_type).toBe('abstraction');
      expect(events[1].details.violation_details).toEqual(context);
    });

    test('logs enforcement check for recall hook', () => {
      const contract = makeContract();
      const context = makeEnforcementContext(contract);
      const result: EnforcementResult = {
        allowed: true,
        contract_id: contract.contract_id,
      };

      logger.logEnforcementCheck('recall', context, result);

      const events = logger.export();
      expect(events[0].details.hook_type).toBe('recall');
    });

    test('logs enforcement check for export hook', () => {
      const contract = makeContract();
      const context = makeEnforcementContext(contract, { is_transfer: true });
      const result: EnforcementResult = {
        allowed: false,
        reason: 'Export not permitted',
        contract_id: contract.contract_id,
      };

      logger.logEnforcementCheck('export', context, result);

      const events = logger.export();
      expect(events[0].details.hook_type).toBe('export');
      expect(events[0].details.is_transfer).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // logMemoryCreated
  // ---------------------------------------------------------------
  describe('logMemoryCreated', () => {
    test('logs with memory_id and classification', () => {
      logger.logMemoryCreated('contract-001', 'mem-001', 3, 'alice');

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.MEMORY_CREATED);
      expect(events[0].contract_id).toBe('contract-001');
      expect(events[0].actor).toBe('alice');
      expect(events[0].details.memory_id).toBe('mem-001');
      expect(events[0].details.classification).toBe(3);
    });
  });

  // ---------------------------------------------------------------
  // logMemoryRecalled
  // ---------------------------------------------------------------
  describe('logMemoryRecalled', () => {
    test('logs with memory_id', () => {
      logger.logMemoryRecalled('contract-001', 'mem-001', 'bob');

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.MEMORY_RECALLED);
      expect(events[0].contract_id).toBe('contract-001');
      expect(events[0].actor).toBe('bob');
      expect(events[0].details.memory_id).toBe('mem-001');
    });
  });

  // ---------------------------------------------------------------
  // logMemoryFrozen
  // ---------------------------------------------------------------
  describe('logMemoryFrozen', () => {
    test('logs with memory_ids and count', () => {
      const memoryIds = ['mem-001', 'mem-002', 'mem-003'];
      logger.logMemoryFrozen('contract-001', memoryIds);

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.MEMORY_TOMBSTONED);
      expect(events[0].contract_id).toBe('contract-001');
      expect(events[0].actor).toBe('system');
      expect(events[0].details.action).toBe('frozen');
      expect(events[0].details.memory_ids).toEqual(memoryIds);
      expect(events[0].details.count).toBe(3);
    });

    test('logs with empty memory_ids', () => {
      logger.logMemoryFrozen('contract-001', []);

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].details.memory_ids).toEqual([]);
      expect(events[0].details.count).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // logMemoryTombstoned
  // ---------------------------------------------------------------
  describe('logMemoryTombstoned', () => {
    test('logs with affected and derived IDs', () => {
      const memoryIds = ['mem-001', 'mem-002'];
      const derivedIds = ['derived-001', 'derived-002', 'derived-003'];

      logger.logMemoryTombstoned('contract-001', memoryIds, derivedIds);

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.MEMORY_TOMBSTONED);
      expect(events[0].actor).toBe('system');
      expect(events[0].details.action).toBe('tombstoned');
      expect(events[0].details.memory_ids).toEqual(memoryIds);
      expect(events[0].details.derived_memory_ids).toEqual(derivedIds);
      expect(events[0].details.total_affected).toBe(5);
    });
  });

  // ---------------------------------------------------------------
  // logMemoryPurged
  // ---------------------------------------------------------------
  describe('logMemoryPurged', () => {
    test('logs with owner confirmation details', () => {
      const memoryIds = ['mem-001'];
      const derivedIds = ['derived-001'];
      const confirmation = {
        owner: 'alice',
        confirmation_token: 'token-abc',
        timestamp: new Date('2026-02-01T12:00:00Z'),
      };

      logger.logMemoryPurged('contract-001', memoryIds, derivedIds, confirmation);

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.MEMORY_TOMBSTONED);
      expect(events[0].actor).toBe('alice');
      expect(events[0].details.action).toBe('purged');
      expect(events[0].details.memory_ids).toEqual(memoryIds);
      expect(events[0].details.derived_memory_ids).toEqual(derivedIds);
      expect(events[0].details.total_affected).toBe(2);
      const ownerConfirmation = events[0].details.owner_confirmation as { token: string; timestamp: Date };
      expect(ownerConfirmation.token).toBe('token-abc');
      expect(ownerConfirmation.timestamp).toEqual(
        new Date('2026-02-01T12:00:00Z')
      );
    });
  });

  // ---------------------------------------------------------------
  // logHeuristicsInvalidated
  // ---------------------------------------------------------------
  describe('logHeuristicsInvalidated', () => {
    test('logs invalidated heuristics with source memory IDs', () => {
      const heuristicIds = ['heur-001', 'heur-002'];
      const sourceMemoryIds = ['mem-001', 'mem-003'];

      logger.logHeuristicsInvalidated(heuristicIds, sourceMemoryIds);

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.GENERALIZATION_ATTEMPTED);
      expect(events[0].contract_id).toBe('system');
      expect(events[0].actor).toBe('system');
      expect(events[0].allowed).toBe(false);
      expect(events[0].details.action).toBe('invalidated');
      expect(events[0].details.heuristic_ids).toEqual(heuristicIds);
      expect(events[0].details.source_memory_ids).toEqual(sourceMemoryIds);
      expect(events[0].details.count).toBe(2);
    });

    test('skips logging when heuristicIds array is empty', () => {
      logger.logHeuristicsInvalidated([], ['mem-001']);

      const events = logger.export();
      expect(events).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------
  // logGeneralizationAttempt
  // ---------------------------------------------------------------
  describe('logGeneralizationAttempt', () => {
    test('logs allowed generalization attempt', () => {
      logger.logGeneralizationAttempt('contract-001', true);

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.GENERALIZATION_ATTEMPTED);
      expect(events[0].contract_id).toBe('contract-001');
      expect(events[0].allowed).toBe(true);
      expect(events[0].reason).toBeUndefined();
    });

    test('logs denied generalization attempt with reason', () => {
      logger.logGeneralizationAttempt('contract-001', false, 'Scope exceeded');

      const events = logger.export();
      expect(events[0].allowed).toBe(false);
      expect(events[0].reason).toBe('Scope exceeded');
    });
  });

  // ---------------------------------------------------------------
  // logExportAttempt
  // ---------------------------------------------------------------
  describe('logExportAttempt', () => {
    test('logs allowed export attempt', () => {
      logger.logExportAttempt('contract-001', true);

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.EXPORT_ATTEMPTED);
      expect(events[0].contract_id).toBe('contract-001');
      expect(events[0].actor).toBe('system');
      expect(events[0].allowed).toBe(true);
      expect(events[0].reason).toBeUndefined();
    });

    test('logs denied export attempt with reason', () => {
      logger.logExportAttempt('contract-001', false, 'Transfer not allowed');

      const events = logger.export();
      expect(events[0].allowed).toBe(false);
      expect(events[0].reason).toBe('Transfer not allowed');
    });
  });

  // ---------------------------------------------------------------
  // logCustomEvent
  // ---------------------------------------------------------------
  describe('logCustomEvent', () => {
    test('logs custom event with name and details', () => {
      logger.logCustomEvent('backup_started', { path: '/tmp/backup' });

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.CUSTOM);
      expect(events[0].contract_id).toBe('system');
      expect(events[0].actor).toBe('system');
      expect(events[0].details.custom_event_name).toBe('backup_started');
      expect(events[0].details.path).toBe('/tmp/backup');
    });

    test('logs custom event with explicit actor', () => {
      logger.logCustomEvent('manual_check', { result: 'ok' }, 'admin');

      const events = logger.export();
      expect(events[0].actor).toBe('admin');
    });

    test('logs custom event with optional contractId', () => {
      logger.logCustomEvent(
        'contract_note',
        { note: 'reviewed' },
        'alice',
        'contract-001'
      );

      const events = logger.export();
      expect(events[0].contract_id).toBe('contract-001');
      expect(events[0].actor).toBe('alice');
      expect(events[0].details.custom_event_name).toBe('contract_note');
      expect(events[0].details.note).toBe('reviewed');
    });

    test('defaults contract_id to "system" when contractId not provided', () => {
      logger.logCustomEvent('system_event', {});

      const events = logger.export();
      expect(events[0].contract_id).toBe('system');
    });
  });

  // ---------------------------------------------------------------
  // logSessionStarted
  // ---------------------------------------------------------------
  describe('logSessionStarted', () => {
    test('logs session start with userId and metadata', () => {
      const metadata = { project: 'alpha', environment: 'staging' };
      logger.logSessionStarted('session-001', 'alice', metadata);

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.SESSION_STARTED);
      expect(events[0].contract_id).toBe('session');
      expect(events[0].actor).toBe('alice');
      expect(events[0].details.session_id).toBe('session-001');
      expect(events[0].details.user_id).toBe('alice');
      expect(events[0].details.metadata).toEqual(metadata);
    });

    test('logs session start without metadata', () => {
      logger.logSessionStarted('session-002', 'bob');

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].details.session_id).toBe('session-002');
      expect(events[0].details.user_id).toBe('bob');
      expect(events[0].details.metadata).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------
  // logSessionEnded
  // ---------------------------------------------------------------
  describe('logSessionEnded', () => {
    test('logs session end with cleanup stats', () => {
      logger.logSessionEnded('session-001', 'alice', 3, 15, 0);

      const events = logger.export();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe(AuditEventType.SESSION_ENDED);
      expect(events[0].contract_id).toBe('session');
      expect(events[0].actor).toBe('alice');
      expect(events[0].details.session_id).toBe('session-001');
      expect(events[0].details.contracts_cleaned).toBe(3);
      expect(events[0].details.memories_affected).toBe(15);
      expect(events[0].details.errors).toBe(0);
    });

    test('logs session end with errors', () => {
      logger.logSessionEnded('session-002', 'bob', 1, 5, 2);

      const events = logger.export();
      expect(events[0].details.errors).toBe(2);
    });
  });

  // ---------------------------------------------------------------
  // query
  // ---------------------------------------------------------------
  describe('query', () => {
    /**
     * Populate logger with a diverse set of events for query tests.
     */
    function populateEvents(): void {
      const contract = makeContract();
      // Event 1: contract created (actor: alice)
      logger.logContractCreated(contract, 'alice');
      // Event 2: enforcement check allowed (actor: system)
      logger.logEnforcementCheck(
        'memory_creation',
        makeEnforcementContext(contract),
        { allowed: true, contract_id: 'contract-001' }
      );
      // Event 3: enforcement check denied + Event 4: violation (actor: system)
      logger.logEnforcementCheck(
        'export',
        makeEnforcementContext(contract),
        { allowed: false, reason: 'Not allowed', contract_id: 'contract-001' }
      );
      // Event 5: memory created on different contract (actor: bob)
      logger.logMemoryCreated('contract-002', 'mem-050', 2, 'bob');
      // Event 6: generalization allowed (actor: system)
      logger.logGeneralizationAttempt('contract-001', true);
    }

    test('returns all events when no filters specified', () => {
      populateEvents();
      const results = logger.query();
      expect(results).toHaveLength(6);
    });

    test('filters by contract_id', () => {
      populateEvents();
      const results = logger.query({ contract_id: 'contract-002' });
      expect(results).toHaveLength(1);
      expect(results[0].contract_id).toBe('contract-002');
    });

    test('filters by event_type', () => {
      populateEvents();
      const results = logger.query({
        event_type: AuditEventType.ENFORCEMENT_CHECK,
      });
      expect(results).toHaveLength(2);
      results.forEach((e) => {
        expect(e.event_type).toBe(AuditEventType.ENFORCEMENT_CHECK);
      });
    });

    test('filters by actor', () => {
      populateEvents();
      const results = logger.query({ actor: 'bob' });
      expect(results).toHaveLength(1);
      expect(results[0].actor).toBe('bob');
    });

    test('filters by start_time', () => {
      // Log two events at different conceptual times.
      // Since events are created in sequence, we insert a gap using the
      // query's start_time filter set to "just before" the second event.
      const contract = makeContract();
      logger.logContractCreated(contract, 'alice');

      // Set start_time to the future to get zero results.
      const futureTime = new Date(Date.now() + 100000);

      const results = logger.query({ start_time: futureTime });
      expect(results).toHaveLength(0);

      // All events should appear with start_time in the past
      const pastTime = new Date(Date.now() - 100000);
      const allResults = logger.query({ start_time: pastTime });
      expect(allResults).toHaveLength(1);
    });

    test('filters by end_time', () => {
      const contract = makeContract();
      logger.logContractCreated(contract, 'alice');

      // end_time in the past should exclude current events
      const pastTime = new Date(Date.now() - 100000);
      const results = logger.query({ end_time: pastTime });
      expect(results).toHaveLength(0);

      // end_time in the future should include all events
      const futureTime = new Date(Date.now() + 100000);
      const allResults = logger.query({ end_time: futureTime });
      expect(allResults).toHaveLength(1);
    });

    test('filters by allowed', () => {
      populateEvents();

      // allowed: true - enforcement check allowed + generalization allowed
      const allowedEvents = logger.query({ allowed: true });
      expect(allowedEvents.length).toBeGreaterThanOrEqual(1);
      allowedEvents.forEach((e) => {
        expect(e.allowed).toBe(true);
      });

      // allowed: false - enforcement check denied + violation
      const deniedEvents = logger.query({ allowed: false });
      expect(deniedEvents.length).toBeGreaterThanOrEqual(1);
      deniedEvents.forEach((e) => {
        expect(e.allowed).toBe(false);
      });
    });

    test('supports pagination with offset and limit', () => {
      populateEvents();
      const allEvents = logger.query();
      expect(allEvents.length).toBe(6);

      // Get first 2 events
      const page1 = logger.query({ limit: 2 });
      expect(page1).toHaveLength(2);

      // Get next 2 events
      const page2 = logger.query({ offset: 2, limit: 2 });
      expect(page2).toHaveLength(2);

      // Pages should not overlap
      const page1Ids = page1.map((e) => e.event_id);
      const page2Ids = page2.map((e) => e.event_id);
      page2Ids.forEach((id) => {
        expect(page1Ids).not.toContain(id);
      });

      // Offset beyond all events
      const emptyPage = logger.query({ offset: 100 });
      expect(emptyPage).toHaveLength(0);
    });

    test('results are sorted descending by timestamp', () => {
      populateEvents();
      const results = logger.query();

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          results[i + 1].timestamp.getTime()
        );
      }
    });

    test('combines multiple filters', () => {
      populateEvents();
      const results = logger.query({
        contract_id: 'contract-001',
        actor: 'system',
        event_type: AuditEventType.ENFORCEMENT_VIOLATION,
      });

      expect(results).toHaveLength(1);
      expect(results[0].event_type).toBe(AuditEventType.ENFORCEMENT_VIOLATION);
      expect(results[0].contract_id).toBe('contract-001');
      expect(results[0].actor).toBe('system');
    });
  });

  // ---------------------------------------------------------------
  // getContractHistory
  // ---------------------------------------------------------------
  describe('getContractHistory', () => {
    test('returns events for a specific contract', () => {
      const contract = makeContract();
      logger.logContractCreated(contract, 'alice');
      logger.logMemoryCreated('contract-001', 'mem-001', 2, 'alice');
      logger.logMemoryCreated('contract-002', 'mem-002', 1, 'bob');

      const history = logger.getContractHistory('contract-001');
      expect(history).toHaveLength(2);
      history.forEach((e) => {
        expect(e.contract_id).toBe('contract-001');
      });
    });

    test('returns empty array for unknown contract', () => {
      const history = logger.getContractHistory('nonexistent');
      expect(history).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // getViolations
  // ---------------------------------------------------------------
  describe('getViolations', () => {
    test('returns only violation events', () => {
      const contract = makeContract();

      // Allowed check (no violation)
      logger.logEnforcementCheck(
        'memory_creation',
        makeEnforcementContext(contract),
        { allowed: true, contract_id: contract.contract_id }
      );

      // Denied check (creates violation)
      logger.logEnforcementCheck(
        'export',
        makeEnforcementContext(contract),
        { allowed: false, reason: 'Denied', contract_id: contract.contract_id }
      );

      // Another denied check
      logger.logEnforcementCheck(
        'abstraction',
        makeEnforcementContext(contract),
        { allowed: false, reason: 'Scope too broad', contract_id: contract.contract_id }
      );

      const violations = logger.getViolations();
      expect(violations).toHaveLength(2);
      violations.forEach((e) => {
        expect(e.event_type).toBe(AuditEventType.ENFORCEMENT_VIOLATION);
      });
    });

    test('returns empty when no violations exist', () => {
      const contract = makeContract();
      logger.logEnforcementCheck(
        'memory_creation',
        makeEnforcementContext(contract),
        { allowed: true, contract_id: contract.contract_id }
      );

      const violations = logger.getViolations();
      expect(violations).toEqual([]);
    });

    test('supports additional query options', () => {
      const contract1 = makeContract({ contract_id: 'c-001' });
      const contract2 = makeContract({ contract_id: 'c-002' });

      logger.logEnforcementCheck(
        'export',
        makeEnforcementContext(contract1),
        { allowed: false, reason: 'Denied', contract_id: 'c-001' }
      );

      logger.logEnforcementCheck(
        'recall',
        makeEnforcementContext(contract2),
        { allowed: false, reason: 'Denied', contract_id: 'c-002' }
      );

      const violations = logger.getViolations({ contract_id: 'c-001' });
      expect(violations).toHaveLength(1);
      expect(violations[0].contract_id).toBe('c-001');
    });
  });

  // ---------------------------------------------------------------
  // export
  // ---------------------------------------------------------------
  describe('export', () => {
    test('returns a copy of all events (immutable)', () => {
      const contract = makeContract();
      logger.logContractCreated(contract, 'alice');
      logger.logMemoryCreated('contract-001', 'mem-001', 1, 'alice');

      const exported = logger.export();
      expect(exported).toHaveLength(2);

      // Mutating the exported array should NOT affect internal state
      exported.push({} as any);
      expect(logger.export()).toHaveLength(2);
    });

    test('returns empty array when no events logged', () => {
      const exported = logger.export();
      expect(exported).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // getEventCount
  // ---------------------------------------------------------------
  describe('getEventCount', () => {
    test('returns 0 when no events logged', () => {
      expect(logger.getEventCount()).toBe(0);
    });

    test('returns correct count after logging events', () => {
      const contract = makeContract();
      logger.logContractCreated(contract, 'alice');
      expect(logger.getEventCount()).toBe(1);

      logger.logMemoryCreated('contract-001', 'mem-001', 1, 'alice');
      expect(logger.getEventCount()).toBe(2);

      // Denied enforcement creates 2 events (check + violation)
      logger.logEnforcementCheck(
        'export',
        makeEnforcementContext(contract),
        { allowed: false, reason: 'No', contract_id: contract.contract_id }
      );
      expect(logger.getEventCount()).toBe(4);
    });
  });
});
