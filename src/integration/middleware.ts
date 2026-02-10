/**
 * Enforcement Middleware
 *
 * Framework-agnostic hook functions that can be wired into any
 * AI agent middleware pipeline (LangChain callbacks, custom pipelines, etc).
 *
 * These are plain functions that take context and return allow/deny decisions.
 * No framework dependency.
 */

import {
  BoundaryMode,
  AbstractionLevel,
  EnforcementResult,
} from '../types';
import { LearningContractsSystem } from '../system';

/**
 * Context for a memory operation being checked.
 */
export interface OperationContext {
  /** Domain of the operation */
  domain: string;
  /** Context of the operation */
  context?: string;
  /** Tool being used */
  tool?: string;
  /** Who is performing the operation */
  requester?: string;
  /** Current boundary mode (defaults to NORMAL) */
  boundaryMode?: BoundaryMode;
}

/**
 * Context for a store operation.
 */
export interface StoreContext extends OperationContext {
  /** Classification level of the data being stored */
  classification: number;
}

/**
 * Context for an abstraction operation.
 */
export interface AbstractionContext extends OperationContext {
  /** Target abstraction level */
  targetAbstraction: AbstractionLevel;
}

/**
 * Enforcement middleware hooks.
 * Wire these into your agent's pipeline to get automatic contract enforcement.
 */
export interface EnforcementMiddleware {
  /**
   * Check before storing a memory.
   * Returns the enforcement result including whether the operation is allowed.
   */
  beforeStore(contractId: string, context: StoreContext): EnforcementResult;

  /**
   * Check before recalling a memory.
   */
  beforeRecall(contractId: string, context: OperationContext): EnforcementResult;

  /**
   * Check before abstracting/generalizing from memories.
   */
  beforeAbstract(contractId: string, context: AbstractionContext): EnforcementResult;

  /**
   * Check before exporting/transferring memories.
   */
  beforeExport(contractId: string, boundaryMode?: BoundaryMode): EnforcementResult;

  /**
   * Find the applicable contract for a given scope.
   * Returns null if no contract applies (which means deny).
   */
  findContract(domain?: string, context?: string, tool?: string): string | null;

  /**
   * One-call check: finds the applicable contract for the scope
   * and returns the enforcement result. If no contract exists, returns deny.
   */
  checkOrDeny(context: StoreContext): EnforcementResult;
}

/**
 * Creates enforcement middleware hooks from a LearningContractsSystem.
 *
 * Usage:
 * ```typescript
 * const system = new LearningContractsSystem();
 * const middleware = createEnforcementMiddleware(system);
 *
 * // In your agent's pipeline:
 * const canStore = middleware.beforeStore(contractId, {
 *   domain: 'coding',
 *   classification: 2,
 * });
 * if (!canStore.allowed) {
 *   throw new Error(`Denied: ${canStore.reason}`);
 * }
 * ```
 */
export function createEnforcementMiddleware(
  system: LearningContractsSystem,
  defaultBoundaryMode: BoundaryMode = BoundaryMode.NORMAL
): EnforcementMiddleware {
  return {
    beforeStore(contractId: string, context: StoreContext): EnforcementResult {
      const mode = context.boundaryMode ?? defaultBoundaryMode;
      return system.checkMemoryCreation(contractId, mode, context.classification, {
        domain: context.domain,
        context: context.context,
        tool: context.tool,
      });
    },

    beforeRecall(contractId: string, context: OperationContext): EnforcementResult {
      const mode = context.boundaryMode ?? defaultBoundaryMode;
      return system.checkRecall(contractId, mode, {
        domain: context.domain,
        context: context.context,
        tool: context.tool,
        requester: context.requester,
      });
    },

    beforeAbstract(contractId: string, context: AbstractionContext): EnforcementResult {
      const mode = context.boundaryMode ?? defaultBoundaryMode;
      return system.checkAbstraction(contractId, mode, context.targetAbstraction, {
        domain: context.domain,
        context: context.context,
        tool: context.tool,
      });
    },

    beforeExport(contractId: string, boundaryMode?: BoundaryMode): EnforcementResult {
      const mode = boundaryMode ?? defaultBoundaryMode;
      return system.checkExport(contractId, mode);
    },

    findContract(domain?: string, context?: string, tool?: string): string | null {
      const contract = system.findApplicableContract(domain, context, tool);
      return contract?.contract_id ?? null;
    },

    checkOrDeny(context: StoreContext): EnforcementResult {
      const contract = system.findApplicableContract(
        context.domain,
        context.context,
        context.tool
      );

      if (!contract) {
        return {
          allowed: false,
          reason: 'No applicable contract found',
          contract_id: '',
        };
      }

      const mode = context.boundaryMode ?? defaultBoundaryMode;
      return system.checkMemoryCreation(
        contract.contract_id,
        mode,
        context.classification,
        {
          domain: context.domain,
          context: context.context,
          tool: context.tool,
        }
      );
    },
  };
}
