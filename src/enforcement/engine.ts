/**
 * Enforcement Engine
 *
 * Enforces Learning Contracts at four mandatory hooks:
 * 1. Before Memory Creation – permission check
 * 2. During Abstraction – generalization gate
 * 3. Before Recall – scope revalidation
 * 4. During Export – transfer prohibition
 *
 * Violation results in hard failure, not warning.
 */

import {
  ContractType,
  ContractState,
  EnforcementContext,
  EnforcementResult,
  AbstractionLevel,
  BoundaryMode,
} from '../types';
import { ContractLifecycleManager } from '../contracts/lifecycle';
import { AuditLogger } from '../audit/logger';

export class EnforcementEngine {
  constructor(
    private lifecycleManager: ContractLifecycleManager,
    private auditLogger: AuditLogger
  ) {}

  /**
   * Hook 1: Before Memory Creation
   * Checks if memory storage is permitted under the contract
   */
  checkMemoryCreation(
    context: EnforcementContext,
    classification: number
  ): EnforcementResult {
    const contract = context.contract;

    // Contract must be active and not expired
    if (!this.lifecycleManager.isEnforceable(contract)) {
      const result = this.deny(
        contract.contract_id,
        'Contract is not active or has expired'
      );
      this.auditLogger.logEnforcementCheck('memory_creation', context, result);
      return result;
    }

    // Prohibited contracts forbid all memory creation
    if (contract.contract_type === ContractType.PROHIBITED) {
      const result = this.deny(
        contract.contract_id,
        'Prohibited contract forbids memory creation'
      );
      this.auditLogger.logEnforcementCheck('memory_creation', context, result);
      return result;
    }

    // Check if memory storage is allowed
    if (!contract.memory_permissions.may_store) {
      const result = this.deny(
        contract.contract_id,
        'Contract does not permit memory storage'
      );
      this.auditLogger.logEnforcementCheck('memory_creation', context, result);
      return result;
    }

    // Check classification cap
    if (classification > contract.memory_permissions.classification_cap) {
      const result = this.deny(
        contract.contract_id,
        `Classification level ${classification} exceeds cap of ${contract.memory_permissions.classification_cap}`
      );
      this.auditLogger.logEnforcementCheck('memory_creation', context, result);
      return result;
    }

    // Check scope
    const scopeCheck = this.checkScope(context);
    if (!scopeCheck.allowed) {
      this.auditLogger.logEnforcementCheck('memory_creation', context, scopeCheck);
      return scopeCheck;
    }

    const result = this.allow(contract.contract_id);
    this.auditLogger.logEnforcementCheck('memory_creation', context, result);
    return result;
  }

  /**
   * Hook 2: During Abstraction (Generalization Gate)
   * Checks if generalization/abstraction is permitted
   */
  checkAbstraction(
    context: EnforcementContext,
    targetAbstraction: AbstractionLevel
  ): EnforcementResult {
    const contract = context.contract;

    // Contract must be active and not expired
    if (!this.lifecycleManager.isEnforceable(contract)) {
      const result = this.deny(
        contract.contract_id,
        'Contract is not active or has expired'
      );
      this.auditLogger.logEnforcementCheck('abstraction', context, result);
      return result;
    }

    // Prohibited contracts forbid all abstraction
    if (contract.contract_type === ContractType.PROHIBITED) {
      const result = this.deny(
        contract.contract_id,
        'Prohibited contract forbids abstraction'
      );
      this.auditLogger.logEnforcementCheck('abstraction', context, result);
      return result;
    }

    // Check if generalization is allowed
    if (!contract.generalization_rules.allowed) {
      const result = this.deny(
        contract.contract_id,
        'Contract does not permit generalization'
      );
      this.auditLogger.logEnforcementCheck('abstraction', context, result);
      return result;
    }

    // Check abstraction level cap
    if (!this.isAbstractionAllowed(targetAbstraction, contract.scope.max_abstraction)) {
      const result = this.deny(
        contract.contract_id,
        `Abstraction level ${targetAbstraction} exceeds maximum of ${contract.scope.max_abstraction}`
      );
      this.auditLogger.logEnforcementCheck('abstraction', context, result);
      return result;
    }

    // Check scope
    const scopeCheck = this.checkScope(context);
    if (!scopeCheck.allowed) {
      this.auditLogger.logEnforcementCheck('abstraction', context, scopeCheck);
      return scopeCheck;
    }

    const result = this.allow(contract.contract_id);
    this.auditLogger.logEnforcementCheck('abstraction', context, result);
    return result;
  }

