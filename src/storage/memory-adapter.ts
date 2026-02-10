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

  initialize(): Promise<void> {
    // No initialization needed for memory storage
    return Promise.resolve();
  }

  save(contract: LearningContract): Promise<void> {
    // Deep clone to prevent external mutations
    this.contracts.set(contract.contract_id, { ...contract });
    return Promise.resolve();
  }

  get(contractId: string): Promise<LearningContract | null> {
    const contract = this.contracts.get(contractId);
    return Promise.resolve(contract ? { ...contract } : null);
  }

  delete(contractId: string): Promise<boolean> {
    return Promise.resolve(this.contracts.delete(contractId));
  }

  exists(contractId: string): Promise<boolean> {
    return Promise.resolve(this.contracts.has(contractId));
  }

  getAll(): Promise<LearningContract[]> {
    return Promise.resolve(Array.from(this.contracts.values()).map((c) => ({ ...c })));
  }

  count(): Promise<number> {
    return Promise.resolve(this.contracts.size);
  }

  clear(): Promise<void> {
    this.contracts.clear();
    return Promise.resolve();
  }

  close(): Promise<void> {
    // No cleanup needed for memory storage
    return Promise.resolve();
  }
}
