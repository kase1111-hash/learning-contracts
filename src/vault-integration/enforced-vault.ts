/**
 * Contract-Enforced Vault
 *
 * Wraps a Memory Vault adapter with Learning Contract enforcement.
 * All memory operations are validated against active contracts before
 * being forwarded to the underlying vault.
 *
 * This ensures:
 * - No memory is stored without a valid, active contract
 * - Memory classification never exceeds contract cap
 * - Memory operations are scoped to contract domains/contexts
 * - Recall operations respect contract recall rules
 * - All violations are logged for audit
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MemoryObject,
  MemoryQuery,
  StoreResult,
  RecallResult,
  TombstoneInfo,
  IntegrityResult,
  EnforcementCheckResult,
  ContractEnforcedStoreOptions,
  ContractEnforcedRecallOptions,
} from './types';
import {
  MemoryVaultAdapter,
  VaultStoreOptions,
  VaultRecallOptions,
  VaultTombstoneOptions,
} from './adapter';
import {
  LearningContract,
  ContractState,
  ContractType,
  BoundaryMode,
} from '../types';

/**
 * Result of a contract-enforced operation
 */
export interface EnforcedOperationResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The operation result (if successful) */
  result?: T;
  /** Error message (if failed) */
  error?: string;
  /** Contract enforcement result */
  enforcement: EnforcementCheckResult;
  /** Contract ID that was checked */
  contract_id?: string;
  /** Audit event ID */
  audit_id: string;
}

/**
 * Contract resolver function type
 * Used to look up contracts by ID
 */
export type ContractResolver = (contract_id: string) => LearningContract | null;

/**
 * Contract finder function type
 * Used to find applicable contract for a domain/context/tool combination
 */
export type ContractFinder = (
  domain?: string,
  context?: string,
  tool?: string
) => LearningContract | null;

/**
 * Audit logger function type
 * Called for every operation (success or failure)
 */
export type AuditLogger = (event: VaultAuditEvent) => void;

/**
 * Vault audit event
 */
export interface VaultAuditEvent {
  /** Event ID */
  event_id: string;
  /** Event type */
  event_type: 'store' | 'recall' | 'tombstone' | 'query' | 'violation';
  /** Timestamp */
  timestamp: Date;
  /** Contract ID (if applicable) */
  contract_id?: string;
  /** Memory ID (if applicable) */
  memory_id?: string;
  /** Whether operation was allowed */
  allowed: boolean;
  /** Reason for denial (if denied) */
  denial_reason?: string;
  /** Actor who performed operation */
  actor: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Configuration for ContractEnforcedVault
 */
export interface ContractEnforcedVaultConfig {
  /** Vault adapter to wrap */
  adapter: MemoryVaultAdapter;
  /** Function to resolve contracts by ID */
  contractResolver: ContractResolver;
  /** Function to find applicable contract */
  contractFinder: ContractFinder;
  /** Audit logger (optional) */
  auditLogger?: AuditLogger;
  /** Current boundary mode */
  boundaryMode: BoundaryMode;
  /** Default actor for operations */
  defaultActor?: string;
}

/**
 * Contract-Enforced Memory Vault
 *
 * Ensures all memory operations comply with Learning Contracts.
 */
export class ContractEnforcedVault {
  private adapter: MemoryVaultAdapter;
  private resolveContract: ContractResolver;
  private findContract: ContractFinder;
  private logAudit: AuditLogger;
  private boundaryMode: BoundaryMode;
  private defaultActor: string;

  constructor(config: ContractEnforcedVaultConfig) {
    this.adapter = config.adapter;
    this.resolveContract = config.contractResolver;
    this.findContract = config.contractFinder;
    this.logAudit = config.auditLogger ?? (() => {});
    this.boundaryMode = config.boundaryMode;
    this.defaultActor = config.defaultActor ?? 'system';
  }

  /**
   * Update the current boundary mode
   */
  setBoundaryMode(mode: BoundaryMode): void {
    this.boundaryMode = mode;
  }

  /**
   * Get the current boundary mode
   */
  getBoundaryMode(): BoundaryMode {
    return this.boundaryMode;
  }

