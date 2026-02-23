/**
 * Memory Forgetting and Revocation
 *
 * Handles memory operations when contracts are revoked or expired.
 * Revocation does NOT delete audit traces.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { LearningContract, ContractState } from '../types';
import { AuditLogger } from '../audit/logger';

const TOKEN_VALIDITY_MS = 300000; // 5 minutes

/**
 * Retrieves the purge token secret from environment, throwing if not configured.
 * There is no hardcoded fallback — callers must set PURGE_TOKEN_SECRET.
 */
function getTokenSecret(): string {
  const secret = process.env.PURGE_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      'PURGE_TOKEN_SECRET environment variable is required for purge operations. ' +
      'Set it to a cryptographically random string (minimum 32 characters).'
    );
  }
  return secret;
}

/**
 * Memory status after contract revocation/expiration
 */
export enum MemoryStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen', // Expired contract - memory preserved but inaccessible
  TOMBSTONED = 'tombstoned', // Revoked contract - memory marked as deleted
  PURGED = 'purged', // Deep purge - requires owner ceremony
}

/**
 * Memory reference (minimal info for tracking)
 */
export interface MemoryReference {
  memory_id: string;
  contract_id: string;
  created_at: Date;
  classification: number;
  is_derived: boolean;
  derived_from?: string[];
}

/**
 * Result of a forgetting operation.
 *
 * NOTE: This represents the INTENT to forget, not confirmation that memories
 * have been deleted. Consumers must use affected_memories and affected_derived
 * to perform actual deletion or freezing in their memory backend.
 */
export interface ForgettingResult {
  affected_memories: string[];
  affected_derived: string[];
  status: MemoryStatus;
  audit_preserved: boolean;
}

/**
 * Generates a secure purge confirmation token
 * Token format: nonce.timestamp.signature
 */
export function generatePurgeToken(contractId: string, owner: string): string {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const data = `${contractId}:${owner}:${nonce}:${timestamp}`;
  const signature = createHmac('sha256', getTokenSecret()).update(data).digest('hex');
  return `${nonce}.${timestamp}.${signature}`;
}

/**
 * Validates a purge confirmation token
 */
function validatePurgeToken(
  token: string,
  contractId: string,
  owner: string,
  timestamp: Date
): { valid: boolean; error?: string } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid token format' };
  }

  const [nonce, tokenTimestamp, providedSignature] = parts;
  const tokenTime = parseInt(tokenTimestamp, 10);

  // Check if token has expired
  const now = Date.now();
  if (now - tokenTime > TOKEN_VALIDITY_MS) {
    return { valid: false, error: 'Token has expired' };
  }

  // Check if confirmation timestamp is after token creation
  if (timestamp.getTime() < tokenTime) {
    return { valid: false, error: 'Confirmation timestamp precedes token creation' };
  }

  // WHY timingSafeEqual: Prevents timing side-channel attacks where an attacker
  // could determine how many bytes of the signature matched by measuring response
  // time. Critical for purge token validation because token forgery could enable
  // unauthorized memory deletion.
  const data = `${contractId}:${owner}:${nonce}:${tokenTimestamp}`;
  const expectedSignature = createHmac('sha256', getTokenSecret()).update(data).digest('hex');

  const providedBuffer = Buffer.from(providedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (providedBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: 'Invalid token signature' };
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { valid: false, error: 'Invalid token signature' };
  }

  return { valid: true };
}

// FIXME: freezeMemories/tombstoneMemories/deepPurge return intent only.
// They do not mutate any actual memory store. Consumers must implement
// actual deletion based on the returned ForgettingResult.
/**
 * Memory Forgetting and Revocation
 *
 * IMPORTANT: This class computes forgetting INTENT, not forgetting EXECUTION.
 * Methods like freezeMemories(), tombstoneMemories(), and deepPurge() return
 * ForgettingResult objects listing which memory IDs should be affected, but they
 * do NOT mutate any actual memory store. Consumers MUST use the returned
 * affected_memories and affected_derived arrays to perform actual deletion or
 * freezing in their memory backend.
 *
 * For automatic enforcement that includes actual memory deletion, use the
 * ContractGovernedStore from src/integration/memory-store.ts, which implements
 * the MemoryStore interface and calls forget() on the backing store.
 */
export class MemoryForgetting {
  constructor(private auditLogger: AuditLogger) {}

  /**
   * Computes which memories should be frozen when a contract expires.
   * Returns the list of affected memory IDs but does NOT mutate any store.
   * The caller must implement actual freezing based on the returned ForgettingResult.
   */
  freezeMemories(
    contract: LearningContract,
    memories: MemoryReference[]
  ): ForgettingResult {
    if (contract.state !== ContractState.EXPIRED) {
      throw new Error('Can only freeze memories for expired contracts');
    }

    const affectedIds = memories
      .filter((m) => m.contract_id === contract.contract_id)
      .map((m) => m.memory_id);

    this.auditLogger.logMemoryFrozen(contract.contract_id, affectedIds);

    return {
      affected_memories: affectedIds,
      affected_derived: [],
      status: MemoryStatus.FROZEN,
      audit_preserved: true,
    };
  }

