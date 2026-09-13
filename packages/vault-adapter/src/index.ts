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
  type MemoryObject,
  type AccessPolicy,
  type EncryptionProfile,
  type RecallRequest,
  type StoreResult,
  type RecallResult,
  type LockdownStatus,
  type BackupMetadata,
  type TombstoneInfo,
  type MemoryQuery,
  type IntegrityResult,
  type EnforcementCheckResult,
  type ContractEnforcedStoreOptions,
  type ContractEnforcedRecallOptions,
} from './types';

// Adapter interface and implementations
export {
  type MemoryVaultAdapter,
  BaseMemoryVaultAdapter,
  MockMemoryVaultAdapter,
  type VaultStoreOptions,
  type VaultRecallOptions,
  type VaultTombstoneOptions,
  type VaultBackupOptions,
  type VaultConnectionStatus,
} from './adapter';

// Contract-enforced vault
export {
  ContractEnforcedVault,
  type ContractEnforcedVaultConfig,
  type VaultContractResolver,
  type ContractFinder,
  type VaultAuditLogger,
  type VaultAuditEvent,
  type EnforcedOperationResult,
} from './enforced-vault';

// Security utilities
export {
  zeroMemory,
  securelyClearMemory,
  constantTimeCompare,
  withSecureMemory,
  createSecureCopy,
} from './security-utils';
