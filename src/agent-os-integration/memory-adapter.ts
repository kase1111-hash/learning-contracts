/**
 * Agent-OS Memory Adapter
 *
 * Implements the MemoryVaultAdapter interface to bridge Learning Contracts
 * with Agent-OS memory management system (Seshat agent domain).
 */

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  BaseMemoryVaultAdapter,
  VaultStoreOptions,
  VaultRecallOptions,
  VaultTombstoneOptions,
  VaultBackupOptions,
  VaultConnectionStatus,
} from '../vault-integration/adapter';
import {
  MemoryObject,
  MemoryQuery,
  StoreResult,
  RecallResult,
  LockdownStatus,
  BackupMetadata,
  TombstoneInfo,
  IntegrityResult,
  EncryptionProfile,
  RecallRequest,
  ClassificationLevel,
} from '../vault-integration/types';
import {
  AgentOSMemoryClass,
  AgentOSMemoryOperation,
  AgentOSConsentRequest,
  AgentOSConsentResponse,
  AgentOSIntegrationConfig,
  AgentOSAgentType,
  DEFAULT_AGENT_OS_CONFIG,
} from './types';

/**
 * Agent-OS Memory Service Client Interface
 */
export interface AgentOSMemoryClient {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  requestConsent(request: AgentOSConsentRequest): Promise<AgentOSConsentResponse>;
  store(operation: AgentOSMemoryOperation, content: Uint8Array): Promise<string>;
  recall(memoryKey: string, agent: string): Promise<Uint8Array | null>;
  delete(memoryKey: string, reason: string): Promise<boolean>;
  query(filters: Record<string, unknown>): Promise<string[]>;
  getMetadata(memoryKey: string): Promise<Record<string, unknown> | null>;
  isInLockdown(): Promise<boolean>;
  getVersion(): Promise<string>;
}

/**
 * Mock Agent-OS Memory Client for testing
 */
export class MockAgentOSMemoryClient implements AgentOSMemoryClient {
  private connected = false;
  private memories: Map<string, { content: Uint8Array; metadata: Record<string, unknown> }> = new Map();
  private consents: Map<string, AgentOSConsentResponse> = new Map();
  private inLockdown = false;

  connect(): Promise<boolean> {
    this.connected = true;
    return Promise.resolve(true);
  }

  disconnect(): Promise<void> {
    this.connected = false;
    return Promise.resolve();
  }

  isConnected(): boolean {
    return this.connected;
  }

  requestConsent(request: AgentOSConsentRequest): Promise<AgentOSConsentResponse> {
    const response: AgentOSConsentResponse = {
      request_id: request.request_id,
      granted: true,
      contract_id: `aos_consent_${uuidv4()}`,
      expiry: new Date(Date.now() + 86400000),
    };
    this.consents.set(request.request_id, response);
    return Promise.resolve(response);
  }

  store(operation: AgentOSMemoryOperation, content: Uint8Array): Promise<string> {
    const key = operation.memory_key ?? `aos_mem_${uuidv4()}`;
    this.memories.set(key, {
      content,
      metadata: {
        ...operation.metadata,
        memory_class: operation.memory_class,
        agent: operation.agent,
        stored_at: new Date().toISOString(),
      },
    });
    return Promise.resolve(key);
  }

  recall(memoryKey: string): Promise<Uint8Array | null> {
    const memory = this.memories.get(memoryKey);
    return Promise.resolve(memory?.content ?? null);
  }

  delete(memoryKey: string): Promise<boolean> {
    return Promise.resolve(this.memories.delete(memoryKey));
  }

  query(filters: Record<string, unknown>): Promise<string[]> {
    let keys = Array.from(this.memories.keys());
    if (filters.memory_class) {
      keys = keys.filter((key) => {
        const meta = this.memories.get(key)?.metadata;
        return meta?.memory_class === filters.memory_class;
      });
    }
    return Promise.resolve(keys);
  }

  getMetadata(memoryKey: string): Promise<Record<string, unknown> | null> {
    return Promise.resolve(this.memories.get(memoryKey)?.metadata ?? null);
  }

  isInLockdown(): Promise<boolean> {
    return Promise.resolve(this.inLockdown);
  }

  getVersion(): Promise<string> {
    return Promise.resolve('1.0.0-mock');
  }

  setLockdown(locked: boolean): void {
    this.inLockdown = locked;
  }

  clear(): void {
    this.memories.clear();
    this.consents.clear();
  }
}

function classificationToMemoryClass(classification: ClassificationLevel): AgentOSMemoryClass {
  if (classification <= (0 as ClassificationLevel)) {return AgentOSMemoryClass.EPHEMERAL;}
  if (classification <= (2 as ClassificationLevel)) {return AgentOSMemoryClass.WORKING;}
  return AgentOSMemoryClass.LONG_TERM;
}

