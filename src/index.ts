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
export {
  ContractRepository,
  MemoryStorageAdapter,
  FileStorageAdapter,
  serializeContract,
  deserializeContract,
} from './storage';

export type {
  ContractQueryOptions,
  ContractRepositoryConfig,
  StorageAdapter,
  SerializedContract,
  FileStorageConfig,
} from './storage';

// Memory
export {
  MemoryForgetting,
  MemoryReference,
  MemoryStatus,
  ForgettingResult,
  generatePurgeToken,
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

// Memory Vault Integration
export {
  // Types
  ClassificationLevel,
  KeySource,
  // Adapter
  MockMemoryVaultAdapter,
  // Contract-enforced vault
  ContractEnforcedVault,
} from './vault-integration';

export type {
  // Types
  MemoryObject,
  AccessPolicy,
  EncryptionProfile,
  RecallRequest,
  StoreResult,
  RecallResult,
  LockdownStatus,
  BackupMetadata,
  TombstoneInfo,
  MemoryQuery,
  IntegrityResult,
  EnforcementCheckResult,
  ContractEnforcedStoreOptions,
  ContractEnforcedRecallOptions,
  // Adapter
  MemoryVaultAdapter,
  VaultStoreOptions,
  VaultRecallOptions,
  VaultTombstoneOptions,
  VaultBackupOptions,
  VaultConnectionStatus,
  // Contract-enforced vault
  ContractEnforcedVaultConfig,
  ContractResolver,
  ContractFinder,
  VaultAuditEvent,
  EnforcedOperationResult,
  AuditLogger as VaultAuditLogger,
} from './vault-integration';

// Boundary Daemon Integration
export {
  // Types
  DaemonBoundaryMode,
  NetworkStatus,
  TripwireType,
  BOUNDARY_CLASSIFICATION_CAPS,
  BOUNDARY_NETWORK_STATUS,
  // Adapter
  MockBoundaryDaemonAdapter,
  // Boundary-enforced system
  BoundaryEnforcedSystem,
} from './boundary-integration';

export type {
  // Types
  TripwireEvent,
  RecallGateRequest,
  RecallGateResult,
  ToolGateRequest,
  ToolGateResult,
  BoundaryStatus,
  ModeTransitionRequest,
  ModeTransitionResult,
  OverrideCeremonyRequest,
  OverrideCeremonyResult,
  BoundaryAuditEntry,
  AuditVerificationResult,
  ContractSuspensionEvent,
  ContractResumeEvent,
  BoundaryEnforcedOptions,
  // Adapter
  BoundaryDaemonAdapter,
  DaemonConnectionStatus,
  ModeChangeListener,
  TripwireListener,
  // Boundary-enforced system
  BoundaryEnforcedSystemConfig,
  ActiveContractsProvider,
  SuspensionListener,
  ResumeListener,
  BoundaryAuditLogger,
  BoundaryAuditEvent,
  ContractResolver as BoundaryContractResolver,
} from './boundary-integration';

// Session Management
export {
  SessionManager,
  SessionStatus,
} from './session';

export type {
  Session,
  SessionEndResult,
  SessionCleanupOptions,
  SessionEndListener,
  SessionManagerConfig,
  SessionContractResolver,
  SessionContractExpirer,
  SessionMemoryFreezer,
} from './session';

// Timebound Expiry
export { TimeboundExpiryManager } from './expiry';

export type {
  ExpiryCheckResult,
  ExpiryCycleResult,
  ExpiryListener,
  CycleCompletionListener,
  ExpiryContractResolver,
  ExpiryContractExpirer,
  TimeboundExpiredFinder,
  ExpiryMemoryFreezer,
  ContractMemoryProvider,
  TimeboundExpiryManagerConfig,
  ExpiryManagerStats,
} from './expiry';

// Emergency Override
export { EmergencyOverrideManager } from './emergency-override';

export type {
  EmergencyOverrideConfig,
  EmergencyOverrideStatus,
  OverrideTriggerEvent,
  OverrideDisableEvent,
  OverrideTriggerResult,
  OverrideDisableResult,
  OverrideTriggerListener,
  OverrideDisableListener,
  BlockedOperationListener,
} from './emergency-override';

// Multi-User Support
export { UserManager, PermissionManager } from './user-management';

export {
  PermissionLevel,
  UserStatus,
} from './user-management';

export type {
  User,
  UserConnection,
  ConnectionResult,
  DisconnectionResult,
  ContractPermission,
  PermissionCheckResult,
  GrantPermissionOptions,
  UserConnectEvent,
  UserDisconnectEvent,
  ConnectionRejectedEvent,
  UserConnectListener,
  UserDisconnectListener,
  ConnectionRejectedListener,
  UserManagerConfig,
  UserAuditLogger,
  UserManagerStats,
} from './user-management';

// Agent-OS Integration
export {
  // Types
  AuthorityTier,
  AgentOSAgentType,
  AgentOSMemoryClass,
  KernelEventType,
  MEMORY_CLASS_TO_CLASSIFICATION,
  MEMORY_CLASS_TO_CONTRACT_TYPE,
  DEFAULT_AGENT_OS_CONFIG,
  // Memory Adapter
  AgentOSMemoryAdapter,
  MockAgentOSMemoryClient,
  // Boundary Adapter
  AgentOSBoundaryAdapter,
  MockAgentOSBoundaryClient,
  // Kernel Hooks
  AgentOSKernelHooks,
  MockAgentOSKernelClient,
  createKernelRules,
  createKernelPolicies,
  // Consent Bridge
  AgentOSConsentBridge,
  // Python Interop
  MockInteropTransport,
  HttpInteropTransport,
  AgentOSPythonClient,
  generatePythonClientCode,
  generateAgentOSIntegrationModule,
} from './agent-os-integration';

export type {
  // Types
  KernelEvent,
  AgentOSConsentRequest,
  AgentOSConsentResponse,
  AgentOSMemoryOperation,
  AgentOSBoundaryStatus,
  AgentOSIntegrationConfig,
  AgentOSHookRegistration,
  AgentOSHookResult,
  ContractAgentOSMapping,
  AgentOSInteropMessage,
  AgentOSInteropRequest,
  AgentOSInteropResponse,
  ConsentAlignmentResult,
  AgentOSIntegrationStatus,
  // Memory Adapter
  AgentOSMemoryClient,
  // Boundary Adapter
  AgentOSBoundaryClient,
  // Kernel Hooks
  AgentOSKernelClient,
  KernelHookHandler,
  // Consent Bridge
  ConsentBridgeConfig,
  ConsentRecord,
  // Python Interop
  InteropTransport,
} from './agent-os-integration';

// Error Handling
export {
  LearningContractsError,
  ContractError,
  EnforcementError,
  SecurityError,
  StorageError,
  NetworkError,
  IntegrationError,
  AuthError,
  ErrorSeverity,
  ErrorCategory,
  ErrorCode,
  CentralErrorHandler,
  getDefaultErrorHandler,
  setDefaultErrorHandler,
} from './errors';

export type {
  ErrorContext,
  ErrorEvent,
  ErrorHandler,
  RecoveryStrategy,
  ErrorHandlerConfig,
  ErrorStats,
} from './errors';

// Boundary-SIEM Integration
export { SIEMReporter } from './siem-integration';

export {
  SIEMEventType,
  CEF_SEVERITY_MAP,
} from './siem-integration';

export type {
  SIEMConfig,
  SIEMEvent,
  SIEMResponse,
  SIEMHealthStatus,
  ContractEvent as SIEMContractEvent,
  EnforcementEvent as SIEMEnforcementEvent,
  SecurityViolationEvent,
  ConnectionEvent,
  AuditLogEntry,
  EventConverter,
} from './siem-integration';

// Boundary Daemon Connector
export {
  DaemonConnector,
  MockDaemonConnector,
} from './daemon-connector';

export {
  DaemonBoundaryMode as RealDaemonBoundaryMode,
  DaemonClassificationLevel,
  PolicyOperation,
  DaemonCommand,
  CLASSIFICATION_CAPS,
} from './daemon-connector';

export type {
  DaemonConfig,
  PolicyDecision,
  PolicyRequest,
  DaemonStatus,
  ModeChangeEvent as DaemonModeChangeEvent,
  TripwireEvent as DaemonTripwireEvent,
  AttestationRequest,
  AttestationResponse,
  DaemonEventHandlers,
  DaemonResponse,
  ConnectionProtection,
} from './daemon-connector';
