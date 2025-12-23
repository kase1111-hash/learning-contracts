/**
 * Audit and Logging Types
 *
 * All contract transitions are logged and irreversible in audit history.
 */

import { ContractState } from './contract';

/**
 * Audit event types
 */
export enum AuditEventType {
  CONTRACT_CREATED = 'contract_created',
  CONTRACT_REVIEWED = 'contract_reviewed',
  CONTRACT_ACTIVATED = 'contract_activated',
  CONTRACT_AMENDED = 'contract_amended',
  CONTRACT_EXPIRED = 'contract_expired',
  CONTRACT_REVOKED = 'contract_revoked',
  ENFORCEMENT_CHECK = 'enforcement_check',
  ENFORCEMENT_VIOLATION = 'enforcement_violation',
  MEMORY_CREATED = 'memory_created',
  MEMORY_RECALLED = 'memory_recalled',
  MEMORY_TOMBSTONED = 'memory_tombstoned',
  GENERALIZATION_ATTEMPTED = 'generalization_attempted',
  EXPORT_ATTEMPTED = 'export_attempted',
  SESSION_STARTED = 'session_started',
  SESSION_ENDED = 'session_ended',
  CUSTOM = 'custom',
}

/**
 * Audit event entry
 */
export interface AuditEvent {
  /** Unique event identifier */
  event_id: string;
  /** Event timestamp */
  timestamp: Date;
  /** Type of audit event */
  event_type: AuditEventType;
  /** Contract ID this event relates to */
  contract_id: string;
  /** Actor who triggered the event */
  actor: string;
  /** Previous state (for transitions) */
  previous_state?: ContractState;
  /** New state (for transitions) */
  new_state?: ContractState;
  /** Whether the action was allowed */
  allowed?: boolean;
  /** Reason for decision */
  reason?: string;
  /** Additional event details */
  details: {
    [key: string]: any;
  };
}

/**
 * Audit log query options
 */
export interface AuditQueryOptions {
  contract_id?: string;
  event_type?: AuditEventType;
  actor?: string;
  start_time?: Date;
  end_time?: Date;
  allowed?: boolean;
  limit?: number;
  offset?: number;
}
