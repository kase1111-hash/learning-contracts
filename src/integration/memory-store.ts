/**
 * Contract-Governed Memory Store
 *
 * The integration bridge between any AI memory system and Learning Contracts.
 * Consumers implement the MemoryStore interface on their existing store,
 * then wrap it in ContractGovernedStore for automatic enforcement.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LearningContract,
  BoundaryMode,
  EnforcementResult,
} from '../types';
import { LearningContractsSystem } from '../system';

/**
 * A single memory item as understood by the integration layer.
 * Consumers map their internal memory format to/from this.
 */
export interface MemoryInput {
  /** Content of the memory */
  content: string;
  /** Classification level (0-5) */
  classification: number;
  /** Domain this memory belongs to */
  domain: string;
  /** Context this memory belongs to */
  context?: string;
  /** Tool that produced this memory */
  tool?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A stored memory with its ID and contract association.
 */
export interface StoredMemory {
  /** Unique memory identifier */
  memory_id: string;
  /** Contract that authorized this memory */
  contract_id: string;
  /** Original content */
  content: string;
  /** Classification level */
  classification: number;
  /** Domain */
  domain: string;
  /** Context */
  context?: string;
  /** Tool */
  tool?: string;
  /** When the memory was stored */
  stored_at: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Query for recalling memories.
 */
export interface RecallQuery {
  /** Domain to recall from */
  domain: string;
  /** Context to recall from */
  context?: string;
  /** Tool to recall from */
  tool?: string;
  /** Who is requesting the recall */
  requester?: string;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Result of a governed operation.
 * Includes both the enforcement decision and the operation result (if allowed).
 */
export interface GovernedResult<T> {
  /** Whether the operation was allowed */
  allowed: boolean;
  /** The enforcement decision details */
  enforcement: EnforcementResult;
  /** The operation result (only present if allowed) */
  result?: T;
  /** Contract that was used */
  contract_id: string;
}

/**
 * The minimal interface a consumer's memory store must implement.
 * This is what you build on top of your existing memory system.
 */
export interface MemoryStore {
  /** Store a memory and return it with an assigned ID */
  store(memory: StoredMemory): Promise<StoredMemory>;
  /** Recall memories matching a query */
  recall(query: RecallQuery): Promise<StoredMemory[]>;
  /** Forget (delete) memories by ID */
  forget(memoryIds: string[]): Promise<void>;
  /** List all memories associated with a contract */
  listByContract(contractId: string): Promise<StoredMemory[]>;
}

/**
 * In-memory implementation of MemoryStore for testing and examples.
 */
export class InMemoryStore implements MemoryStore {
  private memories: Map<string, StoredMemory> = new Map();

  store(memory: StoredMemory): Promise<StoredMemory> {
    this.memories.set(memory.memory_id, { ...memory });
    return Promise.resolve({ ...memory });
  }

  recall(query: RecallQuery): Promise<StoredMemory[]> {
    const results: StoredMemory[] = [];
    for (const memory of this.memories.values()) {
      if (memory.domain !== query.domain) {
        continue;
      }
      if (query.context && memory.context !== query.context) {
        continue;
      }
      if (query.tool && memory.tool !== query.tool) {
        continue;
      }
      results.push({ ...memory });
      if (query.limit && results.length >= query.limit) {
        break;
      }
    }
    return Promise.resolve(results);
  }

  forget(memoryIds: string[]): Promise<void> {
    for (const id of memoryIds) {
      this.memories.delete(id);
    }
    return Promise.resolve();
  }

  listByContract(contractId: string): Promise<StoredMemory[]> {
    const results: StoredMemory[] = [];
    for (const memory of this.memories.values()) {
      if (memory.contract_id === contractId) {
        results.push({ ...memory });
      }
    }
    return Promise.resolve(results);
  }

