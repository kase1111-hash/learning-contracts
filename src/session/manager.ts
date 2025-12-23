/**
 * Session Manager
 *
 * Manages sessions and handles automatic cleanup of session-scoped contracts
 * when sessions end.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Session,
  SessionStatus,
  SessionEndResult,
  SessionCleanupOptions,
  SessionEndListener,
} from './types';
import { LearningContract, ContractState, RetentionDuration } from '../types';
import { MemoryReference, ForgettingResult } from '../memory/forgetting';
import { AuditLogger } from '../audit/logger';

/**
 * Contract resolver function type
 */
export type SessionContractResolver = (contractId: string) => LearningContract | null;

/**
 * Contract expirer function type
 */
export type SessionContractExpirer = (contractId: string, actor: string) => LearningContract;

/**
 * Memory freezer function type
 */
export type SessionMemoryFreezer = (
  contractId: string,
  memories: MemoryReference[]
) => ForgettingResult;

/**
 * Session Manager configuration
 */
export interface SessionManagerConfig {
  /** Function to resolve contracts by ID */
  contractResolver: SessionContractResolver;
  /** Function to expire a contract */
  contractExpirer: SessionContractExpirer;
  /** Function to freeze memories */
  memoryFreezer: SessionMemoryFreezer;
  /** Audit logger */
  auditLogger: AuditLogger;
  /** Default session timeout in milliseconds (default: 24 hours) */
  defaultTimeoutMs?: number;
}

