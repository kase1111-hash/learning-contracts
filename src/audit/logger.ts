/**
 * Audit Logger
 *
 * All contract transitions and enforcement decisions are logged
 * and irreversible in audit history.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AuditEvent,
  AuditEventType,
  AuditQueryOptions,
  LearningContract,
  ContractState,
  EnforcementContext,
  EnforcementResult,
} from '../types';
import type { AuditPersistenceAdapter } from './persistence';

/**
 * Configuration for the AuditLogger.
 */
export interface AuditLoggerConfig {
  /** Maximum number of events to retain in memory. 0 = unlimited. Default: 10000. */
  maxEvents?: number;
  /** Callback invoked when events are evicted due to maxEvents limit. */
  onEvict?: (evictedEvents: AuditEvent[]) => void;
  /** Optional persistence adapter for durable audit storage. */
  persistence?: AuditPersistenceAdapter;
}

export class AuditLogger {
  // TODO: Audit events are stored in-memory only. For production use with
  // long-running processes, configure a persistence adapter to prevent data loss
  // on restart. See AuditLoggerConfig.persistence.
  private events: AuditEvent[] = [];
  private readonly maxEvents: number;
  private readonly onEvict?: (evictedEvents: AuditEvent[]) => void;
  private readonly persistence?: AuditPersistenceAdapter;
  private currentCorrelationId?: string;

  constructor(config: AuditLoggerConfig = {}) {
    this.maxEvents = config.maxEvents ?? 10000;
    this.persistence = config.persistence;
    this.onEvict = config.onEvict;
  }

  /**
   * Sets a correlation ID that will be attached to all subsequent events.
   * Pass undefined to clear the correlation context.
   */
  setCorrelationId(correlationId: string | undefined): void {
    this.currentCorrelationId = correlationId;
  }

  /**
   * Logs contract creation
   */
  logContractCreated(contract: LearningContract, actor: string): void {
    this.log({
      event_type: AuditEventType.CONTRACT_CREATED,
      contract_id: contract.contract_id,
      actor,
      new_state: ContractState.DRAFT,
      details: {
        contract_type: contract.contract_type,
        scope: contract.scope,
      },
    });
  }

  /**
   * Logs contract state transition
   */
  logStateTransition(
    contractId: string,
    actor: string,
    previousState: ContractState,
    newState: ContractState,
    details: Record<string, unknown> = {}
  ): void {
    const eventTypeMap: Record<ContractState, AuditEventType> = {
      [ContractState.DRAFT]: AuditEventType.CONTRACT_CREATED,
      [ContractState.REVIEW]: AuditEventType.CONTRACT_REVIEWED,
      [ContractState.ACTIVE]: AuditEventType.CONTRACT_ACTIVATED,
      [ContractState.AMENDED]: AuditEventType.CONTRACT_AMENDED,
      [ContractState.EXPIRED]: AuditEventType.CONTRACT_EXPIRED,
      [ContractState.REVOKED]: AuditEventType.CONTRACT_REVOKED,
    };

    this.log({
      event_type: eventTypeMap[newState] || AuditEventType.CONTRACT_REVIEWED,
      contract_id: contractId,
      actor,
      previous_state: previousState,
      new_state: newState,
      details,
    });
  }

  /**
   * Logs enforcement check (any of the four hooks)
   */
  logEnforcementCheck(
    hookType: 'memory_creation' | 'abstraction' | 'recall' | 'export',
    context: EnforcementContext,
    result: EnforcementResult
  ): void {
    this.log({
      event_type: AuditEventType.ENFORCEMENT_CHECK,
      contract_id: context.contract.contract_id,
      actor: 'system',
      allowed: result.allowed,
      reason: result.reason,
      details: {
        hook_type: hookType,
        boundary_mode: context.boundary_mode,
        domain: context.domain,
        context: context.context,
        tool: context.tool,
        abstraction_level: context.abstraction_level,
        is_transfer: context.is_transfer,
      },
    });

    // Log violation if denied
    if (!result.allowed) {
      this.log({
        event_type: AuditEventType.ENFORCEMENT_VIOLATION,
        contract_id: context.contract.contract_id,
        actor: 'system',
        allowed: false,
        reason: result.reason,
        details: {
          hook_type: hookType,
          violation_details: context,
        },
      });
    }
  }

  /**
   * Logs memory creation
   */
  logMemoryCreated(
    contractId: string,
    memoryId: string,
    classification: number,
    actor: string
  ): void {
    this.log({
      event_type: AuditEventType.MEMORY_CREATED,
      contract_id: contractId,
      actor,
      details: {
        memory_id: memoryId,
        classification,
      },
    });
  }

  /**
   * Logs memory recall
   */
  logMemoryRecalled(
    contractId: string,
    memoryId: string,
    actor: string
  ): void {
    this.log({
      event_type: AuditEventType.MEMORY_RECALLED,
      contract_id: contractId,
      actor,
      details: {
        memory_id: memoryId,
      },
    });
  }

  /**
   * Logs memory frozen (contract expired)
   */
  logMemoryFrozen(contractId: string, memoryIds: string[]): void {
    this.log({
      event_type: AuditEventType.MEMORY_TOMBSTONED,
      contract_id: contractId,
      actor: 'system',
      details: {
        action: 'frozen',
        memory_ids: memoryIds,
        count: memoryIds.length,
      },
    });
  }

  /**
   * Logs memory tombstoned (contract revoked)
   */
  logMemoryTombstoned(
    contractId: string,
    memoryIds: string[],
    derivedIds: string[]
  ): void {
    this.log({
      event_type: AuditEventType.MEMORY_TOMBSTONED,
      contract_id: contractId,
      actor: 'system',
      details: {
        action: 'tombstoned',
        memory_ids: memoryIds,
        derived_memory_ids: derivedIds,
        total_affected: memoryIds.length + derivedIds.length,
      },
    });
  }

