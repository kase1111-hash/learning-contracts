/**
 * Contract Lifecycle Manager
 *
 * Manages contract state transitions:
 * Draft → Review → Activate → Enforce → Expire | Revoke | Amend
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LearningContract,
  ContractState,
  ContractType,
  LearningScope,
  MemoryPermissions,
  GeneralizationRules,
  RecallRules,
} from '../types';
import { ContractValidator } from './validator';
import { AuditLogger } from '../audit/logger';

export interface ContractDraft {
  created_by: string;
  contract_type: ContractType;
  scope: LearningScope;
  memory_permissions: MemoryPermissions;
  generalization_rules: GeneralizationRules;
  recall_rules: RecallRules;
  expiration?: Date | null;
  revocable?: boolean;
}

export class ContractLifecycleManager {
  constructor(private auditLogger: AuditLogger) {}

  /**
   * Creates a new contract in DRAFT state
   */
  createDraft(draft: ContractDraft): LearningContract {
    const contract: LearningContract = {
      contract_id: uuidv4(),
      created_at: new Date(),
      created_by: draft.created_by,
      state: ContractState.DRAFT,
      contract_type: draft.contract_type,
      scope: draft.scope,
      memory_permissions: draft.memory_permissions,
      generalization_rules: draft.generalization_rules,
      recall_rules: draft.recall_rules,
      expiration: draft.expiration ?? null,
      revocable: draft.revocable ?? true,
    };

    // Validate the draft
    const validation = ContractValidator.validate(contract);
    if (!validation.valid) {
      throw new Error(
        `Invalid contract draft: ${validation.errors.join(', ')}`
      );
    }

    this.auditLogger.logContractCreated(contract, draft.created_by);

    return contract;
  }

  /**
   * Transitions contract to REVIEW state
   */
  submitForReview(contract: LearningContract, actor: string): LearningContract {
    this.validateTransition(contract, ContractState.REVIEW);

    const updated = {
      ...contract,
      state: ContractState.REVIEW,
    };

    this.auditLogger.logStateTransition(
      contract.contract_id,
      actor,
      ContractState.DRAFT,
      ContractState.REVIEW
    );

    return updated;
  }

  /**
   * Activates a contract (transitions to ACTIVE state)
   */
  activate(contract: LearningContract, actor: string): LearningContract {
    this.validateTransition(contract, ContractState.ACTIVE);

    // Re-validate before activation
    const validation = ContractValidator.validate(contract);
    if (!validation.valid) {
      throw new Error(
        `Cannot activate invalid contract: ${validation.errors.join(', ')}`
      );
    }

    const updated = {
      ...contract,
      state: ContractState.ACTIVE,
    };

    this.auditLogger.logStateTransition(
      contract.contract_id,
      actor,
      contract.state,
      ContractState.ACTIVE
    );

    return updated;
  }

  /**
   * Expires a contract
   */
  expire(contract: LearningContract, actor: string): LearningContract {
    this.validateTransition(contract, ContractState.EXPIRED);

    const updated = {
      ...contract,
      state: ContractState.EXPIRED,
    };

    this.auditLogger.logStateTransition(
      contract.contract_id,
      actor,
      ContractState.ACTIVE,
      ContractState.EXPIRED,
      { reason: 'Contract expiration time reached' }
    );

    return updated;
  }

  /**
   * Revokes a contract
   * Revocation does NOT delete audit traces
   */
  revoke(
    contract: LearningContract,
    actor: string,
    reason: string
  ): LearningContract {
    if (!contract.revocable) {
      throw new Error('Contract is not revocable');
    }

    this.validateTransition(contract, ContractState.REVOKED);

    const updated = {
      ...contract,
      state: ContractState.REVOKED,
    };

    this.auditLogger.logStateTransition(
      contract.contract_id,
      actor,
      ContractState.ACTIVE,
      ContractState.REVOKED,
      { reason }
    );

    return updated;
  }

  /**
   * Amends a contract (creates new version)
   * Returns both the amended original and the new draft
   */
  amend(
    contract: LearningContract,
    actor: string,
    changes: Partial<ContractDraft>,
    reason: string
  ): { original: LearningContract; newDraft: LearningContract } {
    this.validateTransition(contract, ContractState.AMENDED);

    // Mark original as amended
    const amended = {
      ...contract,
      state: ContractState.AMENDED,
    };

    this.auditLogger.logStateTransition(
      contract.contract_id,
      actor,
      ContractState.ACTIVE,
      ContractState.AMENDED,
      { reason }
    );

    // Create new draft with changes
    const newDraft = this.createDraft({
      created_by: actor,
      contract_type: changes.contract_type ?? contract.contract_type,
      scope: changes.scope ?? contract.scope,
      memory_permissions:
        changes.memory_permissions ?? contract.memory_permissions,
      generalization_rules:
        changes.generalization_rules ?? contract.generalization_rules,
      recall_rules: changes.recall_rules ?? contract.recall_rules,
      expiration: changes.expiration ?? contract.expiration,
      revocable: changes.revocable ?? contract.revocable,
    });

    // Link amendment to original
    newDraft.metadata = {
      ...newDraft.metadata,
      amended_from: contract.contract_id,
      amendment_reason: reason,
    };

    return { original: amended, newDraft };
  }

  /**
   * Checks if contract is expired
   */
  isExpired(contract: LearningContract): boolean {
    if (contract.state === ContractState.EXPIRED) {
      return true;
    }

    if (contract.expiration && contract.expiration < new Date()) {
      return true;
    }

    return false;
  }

  /**
   * Checks if contract is currently enforceable
   */
  isEnforceable(contract: LearningContract): boolean {
    return (
      contract.state === ContractState.ACTIVE &&
      !this.isExpired(contract)
    );
  }

  /**
   * Validates a state transition
   */
  private validateTransition(
    contract: LearningContract,
    toState: ContractState
  ): void {
    const validation = ContractValidator.validateTransition(
      contract.state,
      toState
    );

    if (!validation.valid) {
      throw new Error(
        `Invalid state transition: ${validation.errors.join(', ')}`
      );
    }
  }
}