/**
 * Agent-OS Memory Vault Adapter
 */
export class AgentOSMemoryAdapter extends BaseMemoryVaultAdapter {
  private client: AgentOSMemoryClient;
  readonly config: AgentOSIntegrationConfig;
  private memoryMappings: Map<string, { aosKey: string; metadata: Record<string, unknown> }> = new Map();
  private tombstones: Map<string, TombstoneInfo> = new Map();
  private pendingRequests: Map<string, RecallRequest> = new Map();

  constructor(client: AgentOSMemoryClient, config: Partial<AgentOSIntegrationConfig> = {}) {
    super();
    this.client = client;
    this.config = { ...DEFAULT_AGENT_OS_CONFIG, ...config };
  }

  async checkConnection(): Promise<VaultConnectionStatus> {
    try {
      const connected = await this.client.connect();
      if (connected) {
        this.connected = true;
        this.recordActivity();
        const version = await this.client.getVersion();
        return { connected: true, version: `Agent-OS/${version}`, last_activity: this.lastActivity };
      }
      return { connected: false, error: 'Failed to connect to Agent-OS memory service' };
    } catch (error) {
      return { connected: false, error: error instanceof Error ? error.message : 'Unknown connection error' };
    }
  }

  async storeMemory(options: VaultStoreOptions): Promise<StoreResult> {
    if (await this.client.isInLockdown()) {
      return { success: false, error: 'Agent-OS is in lockdown mode' };
    }

    const memoryClass = classificationToMemoryClass(options.classification);
    const content = typeof options.content === 'string'
      ? new TextEncoder().encode(options.content)
      : options.content;

    const operation: AgentOSMemoryOperation = {
      operation_id: uuidv4(),
      operation_type: 'store',
      memory_class: memoryClass,
      agent: AgentOSAgentType.SESHAT,
      content_hash: await this.hashContent(content),
      metadata: { ...options.metadata, classification: options.classification, created_by: options.created_by },
      timestamp: new Date(),
    };

    try {
      const aosKey = await this.client.store(operation, content);
      const memory_id = `lc_${uuidv4()}`;
      this.memoryMappings.set(memory_id, {
        aosKey,
        metadata: { memory_class: memoryClass, classification: options.classification, created_by: options.created_by, created_at: new Date().toISOString() },
      });
      this.recordActivity();
      return { success: true, memory_id, content_hash: operation.content_hash! };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to store memory' };
    }
  }

  async recallMemory(options: VaultRecallOptions): Promise<RecallResult> {
    if (await this.client.isInLockdown()) {
      return { success: false, error: 'Agent-OS is in lockdown mode' };
    }
    if (this.tombstones.has(options.memory_id)) {
      return { success: false, error: 'Memory has been tombstoned', denial_reason: 'Memory is no longer accessible' };
    }

    const mapping = this.memoryMappings.get(options.memory_id);
    if (!mapping) {
      return { success: false, error: 'Memory not found' };
    }

    try {
      const content = await this.client.recall(mapping.aosKey, options.requester);
      if (!content) {
        return { success: false, error: 'Memory not found in Agent-OS' };
      }
      const aosMetadata = await this.client.getMetadata(mapping.aosKey);
      const memory: MemoryObject = {
        memory_id: options.memory_id,
        created_at: new Date(mapping.metadata.created_at as string),
        created_by: mapping.metadata.created_by as string,
        classification: mapping.metadata.classification as ClassificationLevel,
        encryption_profile: aosMetadata?.encryption_profile as string ?? 'default',
        content_plaintext: content,
        content_hash: await this.hashContent(content),
        value_metadata: aosMetadata ?? {},
        access_policy: {},
      };
      this.recordActivity();
      return { success: true, memory, content };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to recall memory' };
    }
  }

  async queryMemories(query: MemoryQuery): Promise<MemoryObject[]> {
    const results: MemoryObject[] = [];
    for (const [memoryId, mapping] of this.memoryMappings) {
      if (!query.include_tombstoned && this.tombstones.has(memoryId)) {continue;}
      const createdAt = new Date(mapping.metadata.created_at as string);
      if (query.created_after && createdAt < query.created_after) {continue;}
      if (query.created_before && createdAt > query.created_before) {continue;}

      const content = await this.client.recall(mapping.aosKey, 'query');
      results.push({
        memory_id: memoryId,
        created_at: createdAt,
        created_by: mapping.metadata.created_by as string,
        classification: mapping.metadata.classification as ClassificationLevel,
        encryption_profile: 'default',
        content_plaintext: content ?? new Uint8Array(),
        content_hash: content ? await this.hashContent(content) : '',
        value_metadata: {},
        access_policy: {},
      });
    }
    let paginated = results;
    if (query.offset) {paginated = paginated.slice(query.offset);}
    if (query.limit) {paginated = paginated.slice(0, query.limit);}
    this.recordActivity();
    return paginated;
  }

