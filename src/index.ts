/**
 * Learning Contracts
 *
 * Explicit, enforceable agreements governing what a learning co-worker/assistant
 * is allowed to learn, how it may generalize that learning, how long it may
 * retain it, and under what conditions it may be recalled or revoked.
 *
 * @packageDocumentation
 */

// Main system
export { LearningContractsSystem } from './system';

// Types
export * from './types';

// Contract management
export { ContractLifecycleManager, ContractDraft } from './contracts/lifecycle';
export { ContractFactory } from './contracts/factory';
export { ContractValidator } from './contracts/validator';

// Enforcement
export { EnforcementEngine } from './enforcement/engine';

// Audit
export { AuditLogger } from './audit/logger';

// Storage
export { ContractRepository, ContractQueryOptions } from './storage/repository';

// Memory
export {
  MemoryForgetting,
  MemoryReference,
  MemoryStatus,
  ForgettingResult,
} from './memory/forgetting';

// Plain-Language Interface
export {
  PlainLanguageParser,
  PlainLanguageSummarizer,
  ConversationalContractBuilder,
  CONTRACT_TEMPLATES,
  getTemplateById,
  getTemplatesByType,
  searchTemplates,
} from './plain-language';

export type {
  ParsedIntent,
  ParseResult,
  ConversationState,
  ConversationStep,
  ConversationQuestion,
  ConversationAnswer,
  ContractDraftFromLanguage,
  ContractTemplate,
  SummaryOptions,
  BuilderResponse,
} from './plain-language';
