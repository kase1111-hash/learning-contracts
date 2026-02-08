/**
 * Memory Vault Integration Types
 *
 * TypeScript type definitions matching the memory-vault Python package.
 * These types enable type-safe integration between Learning Contracts
 * and the Memory Vault storage system.
 */

/**
 * Classification levels for memories (0-5)
 * Higher levels require stronger security controls
 */
export enum ClassificationLevel {
  /** Ephemeral - auto-purged, no approval needed */
  EPHEMERAL = 0,
  /** Low - standard encryption, logged access */
  LOW = 1,
  /** Medium - requires justification */
  MEDIUM = 2,
  /** High - requires human approval */
  HIGH = 3,
  /** Critical - requires cooldown + approval */
  CRITICAL = 4,
  /** Maximum - requires physical token */
  MAXIMUM = 5,
}

/**
 * Key source options for encryption profiles
 */
export enum KeySource {
  HUMAN_PASSPHRASE = 'HumanPassphrase',
  FILE = 'File',
  TPM = 'TPM',
}

/**
 * Memory object - the core storage unit
 */
export interface MemoryObject {
  /** Unique memory identifier (UUID) */
  memory_id: string;
  /** Creation timestamp */
  created_at: Date;
  /** Origin identifier ("agent" or "human") */
  created_by: string;
  /** Classification level (0-5) */
  classification: ClassificationLevel;
  /** Encryption profile reference */
  encryption_profile: string;
  /**
   * Plaintext content (in-memory only, never persisted)
   * SECURITY: Should be cleared using securelyClearMemory() or zeroMemory()
   * after use to prevent sensitive data from lingering in memory.
   * @see securelyClearMemory
   */
  content_plaintext?: Uint8Array;
  /** Content verification hash */
  content_hash: string;
  /** Related intent reference */
  intent_ref?: string;
  /** Custom metadata */
  value_metadata: Record<string, unknown>;
  /** Access policy settings */
  access_policy: AccessPolicy;
  /** Merkle tree audit proof reference */
  audit_proof?: string;

  // Learning Contract extension fields
  /** Associated learning contract ID */
  contract_id?: string;
  /** Domain this memory belongs to */
  domain?: string;
  /** Context this memory was created in */
  context?: string;
  /** Tool used to create this memory */
  tool?: string;
  /** Whether this memory is derived from others */
  is_derived?: boolean;
  /** Source memory IDs if derived */
  derived_from?: string[];
}

/**
 * Access policy for a memory
 */
export interface AccessPolicy {
  /** Cooldown period in seconds before recall */
  cooldown_seconds?: number;
  /** Whether human approval is required */
  requires_human_approval?: boolean;
  /** Whether physical token is required */
  requires_physical_token?: boolean;
  /** Allowed requesters (empty = all) */
  allowed_requesters?: string[];
  /** Maximum recall count (0 = unlimited) */
  max_recalls?: number;
  /** Current recall count */
  recall_count?: number;
}

/**
 * Encryption profile configuration
 */
export interface EncryptionProfile {
  /** Unique profile identifier */
  profile_id: string;
  /** Cipher algorithm (default: AES-256-GCM) */
  cipher: string;
  /** Key derivation source */
  key_source: KeySource;
  /** Key rotation policy */
  rotation_policy: 'manual' | 'periodic' | 'on-breach';
  /** Whether profile can be exported */
  exportable: boolean;
}

/**
 * Request to recall a memory
 */
export interface RecallRequest {
  /** Target memory identifier */
  memory_id: string;
  /** Requestor identity */
  requester: string;
  /** Access justification */
  justification: string;
  /** Auto-generated request UUID */
  request_id: string;
  /** Authorization status */
  approved: boolean;
  /** Request timestamp */
  requested_at: Date;
  /** Approval timestamp (if approved) */
  approved_at?: Date;
  /** Approver identity (if approved) */
  approved_by?: string;
}