  /**
   * Computes which memories should be tombstoned when a contract is revoked.
   * Returns the list of affected memory IDs (including derived) but does NOT
   * mutate any store. The caller must implement actual tombstoning.
   */
  tombstoneMemories(
    contract: LearningContract,
    memories: MemoryReference[]
  ): ForgettingResult {
    if (contract.state !== ContractState.REVOKED) {
      throw new Error('Can only tombstone memories for revoked contracts');
    }

    // Find all memories created under this contract
    const directMemories = memories.filter(
      (m) => m.contract_id === contract.contract_id
    );

    // Find all derived memories (recursive)
    const derivedMemories = this.findDerivedMemories(
      directMemories.map((m) => m.memory_id),
      memories
    );

    const affectedIds = directMemories.map((m) => m.memory_id);
    const derivedIds = derivedMemories.map((m) => m.memory_id);

    this.auditLogger.logMemoryTombstoned(
      contract.contract_id,
      affectedIds,
      derivedIds
    );

    return {
      affected_memories: affectedIds,
      affected_derived: derivedIds,
      status: MemoryStatus.TOMBSTONED,
      audit_preserved: true,
    };
  }

  /**
   * Computes which memories should be permanently purged.
   * Requires owner ceremony (explicit confirmation token).
   * Returns the list of affected memory IDs but does NOT mutate any store.
   * The caller must implement actual deletion. Audit traces are always preserved.
   */
  deepPurge(
    contract: LearningContract,
    memories: MemoryReference[],
    ownerConfirmation: {
      owner: string;
      confirmation_token: string;
      timestamp: Date;
    }
  ): ForgettingResult {
    // Verify owner identity
    if (ownerConfirmation.owner !== contract.created_by) {
      throw new Error('Only contract owner can perform deep purge');
    }

    // Validate the confirmation token cryptographically
    const tokenValidation = validatePurgeToken(
      ownerConfirmation.confirmation_token,
      contract.contract_id,
      ownerConfirmation.owner,
      ownerConfirmation.timestamp
    );
    if (!tokenValidation.valid) {
      throw new Error(`Invalid purge token: ${tokenValidation.error}`);
    }

    // Find all memories to purge
    const directMemories = memories.filter(
      (m) => m.contract_id === contract.contract_id
    );

    const derivedMemories = this.findDerivedMemories(
      directMemories.map((m) => m.memory_id),
      memories
    );

    const affectedIds = directMemories.map((m) => m.memory_id);
    const derivedIds = derivedMemories.map((m) => m.memory_id);

    this.auditLogger.logMemoryPurged(
      contract.contract_id,
      affectedIds,
      derivedIds,
      ownerConfirmation
    );

    return {
      affected_memories: affectedIds,
      affected_derived: derivedIds,
      status: MemoryStatus.PURGED,
      audit_preserved: true, // Audit is ALWAYS preserved
    };
  }

  /**
   * Invalidates heuristics derived from revoked memories
   */
  invalidateHeuristics(
    memoryIds: string[],
    heuristics: Array<{
      heuristic_id: string;
      derived_from: string[];
    }>
  ): string[] {
    const invalidated: string[] = [];

    for (const heuristic of heuristics) {
      // If any source memory is in the revoked set, invalidate the heuristic
      const hasRevokedSource = heuristic.derived_from.some((sourceId) =>
        memoryIds.includes(sourceId)
      );

      if (hasRevokedSource) {
        invalidated.push(heuristic.heuristic_id);
      }
    }

    this.auditLogger.logHeuristicsInvalidated(invalidated, memoryIds);

    return invalidated;
  }

  /**
   * Recursively finds all memories derived from a set of source memories
   */
  private findDerivedMemories(
    sourceIds: string[],
    allMemories: MemoryReference[]
  ): MemoryReference[] {
    const derived: MemoryReference[] = [];
    const seen = new Set<string>();

    const findRecursive = (currentIds: string[]) => {
      for (const memory of allMemories) {
        if (
          memory.is_derived &&
          memory.derived_from &&
          !seen.has(memory.memory_id)
        ) {
          // Check if any of this memory's sources are in our target set
          const hasDerivedSource = memory.derived_from.some((sourceId) =>
            currentIds.includes(sourceId)
          );

          if (hasDerivedSource) {
            derived.push(memory);
            seen.add(memory.memory_id);
            // Recursively find memories derived from this one
            findRecursive([memory.memory_id]);
          }
        }
      }
    };

    findRecursive(sourceIds);
    return derived;
  }

  /**
   * Checks if a memory is accessible given contract state
   */
  isMemoryAccessible(
    _memory: MemoryReference,
    contract: LearningContract
  ): { accessible: boolean; reason?: string } {
    if (contract.state === ContractState.EXPIRED) {
      return {
        accessible: false,
        reason: 'Contract expired - memory frozen',
      };
    }

    if (contract.state === ContractState.REVOKED) {
      return {
        accessible: false,
        reason: 'Contract revoked - memory tombstoned',
      };
    }

    if (contract.state !== ContractState.ACTIVE) {
      return {
        accessible: false,
        reason: 'Contract not active',
      };
    }

    return { accessible: true };
  }
}