  /** Get count of stored memories (for testing) */
  size(): number {
    return this.memories.size;
  }
}

/**
 * Wraps any MemoryStore with automatic Learning Contract enforcement.
 *
 * Every store and recall operation is checked against the contract system
 * before being forwarded to the underlying store. Consumers don't need
 * to call enforcement hooks manually.
 *
 * Usage:
 * ```typescript
 * const store = new InMemoryStore(); // or your custom MemoryStore
 * const system = new LearningContractsSystem();
 * const governed = new ContractGovernedStore(store, system);
 *
 * // All operations are automatically enforced
 * const result = await governed.store(memory, contractId);
 * ```
 */
export class ContractGovernedStore {
  constructor(
    private readonly backingStore: MemoryStore,
    private readonly system: LearningContractsSystem,
    private readonly defaultBoundaryMode: BoundaryMode = BoundaryMode.NORMAL
  ) {}

  /**
   * Store a memory under a specific contract.
   * Enforcement is checked before the underlying store is called.
   */
  async store(
    input: MemoryInput,
    contractId: string,
    boundaryMode?: BoundaryMode
  ): Promise<GovernedResult<StoredMemory>> {
    const mode = boundaryMode ?? this.defaultBoundaryMode;

    const enforcement = this.system.checkMemoryCreation(
      contractId,
      mode,
      input.classification,
      {
        domain: input.domain,
        context: input.context,
        tool: input.tool,
      }
    );

    if (!enforcement.allowed) {
      return {
        allowed: false,
        enforcement,
        contract_id: contractId,
      };
    }

    const memory: StoredMemory = {
      memory_id: uuidv4(),
      contract_id: contractId,
      content: input.content,
      classification: input.classification,
      domain: input.domain,
      context: input.context,
      tool: input.tool,
      stored_at: new Date(),
      metadata: input.metadata,
    };

    const stored = await this.backingStore.store(memory);

    return {
      allowed: true,
      enforcement,
      result: stored,
      contract_id: contractId,
    };
  }

  /**
   * Store a memory with automatic contract discovery.
   * Finds the applicable contract for the given domain/context/tool,
   * then enforces and stores.
   */
  async storeWithDiscovery(
    input: MemoryInput,
    boundaryMode?: BoundaryMode
  ): Promise<GovernedResult<StoredMemory>> {
    const contract = this.system.findApplicableContract(
      input.domain,
      input.context,
      input.tool
    );

    if (!contract) {
      return {
        allowed: false,
        enforcement: {
          allowed: false,
          reason: 'No applicable contract found for this domain/context/tool',
          contract_id: '',
        },
        contract_id: '',
      };
    }

    return this.store(input, contract.contract_id, boundaryMode);
  }

  /**
   * Recall memories under a specific contract.
   * Enforcement is checked before the underlying recall is called.
   */
  async recall(
    query: RecallQuery,
    contractId: string,
    boundaryMode?: BoundaryMode
  ): Promise<GovernedResult<StoredMemory[]>> {
    const mode = boundaryMode ?? this.defaultBoundaryMode;

    const enforcement = this.system.checkRecall(contractId, mode, {
      domain: query.domain,
      context: query.context,
      tool: query.tool,
      requester: query.requester,
    });

    if (!enforcement.allowed) {
      return {
        allowed: false,
        enforcement,
        contract_id: contractId,
      };
    }

    const memories = await this.backingStore.recall(query);

    // Filter to only memories under this contract
    const contractMemories = memories.filter(
      (m) => m.contract_id === contractId
    );

    return {
      allowed: true,
      enforcement,
      result: contractMemories,
      contract_id: contractId,
    };
  }

  /**
   * Forget all memories associated with a contract.
   * Called automatically when a contract is revoked.
   */
  async forgetByContract(contractId: string): Promise<string[]> {
    const memories = await this.backingStore.listByContract(contractId);
    const memoryIds = memories.map((m) => m.memory_id);
    if (memoryIds.length > 0) {
      await this.backingStore.forget(memoryIds);
    }
    return memoryIds;
  }

  /**
   * Get the applicable contract for a given scope, or null if none.
   * Convenience method for checking what contract would govern an operation.
   */
  findContract(
    domain?: string,
    context?: string,
    tool?: string
  ): LearningContract | null {
    return this.system.findApplicableContract(domain, context, tool);
  }
}
