/**
 * Memory Vault Adapter Interface
 *
 * Abstract interface defining how Learning Contracts communicates with
 * the Memory Vault storage system. Supports different implementations:
 * - HTTP API adapter (for remote vault access)
 * - Direct bridge (for same-process Python integration)
 * - Mock adapter (for testing)
 */

import { createHash } from 'crypto';
import {
  MemoryObject,
  MemoryQuery,
  StoreResult,
  RecallResult,
  RecallRequest,
  LockdownStatus,
  BackupMetadata,
  TombstoneInfo,
  IntegrityResult,
  ClassificationLevel,
  EncryptionProfile,
  KeySource,
} from './types';

/**
 * Options for storing a memory in the vault
 */
export interface VaultStoreOptions {
  /** Content to store (will be encrypted) */
  content: Uint8Array | string;
  /** Classification level (0-5) */
  classification: ClassificationLevel;
  /** Creator identity */
  created_by: string;
  /** Encryption profile to use */
  encryption_profile?: string;
  /** Intent reference */
  intent_ref?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for recalling a memory from the vault
 */
export interface VaultRecallOptions {
  /** Memory ID to recall */
  memory_id: string;
  /** Requester identity */
  requester: string;
  /** Justification for access */
  justification: string;
}

/**
 * Options for tombstoning a memory
 */
export interface VaultTombstoneOptions {
  /** Memory ID to tombstone */
  memory_id: string;
  /** Reason for tombstoning */
  reason: string;
  /** Who is requesting tombstone */
  requested_by: string;
}

/**
 * Options for creating a backup
 */
export interface VaultBackupOptions {
  /** Backup file path */
  file_path: string;
  /** Whether to create incremental backup */
  incremental?: boolean;
  /** Backup description */
  description?: string;
}

/**
 * Vault connection status
 */
export interface VaultConnectionStatus {
  /** Whether vault is connected */
  connected: boolean;
  /** Vault version (if connected) */
  version?: string;
  /** Last successful operation timestamp */
  last_activity?: Date;
  /** Error message (if not connected) */
  error?: string;
}

/**
 * Memory Vault Adapter Interface
 *
 * Implementations of this interface provide the bridge between
 * Learning Contracts (TypeScript) and Memory Vault (Python).
 */
export interface MemoryVaultAdapter {
  /**
   * Check connection to the vault
   */
  checkConnection(): Promise<VaultConnectionStatus>;

  /**
   * Store a memory in the vault
   */
  storeMemory(options: VaultStoreOptions): Promise<StoreResult>;

  /**
   * Recall a memory from the vault
   */
  recallMemory(options: VaultRecallOptions): Promise<RecallResult>;

  /**
   * Query memories in the vault
   */
  queryMemories(query: MemoryQuery): Promise<MemoryObject[]>;

  /**
   * Get a specific memory by ID (metadata only, no decryption)
   */
  getMemory(memory_id: string): Promise<MemoryObject | null>;

  /**
   * Tombstone a memory (mark as inaccessible)
   */
  tombstoneMemory(options: VaultTombstoneOptions): Promise<TombstoneInfo>;

  /**
   * Get tombstone information for a memory
   */
  getTombstoneInfo(memory_id: string): Promise<TombstoneInfo | null>;

  /**
   * List all tombstoned memories
   */
  listTombstones(): Promise<TombstoneInfo[]>;

  /**
   * Verify vault integrity
   */
  verifyIntegrity(): Promise<IntegrityResult>;

  /**
   * Get lockdown status
   */
  getLockdownStatus(): Promise<LockdownStatus>;

  /**
   * Trigger vault lockdown
   */
  lockdown(reason: string): Promise<LockdownStatus>;

  /**
   * Unlock vault (requires appropriate credentials)
   */
  unlock(): Promise<LockdownStatus>;

  /**
   * Create a backup
   */
  createBackup(options: VaultBackupOptions): Promise<BackupMetadata>;