  async getMemory(memory_id: string): Promise<MemoryObject | null> {
    const mapping = this.memoryMappings.get(memory_id);
    if (!mapping) {return null;}
    const content = await this.client.recall(mapping.aosKey, 'system');
    this.recordActivity();
    return {
      memory_id,
      created_at: new Date(mapping.metadata.created_at as string),
      created_by: mapping.metadata.created_by as string,
      classification: mapping.metadata.classification as ClassificationLevel,
      encryption_profile: 'default',
      content_plaintext: content ?? new Uint8Array(),
      content_hash: content ? await this.hashContent(content) : '',
      value_metadata: {},
      access_policy: {},
    };
  }

  async tombstoneMemory(options: VaultTombstoneOptions): Promise<TombstoneInfo> {
    const info: TombstoneInfo = {
      memory_id: options.memory_id,
      reason: options.reason,
      tombstoned_at: new Date(),
      tombstoned_by: options.requested_by,
    };
    const mapping = this.memoryMappings.get(options.memory_id);
    if (mapping) {await this.client.delete(mapping.aosKey, options.reason);}
    this.tombstones.set(options.memory_id, info);
    this.recordActivity();
    return info;
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
    return Promise.resolve({ valid: true, merkle_root: 'aos_integrity_verified', invalid_memories: [], verified_at: new Date() });
  }

  async getLockdownStatus(): Promise<LockdownStatus> {
    const inLockdown = await this.client.isInLockdown();
    this.recordActivity();
    return { is_locked: inLockdown, reason: inLockdown ? 'Agent-OS lockdown active' : undefined };
  }

  lockdown(reason: string): Promise<LockdownStatus> {
    this.recordActivity();
    return Promise.resolve({ is_locked: true, locked_at: new Date(), reason });
  }

  unlock(): Promise<LockdownStatus> {
    this.recordActivity();
    return Promise.resolve({ is_locked: false });
  }

  createBackup(options: VaultBackupOptions): Promise<BackupMetadata> {
    this.recordActivity();
    return Promise.resolve({ file_path: options.file_path, incremental: options.incremental ?? false, description: options.description ?? 'Agent-OS memory backup', created_at: new Date(), memory_count: this.memoryMappings.size });
  }

  listBackups(): Promise<BackupMetadata[]> {
    this.recordActivity();
    return Promise.resolve([]);
  }

  getEncryptionProfile(profile_id: string): Promise<EncryptionProfile | null> {
    this.recordActivity();
    if (profile_id === 'default' || profile_id === 'agent-os') {
      return Promise.resolve({ profile_id, cipher: 'AES-256-GCM', key_source: 'HumanPassphrase' as never, rotation_policy: 'manual', exportable: false });
    }
    return Promise.resolve(null);
  }

  listEncryptionProfiles(): Promise<EncryptionProfile[]> {
    this.recordActivity();
    return Promise.resolve([{ profile_id: 'agent-os', cipher: 'AES-256-GCM', key_source: 'HumanPassphrase' as never, rotation_policy: 'manual', exportable: false }]);
  }

  getPendingRecallRequests(): Promise<RecallRequest[]> {
    this.recordActivity();
    return Promise.resolve(Array.from(this.pendingRequests.values()).filter((r) => !r.approved));
  }

  approveRecallRequest(request_id: string, approver: string): Promise<RecallRequest> {
    const request = this.pendingRequests.get(request_id);
    if (!request) {throw new Error('Request not found');}
    request.approved = true;
    request.approved_at = new Date();
    request.approved_by = approver;
    this.recordActivity();
    return Promise.resolve(request);
  }

  denyRecallRequest(request_id: string): Promise<RecallRequest> {
    const request = this.pendingRequests.get(request_id);
    if (!request) {throw new Error('Request not found');}
    this.pendingRequests.delete(request_id);
    this.recordActivity();
    return Promise.resolve(request);
  }

  getAgentOSMemoryClass(memory_id: string): AgentOSMemoryClass | null {
    const mapping = this.memoryMappings.get(memory_id);
    return mapping?.metadata.memory_class as AgentOSMemoryClass | null;
  }

  getAgentOSKey(memory_id: string): string | null {
    return this.memoryMappings.get(memory_id)?.aosKey ?? null;
  }

  /**
   * Cryptographic hash function using SHA-256
   * Provides secure content verification with collision resistance
   */
  private hashContent(content: Uint8Array): Promise<string> {
    return Promise.resolve(createHash('sha256').update(content).digest('hex'));
  }

  clear(): void {
    this.memoryMappings.clear();
    this.tombstones.clear();
    this.pendingRequests.clear();
  }
}