  /**
   * Store a memory with contract enforcement
   *
   * Validates:
   * - Contract exists and is active
   * - Contract permits memory storage
   * - Classification doesn't exceed cap
   * - Domain/context/tool are in scope
   */
  async storeMemory(
    options: ContractEnforcedStoreOptions,
    contract_id?: string
  ): Promise<EnforcedOperationResult<StoreResult>> {
    const audit_id = uuidv4();

    // Find or resolve contract
    const contract = contract_id
      ? this.resolveContract(contract_id)
      : this.findContract(options.domain, options.context, options.tool);

    // No contract found
    if (!contract) {
      const enforcement: EnforcementCheckResult = {
        allowed: false,
        reason: 'No applicable contract found for this operation',
      };

      this.logAudit({
        event_id: audit_id,
        event_type: 'violation',
        timestamp: new Date(),
        allowed: false,
        denial_reason: enforcement.reason,
        actor: this.defaultActor,
        details: { domain: options.domain, context: options.context, tool: options.tool },
      });

      return {
        success: false,
        error: enforcement.reason,
        enforcement,
        audit_id,
      };
    }

    // Check contract enforcement
    const enforcement = this.checkStorePermission(contract, options);

    if (!enforcement.allowed) {
      this.logAudit({
        event_id: audit_id,
        event_type: 'violation',
        timestamp: new Date(),
        contract_id: contract.contract_id,
        allowed: false,
        denial_reason: enforcement.reason,
        actor: this.defaultActor,
        details: { classification: options.classification, domain: options.domain },
      });

      return {
        success: false,
        error: enforcement.reason,
        enforcement,
        contract_id: contract.contract_id,
        audit_id,
      };
    }

    // Perform the store operation
    const content = typeof options.content === 'string'
      ? new TextEncoder().encode(options.content)
      : options.content;

    const storeOptions: VaultStoreOptions = {
      content,
      classification: options.classification,
      created_by: this.defaultActor,
      intent_ref: options.intent_ref,
      metadata: {
        ...options.metadata,
        contract_id: contract.contract_id,
        domain: options.domain,
        context: options.context,
        tool: options.tool,
        is_derived: options.derived_from !== undefined && options.derived_from.length > 0,
        derived_from: options.derived_from,
      },
    };

    try {
      const result = await this.adapter.storeMemory(storeOptions);

      this.logAudit({
        event_id: audit_id,
        event_type: 'store',
        timestamp: new Date(),
        contract_id: contract.contract_id,
        memory_id: result.memory_id,
        allowed: true,
        actor: this.defaultActor,
        details: { classification: options.classification, domain: options.domain },
      });

      // Add contract_id to result
      if (result.success) {
        result.contract_id = contract.contract_id;
      }

      return {
        success: result.success,
        result,
        enforcement,
        contract_id: contract.contract_id,
        audit_id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logAudit({
        event_id: audit_id,
        event_type: 'store',
        timestamp: new Date(),
        contract_id: contract.contract_id,
        allowed: true,
        denial_reason: `Vault error: ${errorMessage}`,
        actor: this.defaultActor,
      });

      return {
        success: false,
        error: errorMessage,
        enforcement,
        contract_id: contract.contract_id,
        audit_id,
      };
    }
  }

  /**
   * Recall a memory with contract enforcement
   *
   * Validates:
   * - Memory exists and has associated contract
   * - Contract is active (or handles expired/revoked appropriately)
   * - Boundary mode meets contract requirements
   * - Domain/context are in scope for recall
   */
  async recallMemory(
    options: ContractEnforcedRecallOptions
  ): Promise<EnforcedOperationResult<RecallResult>> {
    const audit_id = uuidv4();

    // First, get the memory to find its contract
    const memory = await this.adapter.getMemory(options.memory_id);

    if (!memory) {
      const enforcement: EnforcementCheckResult = {
        allowed: false,
        reason: 'Memory not found',
      };

      this.logAudit({
        event_id: audit_id,
        event_type: 'recall',
        timestamp: new Date(),
        memory_id: options.memory_id,
        allowed: false,
        denial_reason: enforcement.reason,
        actor: options.requester,
      });

      return {
        success: false,
        error: enforcement.reason,
        enforcement,
        audit_id,
      };
    }

    // Get the contract for this memory
    const contract = memory.contract_id
      ? this.resolveContract(memory.contract_id)
      : null;

    if (!contract) {
      const enforcement: EnforcementCheckResult = {
        allowed: false,
        reason: 'Memory has no associated contract or contract not found',
      };

      this.logAudit({
        event_id: audit_id,
        event_type: 'violation',
        timestamp: new Date(),
        memory_id: options.memory_id,
        allowed: false,
        denial_reason: enforcement.reason,
        actor: options.requester,
      });

      return {
        success: false,
        error: enforcement.reason,
        enforcement,
        audit_id,
      };
    }

    // Check contract enforcement for recall
    const enforcement = this.checkRecallPermission(contract, options, memory);

    if (!enforcement.allowed) {
      this.logAudit({
        event_id: audit_id,
        event_type: 'violation',
        timestamp: new Date(),
        contract_id: contract.contract_id,
        memory_id: options.memory_id,
        allowed: false,
        denial_reason: enforcement.reason,
        actor: options.requester,
      });

      return {
        success: false,
        error: enforcement.reason,
        enforcement,
        contract_id: contract.contract_id,
        audit_id,
      };
    }

    // Perform the recall operation
    const recallOptions: VaultRecallOptions = {
      memory_id: options.memory_id,
      requester: options.requester,
      justification: options.justification,
    };

    try {
      const result = await this.adapter.recallMemory(recallOptions);

      this.logAudit({
        event_id: audit_id,
        event_type: 'recall',
        timestamp: new Date(),
        contract_id: contract.contract_id,
        memory_id: options.memory_id,
        allowed: true,
        actor: options.requester,
        details: { justification: options.justification },
      });

      return {
        success: result.success,
        result,
        enforcement,
        contract_id: contract.contract_id,
        audit_id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logAudit({
        event_id: audit_id,
        event_type: 'recall',
        timestamp: new Date(),
        contract_id: contract.contract_id,
        memory_id: options.memory_id,
        allowed: true,
        denial_reason: `Vault error: ${errorMessage}`,
        actor: options.requester,
      });

      return {
        success: false,
        error: errorMessage,
        enforcement,
        contract_id: contract.contract_id,
        audit_id,
      };
    }
  }

  /**
   * Tombstone memories for a contract
   *
   * Used when a contract is revoked to mark all associated memories
   * as inaccessible.
   */
  async tombstoneContractMemories(
    contract_id: string,
    reason: string,
    requested_by: string
  ): Promise<TombstoneInfo[]> {
    const contract = this.resolveContract(contract_id);
    if (!contract) {
      throw new Error('Contract not found');
    }

    // Query all memories for this contract
    const memories = await this.adapter.queryMemories({
      contract_id,
      include_tombstoned: false,
    });

    const tombstones: TombstoneInfo[] = [];

    for (const memory of memories) {
      const options: VaultTombstoneOptions = {
        memory_id: memory.memory_id,
        reason,
        requested_by,
      };

      const tombstone = await this.adapter.tombstoneMemory(options);
      tombstone.contract_id = contract_id;
      tombstones.push(tombstone);

      this.logAudit({
        event_id: uuidv4(),
        event_type: 'tombstone',
        timestamp: new Date(),
        contract_id,
        memory_id: memory.memory_id,
        allowed: true,
        actor: requested_by,
        details: { reason },
      });
    }

    return tombstones;
  }

  /**
   * Query memories with contract filtering
   */
  async queryMemories(
    query: MemoryQuery,
    requester: string
  ): Promise<MemoryObject[]> {
    const audit_id = uuidv4();

    // If querying by contract, verify requester has access
    if (query.contract_id) {
      const contract = this.resolveContract(query.contract_id);
      if (!contract) {
        this.logAudit({
          event_id: audit_id,
          event_type: 'query',
          timestamp: new Date(),
          contract_id: query.contract_id,
          allowed: false,
          denial_reason: 'Contract not found',
          actor: requester,
        });
        return [];
      }
    }

    const memories = await this.adapter.queryMemories(query);

    this.logAudit({
      event_id: audit_id,
      event_type: 'query',
      timestamp: new Date(),
      contract_id: query.contract_id,
      allowed: true,
      actor: requester,
      details: { result_count: memories.length },
    });

    return memories;
  }

  /**
   * Verify vault integrity
   */
  async verifyIntegrity(): Promise<IntegrityResult> {
    return this.adapter.verifyIntegrity();
  }

  /**
   * Get underlying adapter for direct vault operations
   * (Use with caution - bypasses contract enforcement)
   */
  getAdapter(): MemoryVaultAdapter {
    return this.adapter;
  }

  /**
   * Check if a store operation is permitted by the contract
   */
  private checkStorePermission(
    contract: LearningContract,
    options: ContractEnforcedStoreOptions
  ): EnforcementCheckResult {
    const warnings: string[] = [];

    // Contract must be active
    if (contract.state !== ContractState.ACTIVE) {
      return {
        allowed: false,
        contract_id: contract.contract_id,
        reason: `Contract is not active (state: ${contract.state})`,
      };
    }

    // Contract type must permit storage
    if (contract.contract_type === ContractType.OBSERVATION) {
      return {
        allowed: false,
        contract_id: contract.contract_id,
        reason: 'Observation contracts do not permit memory storage',
      };
    }

    if (contract.contract_type === ContractType.PROHIBITED) {
      return {
        allowed: false,
        contract_id: contract.contract_id,
        reason: 'Prohibited domain contract forbids all memory storage',
      };
    }

    // Check may_store permission
    if (!contract.memory_permissions.may_store) {
      return {
        allowed: false,
        contract_id: contract.contract_id,
        reason: 'Contract does not permit memory storage',
      };
    }

    // Check classification cap
    if (options.classification > contract.memory_permissions.classification_cap) {
      return {
        allowed: false,
        contract_id: contract.contract_id,
        reason: `Classification ${options.classification} exceeds contract cap of ${contract.memory_permissions.classification_cap}`,
      };
    }

    // Check domain scope
    if (options.domain && contract.scope.domains.length > 0) {
      if (!contract.scope.domains.includes(options.domain)) {
        return {
          allowed: false,
          contract_id: contract.contract_id,
          reason: `Domain '${options.domain}' is not in contract scope (allowed: ${contract.scope.domains.join(', ')})`,
        };
      }
    }

    // Check context scope
    if (options.context && contract.scope.contexts.length > 0) {
      if (!contract.scope.contexts.includes(options.context)) {
        return {
          allowed: false,
          contract_id: contract.contract_id,
          reason: `Context '${options.context}' is not in contract scope (allowed: ${contract.scope.contexts.join(', ')})`,
        };
      }
    }

    // Check tool scope
    if (options.tool && contract.scope.tools.length > 0) {
      if (!contract.scope.tools.includes(options.tool)) {
        return {
          allowed: false,
          contract_id: contract.contract_id,
          reason: `Tool '${options.tool}' is not in contract scope (allowed: ${contract.scope.tools.join(', ')})`,
        };
      }
    }

    // Check boundary mode (some contracts require minimum boundary mode)
    if (this.boundaryMode < contract.recall_rules.boundary_mode_min) {
      warnings.push(`Current boundary mode is below contract minimum; recall may be restricted`);
    }

    return {
      allowed: true,
      contract_id: contract.contract_id,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Check if a recall operation is permitted by the contract
   */
  private checkRecallPermission(
    contract: LearningContract,
    options: ContractEnforcedRecallOptions,
    _memory: MemoryObject
  ): EnforcementCheckResult {
    // Contract state checks
    if (contract.state === ContractState.REVOKED) {
      return {
        allowed: false,
        contract_id: contract.contract_id,
        reason: 'Contract has been revoked - memories are inaccessible',
      };
    }

    if (contract.state === ContractState.EXPIRED) {
      return {
        allowed: false,
        contract_id: contract.contract_id,
        reason: 'Contract has expired - memories are frozen',
      };
    }

    if (contract.state !== ContractState.ACTIVE && contract.state !== ContractState.AMENDED) {
      return {
        allowed: false,
        contract_id: contract.contract_id,
        reason: `Contract is not active (state: ${contract.state})`,
      };
    }

    // Check boundary mode
    if (this.boundaryMode < contract.recall_rules.boundary_mode_min) {
      return {
        allowed: false,
        contract_id: contract.contract_id,
        reason: `Current boundary mode (${this.boundaryMode}) does not meet minimum required (${contract.recall_rules.boundary_mode_min})`,
      };
    }

    // Check domain scope for recall
    if (options.domain && contract.scope.domains.length > 0) {
      if (!contract.scope.domains.includes(options.domain)) {
        return {
          allowed: false,
          contract_id: contract.contract_id,
          reason: `Recall domain '${options.domain}' is not in contract scope`,
        };
      }
    }

    // Check context scope for recall
    if (options.context && contract.scope.contexts.length > 0) {
      if (!contract.scope.contexts.includes(options.context)) {
        return {
          allowed: false,
          contract_id: contract.contract_id,
          reason: `Recall context '${options.context}' is not in contract scope`,
        };
      }
    }

    // Note: requires_owner check would need external approval flow
    // This is a placeholder for that integration
    const warnings: string[] = [];
    if (contract.recall_rules.requires_owner) {
      warnings.push('This contract requires owner approval for recall');
    }

    return {
      allowed: true,
      contract_id: contract.contract_id,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