/**
 * Result of a store operation
 */
export interface StoreResult {
  /** Whether storage succeeded */
  success: boolean;
  /** Memory ID (if successful) */
  memory_id?: string;
  /** Content hash (if successful) */
  content_hash?: string;
  /** Error message (if failed) */
  error?: string;
  /** Associated contract ID */
  contract_id?: string;
}

/**
 * Result of a recall operation
 *
 * SECURITY NOTE: The content field contains sensitive plaintext data.
 * Always clear it using zeroMemory() when no longer needed.
 */
export interface RecallResult {
  /** Whether recall succeeded */
  success: boolean;
  /** Recalled memory object (if successful) */
  memory?: MemoryObject;
  /**
   * Decrypted content (if successful)
   * SECURITY: Clear with zeroMemory() after use
   * @see zeroMemory
   */
  content?: Uint8Array;
  /** Error message (if failed) */
  error?: string;
  /** Denial reason (if denied by contract) */
  denial_reason?: string;
}

/**
 * Lockdown status information
 */
export interface LockdownStatus {
  /** Whether vault is locked down */
  is_locked: boolean;
  /** Lockdown timestamp */
  locked_at?: Date;
  /** Lockdown reason */
  reason?: string;
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  /** Backup file path */
  file_path: string;
  /** Whether incremental */
  incremental: boolean;
  /** Backup description */
  description: string;
  /** Backup timestamp */
  created_at: Date;
  /** Memory count in backup */
  memory_count: number;
}

/**
 * Tombstone information
 */
export interface TombstoneInfo {
  /** Memory ID */
  memory_id: string;
  /** Tombstone reason */
  reason: string;
  /** Tombstone timestamp */
  tombstoned_at: Date;
  /** Who requested tombstoning */
  tombstoned_by: string;
  /** Associated contract ID (if any) */
  contract_id?: string;
}

/**
 * Memory query options
 */
export interface MemoryQuery {
  /** Filter by contract ID */
  contract_id?: string;
  /** Filter by domain */
  domain?: string;
  /** Filter by context */
  context?: string;
  /** Filter by classification level */
  classification?: ClassificationLevel;
  /** Filter by creation date (after) */
  created_after?: Date;
  /** Filter by creation date (before) */
  created_before?: Date;
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Include tombstoned memories */
  include_tombstoned?: boolean;
}

/**
 * Integrity verification result
 */
export interface IntegrityResult {
  /** Whether verification passed */
  valid: boolean;
  /** Merkle root hash */
  merkle_root?: string;
  /** List of invalid memory IDs */
  invalid_memories?: string[];
  /** Verification timestamp */
  verified_at: Date;
}

/**
 * Contract enforcement result
 */
export interface EnforcementCheckResult {
  /** Whether operation is allowed */
  allowed: boolean;
  /** Contract ID that was checked */
  contract_id?: string;
  /** Reason for denial (if denied) */
  reason?: string;
  /** Warnings (operation allowed but with caveats) */
  warnings?: string[];
}

/**
 * Options for creating a memory with contract enforcement
 */
export interface ContractEnforcedStoreOptions {
  /** Content to store */
  content: Uint8Array | string;
  /** Classification level */
  classification: ClassificationLevel;
  /** Domain for this memory */
  domain?: string;
  /** Context for this memory */
  context?: string;
  /** Tool used */
  tool?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Intent reference */
  intent_ref?: string;
  /** If derived, source memory IDs */
  derived_from?: string[];
}

/**
 * Options for recalling a memory with contract enforcement
 */
export interface ContractEnforcedRecallOptions {
  /** Memory ID to recall */
  memory_id: string;
  /** Justification for recall */
  justification: string;
  /** Requester identity */
  requester: string;
  /** Domain context of recall */
  domain?: string;
  /** Context of recall */
  context?: string;
  /** Tool making the request */
  tool?: string;
}