  /**
   * Logs memory purged (deep purge)
   */
  logMemoryPurged(
    contractId: string,
    memoryIds: string[],
    derivedIds: string[],
    ownerConfirmation: { owner: string; confirmation_token: string; timestamp: Date }
  ): void {
    this.log({
      event_type: AuditEventType.MEMORY_TOMBSTONED,
      contract_id: contractId,
      actor: ownerConfirmation.owner,
      details: {
        action: 'purged',
        memory_ids: memoryIds,
        derived_memory_ids: derivedIds,
        total_affected: memoryIds.length + derivedIds.length,
        owner_confirmation: {
          token: ownerConfirmation.confirmation_token,
          timestamp: ownerConfirmation.timestamp,
        },
      },
    });
  }

  /**
   * Logs heuristics invalidation
   */
  logHeuristicsInvalidated(heuristicIds: string[], sourceMemoryIds: string[]): void {
    if (heuristicIds.length === 0) {
      return;
    }

    this.log({
      event_type: AuditEventType.GENERALIZATION_ATTEMPTED,
      contract_id: 'system',
      actor: 'system',
      allowed: false,
      details: {
        action: 'invalidated',
        heuristic_ids: heuristicIds,
        source_memory_ids: sourceMemoryIds,
        count: heuristicIds.length,
      },
    });
  }

  /**
   * Logs generalization attempt
   */
  logGeneralizationAttempt(
    contractId: string,
    allowed: boolean,
    reason?: string
  ): void {
    this.log({
      event_type: AuditEventType.GENERALIZATION_ATTEMPTED,
      contract_id: contractId,
      actor: 'system',
      allowed,
      reason,
      details: {},
    });
  }

  /**
   * Logs export attempt
   */
  logExportAttempt(
    contractId: string,
    allowed: boolean,
    reason?: string
  ): void {
    this.log({
      event_type: AuditEventType.EXPORT_ATTEMPTED,
      contract_id: contractId,
      actor: 'system',
      allowed,
      reason,
      details: {},
    });
  }

  /**
   * Logs a custom event
   */
  logCustomEvent(
    eventName: string,
    details: Record<string, unknown>,
    actor: string = 'system',
    contractId?: string
  ): void {
    this.log({
      event_type: AuditEventType.CUSTOM,
      contract_id: contractId ?? 'system',
      actor,
      details: {
        custom_event_name: eventName,
        ...details,
      },
    });
  }

  /**
   * Logs session start
   */
  logSessionStarted(
    sessionId: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      event_type: AuditEventType.SESSION_STARTED,
      contract_id: 'session',
      actor: userId,
      details: {
        session_id: sessionId,
        user_id: userId,
        metadata,
      },
    });
  }

  /**
   * Logs session end
   */
  logSessionEnded(
    sessionId: string,
    userId: string,
    contractsCleaned: number,
    memoriesAffected: number,
    errors: number
  ): void {
    this.log({
      event_type: AuditEventType.SESSION_ENDED,
      contract_id: 'session',
      actor: userId,
      details: {
        session_id: sessionId,
        contracts_cleaned: contractsCleaned,
        memories_affected: memoriesAffected,
        errors,
      },
    });
  }

  /**
   * Core logging method
   */
  private log(eventData: Omit<AuditEvent, 'event_id' | 'timestamp'>): void {
    const event: AuditEvent = {
      event_id: uuidv4(),
      timestamp: new Date(),
      correlation_id: eventData.correlation_id ?? this.currentCorrelationId,
      ...eventData,
    };

    this.events.push(event);

    // Persist event if adapter is configured (fire-and-forget)
    if (this.persistence) {
      void this.persistence.persist([event]).catch((err) => {
        console.error('Audit persistence failed:', err);
      });
    }

    // Evict oldest events if over limit
    if (this.maxEvents > 0 && this.events.length > this.maxEvents) {
      const excess = this.events.length - this.maxEvents;
      const evicted = this.events.splice(0, excess);
      if (this.onEvict) {
        this.onEvict(evicted);
      }
    }
  }

  /**
   * Queries audit log
   */
  query(options: AuditQueryOptions = {}): AuditEvent[] {
    let results = [...this.events];

    if (options.contract_id) {
      results = results.filter((e) => e.contract_id === options.contract_id);
    }

    if (options.event_type) {
      results = results.filter((e) => e.event_type === options.event_type);
    }

    if (options.actor) {
      results = results.filter((e) => e.actor === options.actor);
    }

    if (options.correlation_id) {
      results = results.filter((e) => e.correlation_id === options.correlation_id);
    }

    if (options.start_time) {
      results = results.filter((e) => e.timestamp >= options.start_time!);
    }

    if (options.end_time) {
      results = results.filter((e) => e.timestamp <= options.end_time!);
    }

    if (options.allowed !== undefined) {
      results = results.filter((e) => e.allowed === options.allowed);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? results.length;

    return results.slice(offset, offset + limit);
  }

  /**
   * Gets all events for a contract
   */
  getContractHistory(contractId: string): AuditEvent[] {
    return this.query({ contract_id: contractId });
  }

  /**
   * Gets all violations
   */
  getViolations(options: Omit<AuditQueryOptions, 'event_type'> = {}): AuditEvent[] {
    return this.query({
      ...options,
      event_type: AuditEventType.ENFORCEMENT_VIOLATION,
    });
  }

  /**
   * Export audit log (immutable)
   */
  export(): AuditEvent[] {
    return [...this.events];
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.events.length;
  }
}
