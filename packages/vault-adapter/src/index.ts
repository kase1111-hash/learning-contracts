/**
 * Memory Vault Integration
 *
 * Provides integration between Learning Contracts and Memory Vault.
 * Ensures all memory operations comply with active contracts.
 */

// Types
export {
  ClassificationLevel,
  KeySource,
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
} from './types';

// Adapter interface and implementations
export {
  MemoryVaultAdapter,
  BaseMemoryVaultAdapter,
  MockMemoryVaultAdapter,
  VaultStoreOptions,
  VaultRecallOptions,
  VaultTombstoneOptions,
  VaultBackupOptions,
  VaultConnectionStatus,
} from './adapter';

// Contract-enforced vault
export {
  ContractEnforcedVault,
  ContractEnforcedVaultConfig,
  VaultContractResolver,
  ContractFinder,
  VaultAuditLogger,
  VaultAuditEvent,
  EnforcedOperationResult,
} from './enforced-vault';

// Security utilities
export {
  zeroMemory,
  securelyClearMemory,
  constantTimeCompare,
  withSecureMemory,
  createSecureCopy,
} from './security-utils';