  /**
   * Hook 3: Before Recall (Scope Revalidation)
   * Checks if memory recall is permitted
   */
  checkRecall(context: EnforcementContext): EnforcementResult {
    const contract = context.contract;

    // Contract must be active (expired contracts freeze memory)
    if (contract.state === ContractState.EXPIRED) {
      const result = this.deny(
        contract.contract_id,
        'Contract has expired - memory is frozen'
      );
      this.auditLogger.logEnforcementCheck('recall', context, result);
      return result;
    }

    // Revoked contracts tombstone memory
    if (contract.state === ContractState.REVOKED) {
      const result = this.deny(
        contract.contract_id,
        'Contract has been revoked - memory is tombstoned'
      );
      this.auditLogger.logEnforcementCheck('recall', context, result);
      return result;
    }

    // Check boundary mode requirement
    if (!this.isBoundaryModeSufficient(
      context.boundary_mode,
      contract.recall_rules.boundary_mode_min
    )) {
      const result = this.deny(
        contract.contract_id,
        `Boundary mode ${context.boundary_mode} does not meet minimum of ${contract.recall_rules.boundary_mode_min}`
      );
      this.auditLogger.logEnforcementCheck('recall', context, result);
      return result;
    }

    // Check scope
    const scopeCheck = this.checkScope(context);
    if (!scopeCheck.allowed) {
      this.auditLogger.logEnforcementCheck('recall', context, scopeCheck);
      return scopeCheck;
    }

    const result = this.allow(contract.contract_id);
    this.auditLogger.logEnforcementCheck('recall', context, result);
    return result;
  }

  /**
   * Hook 4: During Export (Transfer Prohibition)
   * Checks if memory can be transferred/exported
   */
  checkExport(context: EnforcementContext): EnforcementResult {
    const contract = context.contract;

    // Contract must be active and not expired
    if (!this.lifecycleManager.isEnforceable(contract)) {
      const result = this.deny(
        contract.contract_id,
        'Contract is not active or has expired'
      );
      this.auditLogger.logEnforcementCheck('export', context, result);
      return result;
    }

    // Check transferability
    if (!contract.scope.transferable) {
      const result = this.deny(
        contract.contract_id,
        'Contract prohibits memory transfer'
      );
      this.auditLogger.logEnforcementCheck('export', context, result);
      return result;
    }

    const result = this.allow(contract.contract_id);
    this.auditLogger.logEnforcementCheck('export', context, result);
    return result;
  }

  /**
   * Checks if operation scope matches contract scope
   * Unspecified dimensions default to deny
   */
  private checkScope(context: EnforcementContext): EnforcementResult {
    const scope = context.contract.scope;

    // Check domain (if specified in context)
    if (context.domain) {
      if (scope.domains.length > 0 && !scope.domains.includes(context.domain)) {
        return this.deny(
          context.contract.contract_id,
          `Domain '${context.domain}' not in contract scope`
        );
      }
    }

    // Check context (if specified)
    if (context.context) {
      if (scope.contexts.length > 0 && !scope.contexts.includes(context.context)) {
        return this.deny(
          context.contract.contract_id,
          `Context '${context.context}' not in contract scope`
        );
      }
    }

    // Check tool (if specified)
    if (context.tool) {
      if (scope.tools.length > 0 && !scope.tools.includes(context.tool)) {
        return this.deny(
          context.contract.contract_id,
          `Tool '${context.tool}' not in contract scope`
        );
      }
    }

    // If all scope arrays are empty and we have context/domain/tool specified,
    // deny (fail-closed)
    if (
      (context.domain || context.context || context.tool) &&
      scope.domains.length === 0 &&
      scope.contexts.length === 0 &&
      scope.tools.length === 0
    ) {
      return this.deny(
        context.contract.contract_id,
        'Contract scope is empty - denying by default'
      );
    }

    return this.allow(context.contract.contract_id);
  }

  /**
   * Checks if abstraction level is within allowed maximum
   */
  private isAbstractionAllowed(
    target: AbstractionLevel,
    max: AbstractionLevel
  ): boolean {
    const levels = [
      AbstractionLevel.RAW,
      AbstractionLevel.PATTERN,
      AbstractionLevel.HEURISTIC,
      AbstractionLevel.STRATEGY,
    ];

    const targetIndex = levels.indexOf(target);
    const maxIndex = levels.indexOf(max);

    return targetIndex <= maxIndex;
  }

  /**
   * Checks if current boundary mode meets minimum requirement
   */
  private isBoundaryModeSufficient(
    current: BoundaryMode,
    minimum: BoundaryMode
  ): boolean {
    const modes = [
      BoundaryMode.RESTRICTED,
      BoundaryMode.NORMAL,
      BoundaryMode.TRUSTED,
      BoundaryMode.PRIVILEGED,
    ];

    const currentIndex = modes.indexOf(current);
    const minimumIndex = modes.indexOf(minimum);

    return currentIndex >= minimumIndex;
  }

  /**
   * Helper to create allow result
   */
  private allow(contractId: string): EnforcementResult {
    return {
      allowed: true,
      contract_id: contractId,
    };
  }

  /**
   * Helper to create deny result
   */
  private deny(contractId: string, reason: string): EnforcementResult {
    return {
      allowed: false,
      reason,
      contract_id: contractId,
    };
  }
}
