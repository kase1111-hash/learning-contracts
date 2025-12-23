/**
 * Storage Adapter Interface
 *
 * Defines the contract for persistent storage backends.
 * Implementations can include memory, file, SQLite, PostgreSQL, etc.
 */

import { LearningContract } from '../types';

/**
 * Serialized contract format for storage
 * Converts Date objects to ISO strings for JSON compatibility
 */
export interface SerializedContract {
  contract_id: string;
  created_at: string; // ISO date string
  created_by: string;
  state: string;
  contract_type: string;
  scope: {
    domains: string[];
    contexts: string[];
    tools: string[];
    max_abstraction: string;
    transferable: boolean;
  };
  memory_permissions: {
    may_store: boolean;
    classification_cap: number;
    retention: string;
    retention_until?: string; // ISO date string
  };
  generalization_rules: {
    allowed: boolean;
    conditions: string[];
  };
  recall_rules: {
    requires_owner: boolean;
    boundary_mode_min: string;
  };
  expiration: string | null; // ISO date string or null
  revocable: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Storage adapter interface
 * All storage backends must implement this interface
 */
export interface StorageAdapter {
  /**
   * Initializes the storage adapter (e.g., create tables, open files)
   */
  initialize(): Promise<void>;

  /**
   * Saves a contract to storage
   */
  save(contract: LearningContract): Promise<void>;

  /**
   * Retrieves a contract by ID
   */
  get(contractId: string): Promise<LearningContract | null>;

  /**
   * Deletes a contract by ID
   */
  delete(contractId: string): Promise<boolean>;

  /**
   * Checks if a contract exists
   */
  exists(contractId: string): Promise<boolean>;

  /**
   * Gets all contracts
   */
  getAll(): Promise<LearningContract[]>;

  /**
   * Gets the count of contracts
   */
  count(): Promise<number>;

  /**
   * Clears all contracts (for testing)
   */
  clear(): Promise<void>;

  /**
   * Closes the storage connection/file
   */
  close(): Promise<void>;
}

/**
 * Serializes a LearningContract for JSON storage
 */
export function serializeContract(contract: LearningContract): SerializedContract {
  return {
    contract_id: contract.contract_id,
    created_at: contract.created_at.toISOString(),
    created_by: contract.created_by,
    state: contract.state,
    contract_type: contract.contract_type,
    scope: {
      domains: contract.scope.domains,
      contexts: contract.scope.contexts,
      tools: contract.scope.tools,
      max_abstraction: contract.scope.max_abstraction,
      transferable: contract.scope.transferable,
    },
    memory_permissions: {
      may_store: contract.memory_permissions.may_store,
      classification_cap: contract.memory_permissions.classification_cap,
      retention: contract.memory_permissions.retention,
      retention_until: contract.memory_permissions.retention_until?.toISOString(),
    },
    generalization_rules: {
      allowed: contract.generalization_rules.allowed,
      conditions: contract.generalization_rules.conditions,
    },
    recall_rules: {
      requires_owner: contract.recall_rules.requires_owner,
      boundary_mode_min: contract.recall_rules.boundary_mode_min,
    },
    expiration: contract.expiration?.toISOString() ?? null,
    revocable: contract.revocable,
    metadata: contract.metadata,
  };
}

/**
 * Deserializes a stored contract back to LearningContract
 */
export function deserializeContract(data: SerializedContract): LearningContract {
  return {
    contract_id: data.contract_id,
    created_at: new Date(data.created_at),
    created_by: data.created_by,
    state: data.state as LearningContract['state'],
    contract_type: data.contract_type as LearningContract['contract_type'],
    scope: {
      domains: data.scope.domains,
      contexts: data.scope.contexts,
      tools: data.scope.tools,
      max_abstraction: data.scope.max_abstraction as LearningContract['scope']['max_abstraction'],
      transferable: data.scope.transferable,
    },
    memory_permissions: {
      may_store: data.memory_permissions.may_store,
      classification_cap: data.memory_permissions.classification_cap,
      retention: data.memory_permissions.retention as LearningContract['memory_permissions']['retention'],
      retention_until: data.memory_permissions.retention_until
        ? new Date(data.memory_permissions.retention_until)
        : undefined,
    },
    generalization_rules: {
      allowed: data.generalization_rules.allowed,
      conditions: data.generalization_rules.conditions,
    },
    recall_rules: {
      requires_owner: data.recall_rules.requires_owner,
      boundary_mode_min: data.recall_rules.boundary_mode_min as LearningContract['recall_rules']['boundary_mode_min'],
    },
    expiration: data.expiration ? new Date(data.expiration) : null,
    revocable: data.revocable,
    metadata: data.metadata,
  };
}
