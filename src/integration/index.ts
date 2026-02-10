/**
 * Integration Module
 *
 * Clean integration surface for AI agent developers.
 * Import from 'learning-contracts/integration' or from the main package.
 */

export {
  ContractGovernedStore,
  InMemoryStore,
} from './memory-store';
export type {
  MemoryStore,
  MemoryInput,
  StoredMemory,
  RecallQuery,
  GovernedResult,
} from './memory-store';

export {
  createEnforcementMiddleware,
} from './middleware';
export type {
  EnforcementMiddleware,
  OperationContext,
  StoreContext,
  AbstractionContext,
} from './middleware';
