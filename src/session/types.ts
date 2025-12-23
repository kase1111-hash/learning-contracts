/**
 * Session Types
 *
 * Types for session management and session-scoped contract cleanup.
 */

/**
 * Session status
 */
export enum SessionStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  EXPIRED = 'expired',
}

/**
 * Session information
 */
export interface Session {
  /** Unique session identifier */
  session_id: string;
  /** User who owns this session */
  user_id: string;
  /** When the session was created */
  created_at: Date;
  /** When the session ended (null if active) */
  ended_at: Date | null;
  /** Current session status */
  status: SessionStatus;
  /** Contract IDs associated with this session */
  contract_ids: string[];
  /** Optional session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session end result
 */
export interface SessionEndResult {
  /** Session that was ended */
  session_id: string;
  /** Contracts that were cleaned up */
  contracts_cleaned: string[];
  /** Memories that were frozen/tombstoned */
  memories_affected: string[];
  /** When the session ended */
  ended_at: Date;
  /** Any errors that occurred during cleanup */
  errors: string[];
}

/**
 * Session cleanup options
 */
export interface SessionCleanupOptions {
  /** Whether to tombstone memories (vs freeze them) */
  tombstone?: boolean;
  /** Memory references to clean up */
  memories?: Array<{
    memory_id: string;
    contract_id: string;
    created_at: Date;
    classification: number;
    is_derived: boolean;
    derived_from?: string[];
  }>;
  /** Actor performing the cleanup */
  actor?: string;
}

/**
 * Session listener callback
 */
export type SessionEndListener = (session: Session, result: SessionEndResult) => void;
