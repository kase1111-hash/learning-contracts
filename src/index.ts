/**
 * Learning Contracts
 *
 * Explicit, enforceable agreements governing what a learning co-worker/assistant
 * is allowed to learn, how it may generalize that learning, how long it may
 * retain it, and under what conditions it may be recalled or revoked.
 *
 * Mock adapters for testing are available via the testing subpath:
 *   import { MockMemoryVaultAdapter, MockBoundaryDaemonAdapter } from 'learning-contracts/testing';
 *
 * @packageDocumentation
 */

// ==========================================
// 1. CORE — System, types, contracts, enforcement, audit, storage, memory
// ==========================================

export { LearningContractsSystem } from './system';
export * from './types';
export { ContractLifecycleManager, ContractDraft } from './contracts/lifecycle';
export { ContractFactory } from './contracts/factory';
export { ContractValidator } from './contracts/validator';
export { EnforcementEngine } from './enforcement/engine';
export { AuditLogger } from './audit/logger';

export {
  ContractRepository, MemoryStorageAdapter, FileStorageAdapter,
  serializeContract, deserializeContract,
} from './storage';
export type {
  ContractQueryOptions, ContractRepositoryConfig, StorageAdapter,
  SerializedContract, FileStorageConfig,
} from './storage';

export {
  MemoryForgetting, MemoryReference, MemoryStatus,
  ForgettingResult, generatePurgeToken,
} from './memory/forgetting';

// ==========================================
// 2. EXTENSIONS — Session, expiry, emergency override, multi-user
// ==========================================

export { SessionManager, SessionStatus } from './session';
export type {
  Session, SessionEndResult, SessionCleanupOptions, SessionEndListener,
  SessionManagerConfig, SessionContractResolver, SessionContractExpirer, SessionMemoryFreezer,
} from './session';

export { TimeboundExpiryManager } from './expiry';
export type {
  ExpiryCheckResult, ExpiryCycleResult, ExpiryListener, CycleCompletionListener,
  ExpiryContractResolver, ExpiryContractExpirer, TimeboundExpiredFinder,
  ExpiryMemoryFreezer, ContractMemoryProvider, TimeboundExpiryManagerConfig, ExpiryManagerStats,
} from './expiry';

export { EmergencyOverrideManager } from './emergency-override';
export type {
  EmergencyOverrideConfig, EmergencyOverrideStatus,
  OverrideTriggerEvent, OverrideDisableEvent, OverrideTriggerResult, OverrideDisableResult,
  OverrideTriggerListener, OverrideDisableListener, BlockedOperationListener,
} from './emergency-override';

export { UserManager, PermissionManager, PermissionLevel, UserStatus } from './user-management';
export type {
  User, UserConnection, ConnectionResult, DisconnectionResult,
  ContractPermission, PermissionCheckResult, GrantPermissionOptions,
  UserConnectEvent, UserDisconnectEvent, ConnectionRejectedEvent,
  UserConnectListener, UserDisconnectListener, ConnectionRejectedListener,
  UserManagerConfig, UserAuditLogger, UserManagerStats,
} from './user-management';

// ==========================================
// 3. PLAIN LANGUAGE — Parser, summarizer, builder, templates
// ==========================================

export {
  PlainLanguageParser, PlainLanguageSummarizer, ConversationalContractBuilder,
  CONTRACT_TEMPLATES, getTemplateById, getTemplatesByType, searchTemplates,
} from './plain-language';
export type {
  ParsedIntent, ParseResult, ConversationState, ConversationStep,
  ConversationQuestion, ConversationAnswer, ContractDraftFromLanguage,
  ContractTemplate, SummaryOptions, BuilderResponse,
} from './plain-language';

// ==========================================
// 4. INTEGRATIONS — Vault, boundary
// ==========================================

export { ClassificationLevel, KeySource, ContractEnforcedVault } from './vault-integration';
export type {
  MemoryObject, AccessPolicy, EncryptionProfile, RecallRequest,
  StoreResult, RecallResult, LockdownStatus, BackupMetadata, TombstoneInfo,
  MemoryQuery, IntegrityResult, EnforcementCheckResult,
  ContractEnforcedStoreOptions, ContractEnforcedRecallOptions,
  MemoryVaultAdapter, VaultStoreOptions, VaultRecallOptions, VaultTombstoneOptions,
  VaultBackupOptions, VaultConnectionStatus,
  ContractEnforcedVaultConfig, VaultContractResolver, ContractFinder,
  VaultAuditLogger, VaultAuditEvent, EnforcedOperationResult,
} from './vault-integration';

export {
  DaemonBoundaryMode, NetworkStatus, TripwireType,
  BOUNDARY_CLASSIFICATION_CAPS, BOUNDARY_NETWORK_STATUS,
  BoundaryEnforcedSystem,
} from './boundary-integration';
export type {
  TripwireEvent, RecallGateRequest, RecallGateResult,
  ToolGateRequest, ToolGateResult, BoundaryStatus,
  ModeTransitionRequest, ModeTransitionResult,
  OverrideCeremonyRequest, OverrideCeremonyResult,
  BoundaryAuditEntry, AuditVerificationResult,
  ContractSuspensionEvent, ContractResumeEvent, BoundaryEnforcedOptions,
  BoundaryDaemonAdapter, DaemonConnectionStatus, ModeChangeListener, TripwireListener,
  BoundaryEnforcedSystemConfig, ActiveContractsProvider,
  SuspensionListener, ResumeListener, BoundaryAuditLogger, BoundaryAuditEvent,
  BoundaryContractResolver,
} from './boundary-integration';

// ==========================================
// 5. ERRORS
// ==========================================

export {
  LearningContractsError, ContractError, EnforcementError, SecurityError,
  StorageError, NetworkError, IntegrationError, AuthError,
  ErrorSeverity, ErrorCategory, ErrorCode,
  CentralErrorHandler, getDefaultErrorHandler, setDefaultErrorHandler,
} from './errors';
export type {
  ErrorContext, ErrorEvent, ErrorHandler,
  RecoveryStrategy, ErrorHandlerConfig, ErrorStats,
} from './errors';

// ==========================================
// 6. TESTING — Re-exported for backward compatibility
//    Prefer: import { ... } from 'learning-contracts/testing'
// ==========================================

export { MockMemoryVaultAdapter } from './vault-integration';
export { MockBoundaryDaemonAdapter } from './boundary-integration';
