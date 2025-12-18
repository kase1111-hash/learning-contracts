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

export class AuditLogger {
  private events: AuditEvent[] = [];

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
    details: Record<string, any> = {}
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
    ownerConfirmation: any
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
   * Core logging method
   */
  private log(eventData: Omit<AuditEvent, 'event_id' | 'timestamp'>): void {
    const event: AuditEvent = {
      event_id: uuidv4(),
      timestamp: new Date(),
      ...eventData,
    };

    this.events.push(event);
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
