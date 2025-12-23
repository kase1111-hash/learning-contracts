/**
 * Memory Storage Adapter
 *
 * In-memory storage adapter for development and testing.
 * Data is lost when the process ends.
 */

import { LearningContract } from '../types';
import { StorageAdapter } from './adapter';

export class MemoryStorageAdapter implements StorageAdapter {
  private contracts: Map<string, LearningContract> = new Map();

  async initialize(): Promise<void> {
    // No initialization needed for memory storage
  }

  async save(contract: LearningContract): Promise<void> {
    // Deep clone to prevent external mutations
    this.contracts.set(contract.contract_id, { ...contract });
  }

  async get(contractId: string): Promise<LearningContract | null> {
    const contract = this.contracts.get(contractId);
    return contract ? { ...contract } : null;
  }

  async delete(contractId: string): Promise<boolean> {
    return this.contracts.delete(contractId);
  }

  async exists(contractId: string): Promise<boolean> {
    return this.contracts.has(contractId);
  }

  async getAll(): Promise<LearningContract[]> {
    return Array.from(this.contracts.values()).map((c) => ({ ...c }));
  }

  async count(): Promise<number> {
    return this.contracts.size;
  }

  async clear(): Promise<void> {
    this.contracts.clear();
  }

  async close(): Promise<void> {
    // No cleanup needed for memory storage
  }
}
