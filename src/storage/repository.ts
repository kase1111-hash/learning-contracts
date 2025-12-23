/**
 * Contract Repository
 *
 * Stores and retrieves Learning Contracts.
 * In-memory implementation (can be extended for persistent storage).
 */

import {
  LearningContract,
  ContractState,
  ContractType,
} from '../types';

export interface ContractQueryOptions {
  state?: ContractState;
  contract_type?: ContractType;
  created_by?: string;
  domain?: string;
  context?: string;
  active_only?: boolean;
}

export class ContractRepository {
  private contracts: Map<string, LearningContract> = new Map();

  /**
   * Stores a contract
   */
  save(contract: LearningContract): void {
    this.contracts.set(contract.contract_id, { ...contract });
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
    return this.contracts.delete(contractId);
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
  }
}
