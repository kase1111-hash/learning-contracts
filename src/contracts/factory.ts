/**
 * Contract Factory
 *
 * Provides convenient methods for creating different types of contracts
 * with sensible defaults.
 */

import {
  ContractType,
  AbstractionLevel,
  RetentionDuration,
  BoundaryMode,
  LearningScope,
  MemoryPermissions,
  GeneralizationRules,
  RecallRules,
} from '../types';
import { ContractDraft } from './lifecycle';

export class ContractFactory {
  /**
   * Creates an Observation Contract
   * May observe signals, may NOT store memory, may NOT generalize
   */
  static createObservationContract(
    createdBy: string,
    scope: Partial<LearningScope> = {}
  ): ContractDraft {
    return {
      created_by: createdBy,
      contract_type: ContractType.OBSERVATION,
      scope: {
        domains: scope.domains ?? [],
        contexts: scope.contexts ?? [],
        tools: scope.tools ?? [],
        max_abstraction: AbstractionLevel.RAW,
        transferable: false,
      },
      memory_permissions: {
        may_store: false,
        classification_cap: 0,
        retention: RetentionDuration.SESSION,
      },
      generalization_rules: {
        allowed: false,
        conditions: [],
      },
      recall_rules: {
        requires_owner: true,
        boundary_mode_min: BoundaryMode.NORMAL,
      },
      revocable: true,
    };
  }

  /**
   * Creates an Episodic Learning Contract
   * May store specific episodes, no cross-context generalization
   */
  static createEpisodicContract(
    createdBy: string,
    scope: Partial<LearningScope> = {},
    options: {
      classificationCap?: number;
      retention?: RetentionDuration;
      retentionUntil?: Date;
    } = {}
  ): ContractDraft {
    const memoryPermissions: MemoryPermissions = {
      may_store: true,
      classification_cap: options.classificationCap ?? 3,
      retention: options.retention ?? RetentionDuration.TIMEBOUND,
    };

    if (options.retentionUntil) {
      memoryPermissions.retention_until = options.retentionUntil;
    }

    return {
      created_by: createdBy,
      contract_type: ContractType.EPISODIC,
      scope: {
        domains: scope.domains ?? [],
        contexts: scope.contexts ?? [],
        tools: scope.tools ?? [],
        max_abstraction: scope.max_abstraction ?? AbstractionLevel.RAW,
        transferable: false,
      },
      memory_permissions: memoryPermissions,
      generalization_rules: {
        allowed: false,
        conditions: [],
      },
      recall_rules: {
        requires_owner: true,
        boundary_mode_min: BoundaryMode.NORMAL,
      },
      revocable: true,
    };
  }

  /**
   * Creates a Procedural Learning Contract
   * May derive reusable heuristics, scope-limited
   */
  static createProceduralContract(
    createdBy: string,
    scope: Partial<LearningScope> = {},
    options: {
      classificationCap?: number;
      retention?: RetentionDuration;
      generalizationConditions?: string[];
    } = {}
  ): ContractDraft {
    return {
      created_by: createdBy,
      contract_type: ContractType.PROCEDURAL,
      scope: {
        domains: scope.domains ?? [],
        contexts: scope.contexts ?? [],
        tools: scope.tools ?? [],
        max_abstraction: scope.max_abstraction ?? AbstractionLevel.HEURISTIC,
        transferable: false,
      },
      memory_permissions: {
        may_store: true,
        classification_cap: options.classificationCap ?? 3,
        retention: options.retention ?? RetentionDuration.PERMANENT,
      },
      generalization_rules: {
        allowed: true,
        conditions: options.generalizationConditions ?? [
          'Within specified domains only',
          'No cross-context application',
        ],
      },
      recall_rules: {
        requires_owner: true,
        boundary_mode_min: BoundaryMode.NORMAL,
      },
      revocable: true,
    };
  }

  /**
   * Creates a Strategic Learning Contract
   * May infer long-term strategies, requires high-trust boundary mode
   */
  static createStrategicContract(
    createdBy: string,
    scope: Partial<LearningScope> = {},
    options: {
      classificationCap?: number;
      generalizationConditions?: string[];
    } = {}
  ): ContractDraft {
    return {
      created_by: createdBy,
      contract_type: ContractType.STRATEGIC,
      scope: {
        domains: scope.domains ?? [],
        contexts: scope.contexts ?? [],
        tools: scope.tools ?? [],
        max_abstraction: scope.max_abstraction ?? AbstractionLevel.STRATEGY,
        transferable: false,
      },
      memory_permissions: {
        may_store: true,
        classification_cap: options.classificationCap ?? 4,
        retention: RetentionDuration.PERMANENT,
      },
      generalization_rules: {
        allowed: true,
        conditions: options.generalizationConditions ?? [
          'High-confidence patterns only',
          'Within specified domains',
          'Reviewed by owner',
        ],
      },
      recall_rules: {
        requires_owner: true,
        boundary_mode_min: BoundaryMode.TRUSTED,
      },
      revocable: true,
    };
  }

  /**
   * Creates a Prohibited Domain Contract
   * Explicitly forbids learning, overrides all other contracts
   */
  static createProhibitedContract(
    createdBy: string,
    scope: Partial<LearningScope> = {}
  ): ContractDraft {
    return {
      created_by: createdBy,
      contract_type: ContractType.PROHIBITED,
      scope: {
        domains: scope.domains ?? [],
        contexts: scope.contexts ?? [],
        tools: scope.tools ?? [],
        max_abstraction: AbstractionLevel.RAW,
        transferable: false,
      },
      memory_permissions: {
        may_store: false,
        classification_cap: 0,
        retention: RetentionDuration.SESSION,
      },
      generalization_rules: {
        allowed: false,
        conditions: [],
      },
      recall_rules: {
        requires_owner: true,
        boundary_mode_min: BoundaryMode.RESTRICTED,
      },
      revocable: false, // Prohibited contracts cannot be revoked, only expire
    };
  }
}