  /**
   * List available backups
   */
  listBackups(): Promise<BackupMetadata[]>;

  /**
   * Get encryption profile by ID
   */
  getEncryptionProfile(profile_id: string): Promise<EncryptionProfile | null>;

  /**
   * List all encryption profiles
   */
  listEncryptionProfiles(): Promise<EncryptionProfile[]>;

  /**
   * Get pending recall requests awaiting approval
   */
  getPendingRecallRequests(): Promise<RecallRequest[]>;

  /**
   * Approve a recall request
   */
  approveRecallRequest(request_id: string, approver: string): Promise<RecallRequest>;

  /**
   * Deny a recall request
   */
  denyRecallRequest(request_id: string, reason: string): Promise<RecallRequest>;
}

/**
 * Abstract base class for Memory Vault adapters
 *
 * Provides common functionality and error handling.
 * Concrete implementations should extend this class.
 */
export abstract class BaseMemoryVaultAdapter implements MemoryVaultAdapter {
  protected connected: boolean = false;
  protected lastActivity?: Date;

  abstract checkConnection(): Promise<VaultConnectionStatus>;
  abstract storeMemory(options: VaultStoreOptions): Promise<StoreResult>;
  abstract recallMemory(options: VaultRecallOptions): Promise<RecallResult>;
  abstract queryMemories(query: MemoryQuery): Promise<MemoryObject[]>;
  abstract getMemory(memory_id: string): Promise<MemoryObject | null>;
  abstract tombstoneMemory(options: VaultTombstoneOptions): Promise<TombstoneInfo>;
  abstract getTombstoneInfo(memory_id: string): Promise<TombstoneInfo | null>;
  abstract listTombstones(): Promise<TombstoneInfo[]>;
  abstract verifyIntegrity(): Promise<IntegrityResult>;
  abstract getLockdownStatus(): Promise<LockdownStatus>;
  abstract lockdown(reason: string): Promise<LockdownStatus>;
  abstract unlock(): Promise<LockdownStatus>;
  abstract createBackup(options: VaultBackupOptions): Promise<BackupMetadata>;
  abstract listBackups(): Promise<BackupMetadata[]>;
  abstract getEncryptionProfile(profile_id: string): Promise<EncryptionProfile | null>;
  abstract listEncryptionProfiles(): Promise<EncryptionProfile[]>;
  abstract getPendingRecallRequests(): Promise<RecallRequest[]>;
  abstract approveRecallRequest(request_id: string, approver: string): Promise<RecallRequest>;
  abstract denyRecallRequest(request_id: string, reason: string): Promise<RecallRequest>;

  /**
   * Record activity timestamp
   */
  protected recordActivity(): void {
    this.lastActivity = new Date();
  }

  /**
   * Check if adapter is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity(): Date | undefined {
    return this.lastActivity;
  }
}

/**
 * Mock Memory Vault Adapter for Testing
 *
 * In-memory implementation that doesn't require actual vault.
 * Useful for unit tests and development.
 *
 * WARNING: This adapter should ONLY be used in test environments.
 */
export class MockMemoryVaultAdapter extends BaseMemoryVaultAdapter {
  private memories: Map<string, MemoryObject> = new Map();
  private tombstones: Map<string, TombstoneInfo> = new Map();
  private pendingRequests: Map<string, RecallRequest> = new Map();
  private isLocked: boolean = false;
  private lockReason?: string;
  private lockTime?: Date;

  constructor() {
    super();
    // Production safety guard
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'MockMemoryVaultAdapter is for testing only and cannot be used in production. ' +
        'Use a real MemoryVaultAdapter implementation instead.'
      );
    }
  }

  checkConnection(): Promise<VaultConnectionStatus> {
    this.connected = true;
    this.recordActivity();
    return Promise.resolve({
      connected: true,
      version: '1.0.0-mock',
      last_activity: this.lastActivity,
    });
  }

