/**
 * Contract Repository
 *
 * Stores and retrieves Learning Contracts.
 * Supports both in-memory and persistent storage through adapters.
 */

import {
  LearningContract,
  ContractState,
  ContractType,
} from '../types';
import { StorageAdapter } from './adapter';
import { MemoryStorageAdapter } from './memory-adapter';

export interface ContractQueryOptions {
  state?: ContractState;
  contract_type?: ContractType;
  created_by?: string;
  domain?: string;
  context?: string;
  active_only?: boolean;
}

export interface ContractRepositoryConfig {
  /**
   * Storage adapter to use. Defaults to MemoryStorageAdapter.
   */
  adapter?: StorageAdapter;
}

export class ContractRepository {
  private contracts: Map<string, LearningContract> = new Map();
  private adapter: StorageAdapter;
  private initialized = false;
  private pendingWrites: Promise<void>[] = [];

  constructor(config: ContractRepositoryConfig = {}) {
    this.adapter = config.adapter ?? new MemoryStorageAdapter();
  }

  /**
   * Initializes the repository (required for persistent storage)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.adapter.initialize();

    // Load all contracts into memory cache
    const contracts = await this.adapter.getAll();
    this.contracts.clear();
    for (const contract of contracts) {
      this.contracts.set(contract.contract_id, contract);
    }

    this.initialized = true;
  }

  /**
   * Checks if the repository has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Gets the storage adapter being used
   */
  getAdapter(): StorageAdapter {
    return this.adapter;
  }

  /**
   * Waits for all pending writes to complete
   */
  async flush(): Promise<void> {
    await Promise.all(this.pendingWrites);
    this.pendingWrites = [];
  }

  /**
   * Closes the repository and underlying storage
   */
  async close(): Promise<void> {
    await this.flush();
    await this.adapter.close();
    this.initialized = false;
  }

  /**
   * Stores a contract
   */
  save(contract: LearningContract): void {
    const cloned = { ...contract };
    this.contracts.set(contract.contract_id, cloned);

    // Persist to storage adapter in background
    if (this.initialized) {
      const writePromise = this.adapter.save(cloned).catch((error) => {
        console.error(`Failed to persist contract ${contract.contract_id}:`, error);
      });
      this.pendingWrites.push(writePromise);
    }
  }

  /**
   * Stores a contract asynchronously (waits for persistence)
   */
  async saveAsync(contract: LearningContract): Promise<void> {
    const cloned = { ...contract };
    this.contracts.set(contract.contract_id, cloned);

    if (this.initialized) {
      await this.adapter.save(cloned);
    }
  }

  /**
   * Retrieves a contract by ID
   */
  get(contractId: string): LearningContract | null {
    const contract = this.contracts.get(contractId);
    return contract ? { ...contract } : null;
  }

  /**
   * Deletes a contract (typically not used, revocation is preferred)
   */
  delete(contractId: string): boolean {
    const deleted = this.contracts.delete(contractId);

    // Persist to storage adapter in background
    if (deleted && this.initialized) {
      const writePromise = this.adapter.delete(contractId).then(() => {}).catch((error) => {
        console.error(`Failed to delete contract ${contractId}:`, error);
      });
      this.pendingWrites.push(writePromise);
    }

    return deleted;
  }

  /**
   * Deletes a contract asynchronously (waits for persistence)
   */
  async deleteAsync(contractId: string): Promise<boolean> {
    const deleted = this.contracts.delete(contractId);

    if (deleted && this.initialized) {
      await this.adapter.delete(contractId);
    }

    return deleted;
  }

  /**
   * Checks if a contract exists
   */
  exists(contractId: string): boolean {
    return this.contracts.has(contractId);
  }

  /**
   * Gets all contracts
   */
  getAll(): LearningContract[] {
    return Array.from(this.contracts.values()).map((c) => ({ ...c }));
  }