/**
 * Session Manager
 *
 * Tracks active sessions and cleans up session-scoped contracts when sessions end.
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private contractToSession: Map<string, string> = new Map();
  private endListeners: SessionEndListener[] = [];

  private resolveContract: SessionContractResolver;
  private expireContract: SessionContractExpirer;
  private freezeMemories: SessionMemoryFreezer;
  private auditLogger: AuditLogger;
  private defaultTimeoutMs: number;

  constructor(config: SessionManagerConfig) {
    this.resolveContract = config.contractResolver;
    this.expireContract = config.contractExpirer;
    this.freezeMemories = config.memoryFreezer;
    this.auditLogger = config.auditLogger;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Start a new session
   */
  startSession(userId: string, metadata?: Record<string, unknown>): Session {
    const session: Session = {
      session_id: uuidv4(),
      user_id: userId,
      created_at: new Date(),
      ended_at: null,
      status: SessionStatus.ACTIVE,
      contract_ids: [],
      metadata,
    };

    this.sessions.set(session.session_id, session);

    this.auditLogger.logCustomEvent('session_started', {
      session_id: session.session_id,
      user_id: userId,
      metadata,
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === SessionStatus.ACTIVE
    );
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): Session[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.user_id === userId
    );
  }

  /**
   * Associate a contract with a session
   *
   * Only session-scoped contracts should be associated with sessions.
   */
  associateContract(sessionId: string, contractId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.status !== SessionStatus.ACTIVE) {
      return false;
    }

    const contract = this.resolveContract(contractId);
    if (!contract) {
      return false;
    }

    // Only allow association of session-scoped contracts
    if (contract.memory_permissions.retention !== RetentionDuration.SESSION) {
      return false;
    }

    if (!session.contract_ids.includes(contractId)) {
      session.contract_ids.push(contractId);
      this.contractToSession.set(contractId, sessionId);

      this.auditLogger.logCustomEvent('contract_associated_with_session', {
        session_id: sessionId,
        contract_id: contractId,
      });
    }

    return true;
  }

  /**
   * Disassociate a contract from its session
   */
  disassociateContract(contractId: string): boolean {
    const sessionId = this.contractToSession.get(contractId);
    if (!sessionId) {
      return false;
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.contract_ids = session.contract_ids.filter(
        (id) => id !== contractId
      );
    }

    this.contractToSession.delete(contractId);

    this.auditLogger.logCustomEvent('contract_disassociated_from_session', {
      session_id: sessionId,
      contract_id: contractId,
    });

    return true;
  }

  /**
   * Get the session ID for a contract
   */
  getContractSession(contractId: string): string | null {
    return this.contractToSession.get(contractId) ?? null;
  }

  /**
   * Check if a contract is associated with a session
   */
  isContractInSession(contractId: string): boolean {
    return this.contractToSession.has(contractId);
  }

  /**
   * End a session and clean up associated contracts
   */
  endSession(
    sessionId: string,
    options: SessionCleanupOptions = {}
  ): SessionEndResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        session_id: sessionId,
        contracts_cleaned: [],
        memories_affected: [],
        ended_at: new Date(),
        errors: ['Session not found'],
      };
    }

    if (session.status !== SessionStatus.ACTIVE) {
      return {
        session_id: sessionId,
        contracts_cleaned: [],
        memories_affected: [],
        ended_at: session.ended_at ?? new Date(),
        errors: ['Session already ended'],
      };
    }

    const result: SessionEndResult = {
      session_id: sessionId,
      contracts_cleaned: [],
      memories_affected: [],
      ended_at: new Date(),
      errors: [],
    };

    // Clean up each associated contract
    for (const contractId of session.contract_ids) {
      try {
        const cleanupResult = this.cleanupContract(contractId, options);
        result.contracts_cleaned.push(contractId);
        result.memories_affected.push(...cleanupResult.memories);
      } catch (error) {
        result.errors.push(
          `Failed to cleanup contract ${contractId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Update session status
    session.status = SessionStatus.ENDED;
    session.ended_at = result.ended_at;

    // Clear contract mappings
    for (const contractId of session.contract_ids) {
      this.contractToSession.delete(contractId);
    }

    this.auditLogger.logCustomEvent('session_ended', {
      session_id: sessionId,
      contracts_cleaned: result.contracts_cleaned.length,
      memories_affected: result.memories_affected.length,
      errors: result.errors.length,
    });

    // Notify listeners
    for (const listener of this.endListeners) {
      try {
        listener(session, result);
      } catch (error) {
        console.error('Session end listener error:', error);
      }
    }

    return result;
  }

  /**
   * Clean up a single contract
   */
  private cleanupContract(
    contractId: string,
    options: SessionCleanupOptions
  ): { memories: string[] } {
    const contract = this.resolveContract(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    // Only cleanup active contracts
    if (contract.state !== ContractState.ACTIVE) {
      return { memories: [] };
    }

    // Expire the contract first
    const actor = options.actor ?? 'session-manager';
    this.expireContract(contractId, actor);

    // Now clean up memories if provided
    const memories = options.memories?.filter(
      (m) => m.contract_id === contractId
    ) ?? [];

    if (memories.length > 0) {
      // Refresh contract to get updated state
      const expiredContract = this.resolveContract(contractId);
      if (expiredContract && expiredContract.state === ContractState.EXPIRED) {
        if (options.tombstone) {
          // Need to revoke first to tombstone
          // For now, just freeze since contract is expired
          this.freezeMemories(contractId, memories);
        } else {
          this.freezeMemories(contractId, memories);
        }
      }
    }

    return {
      memories: memories.map((m) => m.memory_id),
    };
  }

  /**
   * End all sessions for a user
   */
  endUserSessions(
    userId: string,
    options: SessionCleanupOptions = {}
  ): SessionEndResult[] {
    const userSessions = this.getActiveSessions().filter(
      (s) => s.user_id === userId
    );

    return userSessions.map((session) =>
      this.endSession(session.session_id, options)
    );
  }

  /**
   * Check for and expire timed-out sessions
   */
  expireTimedOutSessions(options: SessionCleanupOptions = {}): SessionEndResult[] {
    const now = Date.now();
    const results: SessionEndResult[] = [];

    for (const session of this.getActiveSessions()) {
      const sessionAge = now - session.created_at.getTime();
      const timeout = (session.metadata?.timeoutMs as number) ?? this.defaultTimeoutMs;

      if (sessionAge > timeout) {
        // Update status to expired instead of ended
        session.status = SessionStatus.EXPIRED;
        const result = this.endSession(session.session_id, options);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Register a listener for session end events
   */
  onSessionEnd(listener: SessionEndListener): () => void {
    this.endListeners.push(listener);
    return () => {
      const index = this.endListeners.indexOf(listener);
      if (index > -1) {
        this.endListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get statistics about sessions
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    endedSessions: number;
    expiredSessions: number;
    totalContractsInSessions: number;
  } {
    const sessions = Array.from(this.sessions.values());
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === SessionStatus.ACTIVE).length,
      endedSessions: sessions.filter((s) => s.status === SessionStatus.ENDED).length,
      expiredSessions: sessions.filter((s) => s.status === SessionStatus.EXPIRED).length,
      totalContractsInSessions: this.contractToSession.size,
    };
  }

  /**
   * Clean up old ended/expired sessions from memory
   */
  cleanupOldSessions(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status !== SessionStatus.ACTIVE && session.ended_at) {
        const age = now - session.ended_at.getTime();
        if (age >= maxAgeMs) {
          this.sessions.delete(sessionId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }
}
