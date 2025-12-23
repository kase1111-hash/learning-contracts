/**
 * Memory Forgetting and Revocation
 *
 * Handles memory operations when contracts are revoked or expired.
 * Revocation does NOT delete audit traces.
 */

import { LearningContract, ContractState } from '../types';
import { AuditLogger } from '../audit/logger';

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
 * Forgetting result
 */
export interface ForgettingResult {
  affected_memories: string[];
  affected_derived: string[];
  status: MemoryStatus;
  audit_preserved: boolean;
}

export class MemoryForgetting {
  constructor(private auditLogger: AuditLogger) {}

  /**
   * Freezes memories when contract expires
   * Memory preserved but marked inaccessible
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
   * Tombstones memories when contract is revoked
   * Memory marked inaccessible, derived memories quarantined
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
   * Deep purge - permanently removes memories
   * Requires owner ceremony (explicit confirmation)
   * Audit traces are still preserved
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
    // Verify owner confirmation (in real implementation, would validate token)
    if (ownerConfirmation.owner !== contract.created_by) {
      throw new Error('Only contract owner can perform deep purge');
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
