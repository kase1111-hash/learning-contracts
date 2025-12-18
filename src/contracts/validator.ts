/**
 * Contract Validator
 *
 * Validates contract structure and rules according to specification.
 */

import {
  LearningContract,
  ContractType,
  ContractState,
  AbstractionLevel,
  ValidationResult,
  BoundaryMode,
} from '../types';

export class ContractValidator {
  /**
   * Validates a complete contract
   */
  static validate(contract: LearningContract): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate contract ID
    if (!contract.contract_id || contract.contract_id.trim() === '') {
      errors.push('Contract ID is required');
    }

    // Validate creator
    if (!contract.created_by || contract.created_by.trim() === '') {
      errors.push('Creator (created_by) is required');
    }

    // Validate contract type
    if (!Object.values(ContractType).includes(contract.contract_type)) {
      errors.push(`Invalid contract type: ${contract.contract_type}`);
    }

    // Validate type-specific rules
    this.validateTypeSpecificRules(contract, errors, warnings);

    // Validate scope
    this.validateScope(contract, errors, warnings);

    // Validate memory permissions
    this.validateMemoryPermissions(contract, errors, warnings);

    // Validate generalization rules
    this.validateGeneralizationRules(contract, errors, warnings);

    // Validate recall rules
    this.validateRecallRules(contract, errors, warnings);

    // Validate expiration
    if (contract.expiration && contract.expiration < contract.created_at) {
      errors.push('Expiration date cannot be before creation date');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates type-specific contract rules
   */
  private static validateTypeSpecificRules(
    contract: LearningContract,
    errors: string[],
    warnings: string[]
  ): void {
    switch (contract.contract_type) {
      case ContractType.OBSERVATION:
        // Observation contracts may NOT store memory
        if (contract.memory_permissions.may_store) {
          errors.push('Observation contracts must not allow memory storage');
        }
        // May NOT generalize
        if (contract.generalization_rules.allowed) {
          errors.push('Observation contracts must not allow generalization');
        }
        break;

      case ContractType.EPISODIC:
        // No cross-context generalization
        if (contract.generalization_rules.allowed) {
          errors.push('Episodic contracts must not allow generalization');
        }
        break;

      case ContractType.PROCEDURAL:
        // Scope-limited generalization
        if (
          contract.generalization_rules.allowed &&
          contract.scope.max_abstraction !== AbstractionLevel.HEURISTIC &&
          contract.scope.max_abstraction !== AbstractionLevel.PATTERN
        ) {
          warnings.push(
            'Procedural contracts should limit abstraction to pattern or heuristic'
          );
        }
        break;

      case ContractType.STRATEGIC:
        // Requires high-trust boundary mode
        if (
          contract.recall_rules.boundary_mode_min !== BoundaryMode.TRUSTED &&
          contract.recall_rules.boundary_mode_min !== BoundaryMode.PRIVILEGED
        ) {
          errors.push('Strategic contracts require trusted or privileged boundary mode');
        }
        break;

      case ContractType.PROHIBITED:
        // Explicitly forbids all learning
        if (contract.memory_permissions.may_store) {
          errors.push('Prohibited contracts must not allow memory storage');
        }
        if (contract.generalization_rules.allowed) {
          errors.push('Prohibited contracts must not allow generalization');
        }
        break;
    }
  }

  /**
   * Validates learning scope
   */
  private static validateScope(
    contract: LearningContract,
    errors: string[],
    warnings: string[]
  ): void {
    // Domains: empty array is valid (deny-by-default)
    if (!Array.isArray(contract.scope.domains)) {
      errors.push('Scope domains must be an array');
    }

    // Contexts
    if (!Array.isArray(contract.scope.contexts)) {
      errors.push('Scope contexts must be an array');
    }

    // Tools
    if (!Array.isArray(contract.scope.tools)) {
      errors.push('Scope tools must be an array');
    }

    // Max abstraction
    if (!Object.values(AbstractionLevel).includes(contract.scope.max_abstraction)) {
      errors.push(`Invalid abstraction level: ${contract.scope.max_abstraction}`);
    }

    // Warn on empty scopes (deny-by-default is good, but might be unintentional)
    if (
      contract.scope.domains.length === 0 &&
      contract.scope.contexts.length === 0 &&
      contract.scope.tools.length === 0
    ) {
      warnings.push(
        'All scope dimensions are empty - contract will deny all operations'
      );
    }
  }

  /**
   * Validates memory permissions
   */
  private static validateMemoryPermissions(
    contract: LearningContract,
    errors: string[],
    warnings: string[]
  ): void {
    // Classification cap must be 0-5
    if (
      contract.memory_permissions.classification_cap < 0 ||
      contract.memory_permissions.classification_cap > 5
    ) {
      errors.push('Classification cap must be between 0 and 5');
    }

    // Timebound retention requires retention_until
    if (
      contract.memory_permissions.retention === 'timebound' &&
      !contract.memory_permissions.retention_until
    ) {
      errors.push('Timebound retention requires retention_until timestamp');
    }

    // Warn if retention_until is in the past
    if (
      contract.memory_permissions.retention_until &&
      contract.memory_permissions.retention_until < new Date()
    ) {
      warnings.push('Retention timestamp is in the past');
    }
  }

  /**
   * Validates generalization rules
   */
  private static validateGeneralizationRules(
    contract: LearningContract,
    errors: string[],
    warnings: string[]
  ): void {
    if (
      contract.generalization_rules.allowed &&
      (!contract.generalization_rules.conditions ||
        contract.generalization_rules.conditions.length === 0)
    ) {
      warnings.push('Generalization is allowed but no conditions are specified');
    }
  }

  /**
   * Validates recall rules
   */
  private static validateRecallRules(
    contract: LearningContract,
    errors: string[],
    warnings: string[]
  ): void {
    if (!Object.values(BoundaryMode).includes(contract.recall_rules.boundary_mode_min)) {
      errors.push(
        `Invalid boundary mode: ${contract.recall_rules.boundary_mode_min}`
      );
    }
  }

  /**
   * Validates state transition
   */
  static validateTransition(
    from: ContractState,
    to: ContractState
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validTransitions: Record<ContractState, ContractState[]> = {
      [ContractState.DRAFT]: [ContractState.REVIEW],
      [ContractState.REVIEW]: [ContractState.ACTIVE, ContractState.DRAFT],
      [ContractState.ACTIVE]: [
        ContractState.EXPIRED,
        ContractState.REVOKED,
        ContractState.AMENDED,
      ],
      [ContractState.EXPIRED]: [],
      [ContractState.REVOKED]: [],
      [ContractState.AMENDED]: [ContractState.REVIEW],
    };

    if (!validTransitions[from].includes(to)) {
      errors.push(`Invalid transition from ${from} to ${to}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