  async storeMemory(options: VaultStoreOptions): Promise<StoreResult> {
    if (this.isLocked) {
      return {
        success: false,
        error: 'Vault is locked',
      };
    }

    const memory_id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const content = typeof options.content === 'string'
      ? new TextEncoder().encode(options.content)
      : options.content;

    const contentHash = await this.hashContent(content);

    // Extract Learning Contract extension fields from metadata
    const metadata = options.metadata ?? {};
    const contractId = metadata.contract_id as string | undefined;
    const domain = metadata.domain as string | undefined;
    const context = metadata.context as string | undefined;
    const tool = metadata.tool as string | undefined;
    const isDerived = metadata.is_derived as boolean | undefined;
    const derivedFrom = metadata.derived_from as string[] | undefined;

    // Remove extension fields from value_metadata to avoid duplication
    const extensionFields = ['contract_id', 'domain', 'context', 'tool', 'is_derived', 'derived_from'];
    const cleanMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([key]) => !extensionFields.includes(key))
    );

    const memory: MemoryObject = {
      memory_id,
      created_at: new Date(),
      created_by: options.created_by,
      classification: options.classification,
      encryption_profile: options.encryption_profile ?? 'default',
      content_plaintext: content,
      content_hash: contentHash,
      intent_ref: options.intent_ref,
      value_metadata: cleanMetadata,
      access_policy: {},
      // Learning Contract extension fields
      contract_id: contractId,
      domain,
      context,
      tool,
      is_derived: isDerived,
      derived_from: derivedFrom,
    };

    this.memories.set(memory_id, memory);
    this.recordActivity();

    return {
      success: true,
      memory_id,
      content_hash: contentHash,
    };
  }

  recallMemory(options: VaultRecallOptions): Promise<RecallResult> {
    if (this.isLocked) {
      return Promise.resolve({
        success: false,
        error: 'Vault is locked',
      });
    }

    const memory = this.memories.get(options.memory_id);
    if (!memory) {
      return Promise.resolve({
        success: false,
        error: 'Memory not found',
      });
    }

    if (this.tombstones.has(options.memory_id)) {
      return Promise.resolve({
        success: false,
        error: 'Memory has been tombstoned',
        denial_reason: 'Memory is no longer accessible',
      });
    }

    this.recordActivity();

    return Promise.resolve({
      success: true,
      memory,
      content: memory.content_plaintext,
    });
  }

  queryMemories(query: MemoryQuery): Promise<MemoryObject[]> {
    let results = Array.from(this.memories.values());

    // Filter by contract_id
    if (query.contract_id) {
      results = results.filter(m => m.contract_id === query.contract_id);
    }

    // Filter by domain
    if (query.domain) {
      results = results.filter(m => m.domain === query.domain);
    }

    // Filter by context
    if (query.context) {
      results = results.filter(m => m.context === query.context);
    }

    // Filter by classification
    if (query.classification !== undefined) {
      results = results.filter(m => m.classification === query.classification);
    }

    // Filter by date range
    if (query.created_after) {
      results = results.filter(m => m.created_at >= query.created_after!);
    }
    if (query.created_before) {
      results = results.filter(m => m.created_at <= query.created_before!);
    }

    // Exclude tombstoned unless requested
    if (!query.include_tombstoned) {
      results = results.filter(m => !this.tombstones.has(m.memory_id));
    }

    // Apply pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    this.recordActivity();
    return Promise.resolve(results);
  }

  getMemory(memory_id: string): Promise<MemoryObject | null> {
    this.recordActivity();
    return Promise.resolve(this.memories.get(memory_id) ?? null);
  }

  tombstoneMemory(options: VaultTombstoneOptions): Promise<TombstoneInfo> {
    const info: TombstoneInfo = {
      memory_id: options.memory_id,
      reason: options.reason,
      tombstoned_at: new Date(),
      tombstoned_by: options.requested_by,
    };

    this.tombstones.set(options.memory_id, info);
    this.recordActivity();
    return Promise.resolve(info);
  }

  getTombstoneInfo(memory_id: string): Promise<TombstoneInfo | null> {
    this.recordActivity();
    return Promise.resolve(this.tombstones.get(memory_id) ?? null);
  }

  listTombstones(): Promise<TombstoneInfo[]> {
    this.recordActivity();
    return Promise.resolve(Array.from(this.tombstones.values()));
  }

  verifyIntegrity(): Promise<IntegrityResult> {
    this.recordActivity();
    return Promise.resolve({
      valid: true,
      merkle_root: 'mock_merkle_root',
      invalid_memories: [],
      verified_at: new Date(),
    });
  }

  getLockdownStatus(): Promise<LockdownStatus> {
    this.recordActivity();
    return Promise.resolve({
      is_locked: this.isLocked,
      locked_at: this.lockTime,
      reason: this.lockReason,
    });
  }

  async lockdown(reason: string): Promise<LockdownStatus> {
    this.isLocked = true;
    this.lockReason = reason;
    this.lockTime = new Date();
    this.recordActivity();
    return this.getLockdownStatus();
  }

  async unlock(): Promise<LockdownStatus> {
    this.isLocked = false;
    this.lockReason = undefined;
    this.lockTime = undefined;
    this.recordActivity();
    return this.getLockdownStatus();
  }

  createBackup(options: VaultBackupOptions): Promise<BackupMetadata> {
    this.recordActivity();
    return Promise.resolve({
      file_path: options.file_path,
      incremental: options.incremental ?? false,
      description: options.description ?? 'Mock backup',
      created_at: new Date(),
      memory_count: this.memories.size,
    });
  }

  listBackups(): Promise<BackupMetadata[]> {
    this.recordActivity();
    return Promise.resolve([]);
  }

  getEncryptionProfile(profile_id: string): Promise<EncryptionProfile | null> {
    this.recordActivity();
    if (profile_id === 'default') {
      return Promise.resolve({
        profile_id: 'default',
        cipher: 'AES-256-GCM',
        key_source: KeySource.HUMAN_PASSPHRASE,
        rotation_policy: 'manual',
        exportable: false,
      });
    }
    return Promise.resolve(null);
  }

  listEncryptionProfiles(): Promise<EncryptionProfile[]> {
    this.recordActivity();
    return Promise.resolve([{
      profile_id: 'default',
      cipher: 'AES-256-GCM',
      key_source: KeySource.HUMAN_PASSPHRASE,
      rotation_policy: 'manual',
      exportable: false,
    }]);
  }

  getPendingRecallRequests(): Promise<RecallRequest[]> {
    this.recordActivity();
    return Promise.resolve(Array.from(this.pendingRequests.values()).filter(r => !r.approved));
  }

  approveRecallRequest(request_id: string, approver: string): Promise<RecallRequest> {
    const request = this.pendingRequests.get(request_id);
    if (!request) {
      throw new Error('Request not found');
    }

    request.approved = true;
    request.approved_at = new Date();
    request.approved_by = approver;
    this.recordActivity();
    return Promise.resolve(request);
  }

  denyRecallRequest(request_id: string, _reason: string): Promise<RecallRequest> {
    const request = this.pendingRequests.get(request_id);
    if (!request) {
      throw new Error('Request not found');
    }

    this.pendingRequests.delete(request_id);
    this.recordActivity();
    return Promise.resolve(request);
  }

  /**
   * Cryptographic hash function using SHA-256
   * Provides secure content verification with collision resistance
   */
  private hashContent(content: Uint8Array): Promise<string> {
    return Promise.resolve(createHash('sha256').update(content).digest('hex'));
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.memories.clear();
    this.tombstones.clear();
    this.pendingRequests.clear();
    this.isLocked = false;
    this.lockReason = undefined;
    this.lockTime = undefined;
  }

  /**
   * Add a memory directly (for testing)
   */
  addMemory(memory: MemoryObject): void {
    this.memories.set(memory.memory_id, memory);
  }
}