  /**
   * Queries contracts with filters
   */
  query(options: ContractQueryOptions = {}): LearningContract[] {
    let results = this.getAll();

    if (options.state) {
      results = results.filter((c) => c.state === options.state);
    }

    if (options.contract_type) {
      results = results.filter((c) => c.contract_type === options.contract_type);
    }

    if (options.created_by) {
      results = results.filter((c) => c.created_by === options.created_by);
    }

    if (options.domain) {
      results = results.filter((c) =>
        c.scope.domains.includes(options.domain!)
      );
    }

    if (options.context) {
      results = results.filter((c) =>
        c.scope.contexts.includes(options.context!)
      );
    }

    if (options.active_only) {
      results = results.filter(
        (c) =>
          c.state === ContractState.ACTIVE &&
          (!c.expiration || c.expiration > new Date())
      );
    }

    return results;
  }

  /**
   * Gets active contracts for a specific scope
   */
  getActiveContractsForScope(
    domain?: string,
    context?: string,
    tool?: string
  ): LearningContract[] {
    const activeContracts = this.query({ active_only: true });

    return activeContracts.filter((contract) => {
      // Check if contract scope matches the query
      let matches = true;

      if (domain) {
        matches =
          matches &&
          (contract.scope.domains.length === 0 ||
            contract.scope.domains.includes(domain));
      }

      if (context) {
        matches =
          matches &&
          (contract.scope.contexts.length === 0 ||
            contract.scope.contexts.includes(context));
      }

      if (tool) {
        matches =
          matches &&
          (contract.scope.tools.length === 0 ||
            contract.scope.tools.includes(tool));
      }

      return matches;
    });
  }

  /**
   * Gets prohibited contracts (these override all others)
   */
  getProhibitedContracts(): LearningContract[] {
    return this.query({
      contract_type: ContractType.PROHIBITED,
      active_only: true,
    });
  }

  /**
   * Finds contract that applies to a given operation
   * Returns the most restrictive contract (Prohibited > others)
   */
  findApplicableContract(
    domain?: string,
    context?: string,
    tool?: string
  ): LearningContract | null {
    // First check for prohibited contracts
    const prohibited = this.getProhibitedContracts().find((contract) => {
      if (domain && contract.scope.domains.includes(domain)) {
        return true;
      }
      if (context && contract.scope.contexts.includes(context)) {
        return true;
      }
      if (tool && contract.scope.tools.includes(tool)) {
        return true;
      }
      return false;
    });

    if (prohibited) {
      return prohibited;
    }

    // Then find matching active contracts
    const applicable = this.getActiveContractsForScope(domain, context, tool);

    // Return the first match (in real implementation, might have priority logic)
    return applicable.length > 0 ? applicable[0] : null;
  }

  /**
   * Gets expired contracts (contract-level expiration)
   */
  getExpiredContracts(): LearningContract[] {
    const now = new Date();
    return this.getAll().filter(
      (c) =>
        c.state === ContractState.ACTIVE &&
        c.expiration &&
        c.expiration < now
    );
  }

  /**
   * Gets contracts with expired timebound retention
   * These are contracts where retention_until has passed but contract is still active
   */
  getTimeboundExpiredContracts(): LearningContract[] {
    const now = new Date();
    return this.getAll().filter(
      (c) =>
        c.state === ContractState.ACTIVE &&
        c.memory_permissions.retention === 'timebound' &&
        c.memory_permissions.retention_until &&
        c.memory_permissions.retention_until < now
    );
  }

  /**
   * Gets count of contracts
   */
  count(): number {
    return this.contracts.size;
  }

  /**
   * Gets count by state
   */
  countByState(state: ContractState): number {
    return this.query({ state }).length;
  }

  /**
   * Clears all contracts (for testing)
   */
  clear(): void {
    this.contracts.clear();

    // Persist to storage adapter in background
    if (this.initialized) {
      const writePromise = this.adapter.clear().catch((error) => {
        console.error('Failed to clear storage:', error);
      });
      this.pendingWrites.push(writePromise);
    }
  }

  /**
   * Clears all contracts asynchronously (waits for persistence)
   */
  async clearAsync(): Promise<void> {
    this.contracts.clear();

    if (this.initialized) {
      await this.adapter.clear();
    }
  }
}
