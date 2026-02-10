/**
 * Learning Contracts System
 *
 * Main integration point for the Learning Contracts system.
 * Combines all components: lifecycle, enforcement, audit, and storage.
 *
 * Subsystems are exposed as public readonly properties for direct access:
 *   system.sessions      - Session lifecycle management
 *   system.expiry        - Timebound contract expiry
 *   system.emergencyOverride - Emergency override controls
 *   system.users         - Multi-user connection management
 *   system.permissions   - Contract permission management
 *   system.conversations - Plain-language contract builder
 *   system.summarizer    - Contract plain-language summaries
 *   system.parser        - Natural language intent parsing
 *
 * Orchestration methods that coordinate multiple subsystems remain on this class.
 */

import {
  LearningContract,
  LearningScope,
  AbstractionLevel,
  BoundaryMode,
  ContractType,
  RetentionDuration,
  EnforcementContext,
  EnforcementResult,
} from './types';
import { ContractError, ErrorCode } from './errors';
import { ContractLifecycleManager, ContractDraft } from './contracts/lifecycle';
import { ContractFactory } from './contracts/factory';
import { EnforcementEngine } from './enforcement/engine';
import { AuditLogger } from './audit/logger';
import { ContractRepository } from './storage/repository';
import { MemoryForgetting, MemoryReference, ForgettingResult } from './memory/forgetting';
import {
  ConversationalContractBuilder,
  PlainLanguageSummarizer,
  PlainLanguageParser,
  ContractDraftFromLanguage,
  SummaryOptions,
} from './plain-language';
import { SessionManager } from './session';
import { TimeboundExpiryManager } from './expiry';
import {
  EmergencyOverrideManager,
  OverrideTriggerResult,
} from './emergency-override';
import {
  UserManager,
  PermissionManager,
  PermissionLevel,
} from './user-management';

/**
 * Rate limiter configuration
 */
export interface RateLimitConfig {
  /** Maximum contracts per user per window */
  maxContractsPerWindow: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Enable rate limiting */
  enabled: boolean;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxContractsPerWindow: 100,
  windowMs: 60000, // 1 minute
  enabled: false, // Disabled by default for backward compatibility
};

/**
 * Token bucket rate limiter for contract creation
 */
class RateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Attempts to consume a token for the given user
   * Returns true if allowed, false if rate limited
   */
  tryConsume(userId: string): { allowed: boolean; retryAfterMs?: number } {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = { tokens: this.config.maxContractsPerWindow, lastRefill: now };
      this.buckets.set(userId, bucket);
    }

    // Refill tokens if window has passed
    const timeSinceRefill = now - bucket.lastRefill;
    if (timeSinceRefill >= this.config.windowMs) {
      bucket.tokens = this.config.maxContractsPerWindow;
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return { allowed: true };
    }

    // Calculate time until next refill
    const retryAfterMs = this.config.windowMs - timeSinceRefill;
    return { allowed: false, retryAfterMs };
  }

  /**
   * Gets the current rate limit status for a user
   */
  getStatus(userId: string): { remaining: number; resetMs: number } {
    if (!this.config.enabled) {
      return { remaining: this.config.maxContractsPerWindow, resetMs: 0 };
    }

    const bucket = this.buckets.get(userId);
    if (!bucket) {
      return { remaining: this.config.maxContractsPerWindow, resetMs: 0 };
    }

    const timeSinceRefill = Date.now() - bucket.lastRefill;
    const resetMs = Math.max(0, this.config.windowMs - timeSinceRefill);

    return { remaining: bucket.tokens, resetMs };
  }

  /**
   * Clears rate limit data for a user
   */
  clearUser(userId: string): void {
    this.buckets.delete(userId);
  }

  /**
   * Clears all rate limit data
   */
  clearAll(): void {
    this.buckets.clear();
  }
}

export class LearningContractsSystem {
  // ==========================================
  // Public Subsystems (direct access)
  // ==========================================
  public readonly sessions: SessionManager;
  public readonly expiry: TimeboundExpiryManager;
  public readonly emergencyOverride: EmergencyOverrideManager;
  public readonly users: UserManager;
  public readonly permissions: PermissionManager;
  public readonly conversations: ConversationalContractBuilder;
  public readonly summarizer: PlainLanguageSummarizer;
  public readonly parser: PlainLanguageParser;

  // ==========================================
  // Private Internals
  // ==========================================
  private auditLogger: AuditLogger;
  private repository: ContractRepository;
  private lifecycleManager: ContractLifecycleManager;
  private enforcementEngine: EnforcementEngine;
  private memoryForgetting: MemoryForgetting;
  private rateLimiter: RateLimiter;

  constructor() {
    this.auditLogger = new AuditLogger();
    this.repository = new ContractRepository();
    this.lifecycleManager = new ContractLifecycleManager(this.auditLogger);
    this.enforcementEngine = new EnforcementEngine(
      this.lifecycleManager,
      this.auditLogger
    );
    this.memoryForgetting = new MemoryForgetting(this.auditLogger);

    // Initialize emergency override manager and connect to enforcement engine
    this.emergencyOverride = new EmergencyOverrideManager(this.auditLogger);
    this.enforcementEngine.setEmergencyOverrideManager(this.emergencyOverride);
    this.conversations = new ConversationalContractBuilder();
    this.summarizer = new PlainLanguageSummarizer();
    this.parser = new PlainLanguageParser();

    // Initialize session manager with callbacks
    this.sessions = new SessionManager({
      contractResolver: (contractId: string) => this.getContract(contractId),
      contractExpirer: (contractId: string, actor: string) => {
        const contract = this.getContract(contractId);
        if (!contract) {
          throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
        }
        const expired = this.lifecycleManager.expire(contract, actor);
        this.repository.save(expired);
        return expired;
      },
      memoryFreezer: (contractId: string, memories: MemoryReference[]) => {
        const contract = this.getContract(contractId);
        if (!contract) {
          throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
        }
        return this.memoryForgetting.freezeMemories(contract, memories);
      },
      auditLogger: this.auditLogger,
    });

    // Initialize timebound expiry manager
    this.expiry = new TimeboundExpiryManager({
      findTimeboundExpired: () => this.repository.getTimeboundExpiredContracts(),
      contractResolver: (contractId: string) => this.getContract(contractId),
      contractExpirer: (contractId: string, actor: string) => {
        const contract = this.getContract(contractId);
        if (!contract) {
          throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
        }
        const expired = this.lifecycleManager.expire(contract, actor);
        this.repository.save(expired);
        return expired;
      },
      memoryFreezer: (contractId: string, memories: MemoryReference[]) => {
        const contract = this.getContract(contractId);
        if (!contract) {
          throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
        }
        return this.memoryForgetting.freezeMemories(contract, memories);
      },
    });

    // Initialize multi-user management
    this.users = new UserManager();
    this.permissions = new PermissionManager();

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(DEFAULT_RATE_LIMIT);
  }

  // ==========================================
  // Rate Limiting
  // ==========================================

  configureRateLimit(config: Partial<RateLimitConfig>): void {
    const mergedConfig = { ...DEFAULT_RATE_LIMIT, ...config };
    this.rateLimiter = new RateLimiter(mergedConfig);
  }

  getRateLimitStatus(userId: string): { remaining: number; resetMs: number } {
    return this.rateLimiter.getStatus(userId);
  }

  // ==========================================
  // Contract Creation (coordinates rate limiter + lifecycle + repository + permissions)
  // ==========================================

  createContract(draft: ContractDraft): LearningContract {
    // Check rate limit before creating contract
    const rateLimitResult = this.rateLimiter.tryConsume(draft.created_by);
    if (!rateLimitResult.allowed) {
      throw new ContractError(
        `Rate limit exceeded for user '${draft.created_by}'. ` +
        `Please wait ${Math.ceil((rateLimitResult.retryAfterMs ?? 0) / 1000)} seconds before creating more contracts.`,
        ErrorCode.SYSTEM_RESOURCE_EXHAUSTED,
        { user_id: draft.created_by, operation: 'createContract' }
      );
    }

    const contract = this.lifecycleManager.createDraft(draft);
    this.repository.save(contract);
    // Set owner permission for the contract creator (using internal token for security)
    this.permissions.setOwner(
      contract.contract_id,
      contract.created_by,
      this.permissions.getInternalToken()
    );
    return contract;
  }

  createObservationContract(createdBy: string, scope?: Partial<LearningScope>): LearningContract {
    const draft = ContractFactory.createObservationContract(createdBy, scope);
    return this.createContract(draft);
  }

  createEpisodicContract(
    createdBy: string,
    scope?: Partial<LearningScope>,
    options?: {
      classificationCap?: number;
      retention?: RetentionDuration;
      retentionUntil?: Date;
      requiresOwner?: boolean;
    }
  ): LearningContract {
    const draft = ContractFactory.createEpisodicContract(
      createdBy,
      scope,
      options
    );
    return this.createContract(draft);
  }

  createProceduralContract(
    createdBy: string,
    scope?: Partial<LearningScope>,
    options?: {
      classificationCap?: number;
      retention?: RetentionDuration;
      generalizationConditions?: string[];
    }
  ): LearningContract {
    const draft = ContractFactory.createProceduralContract(
      createdBy,
      scope,
      options
    );
    return this.createContract(draft);
  }

  createStrategicContract(
    createdBy: string,
    scope?: Partial<LearningScope>,
    options?: {
      classificationCap?: number;
      generalizationConditions?: string[];
    }
  ): LearningContract {
    const draft = ContractFactory.createStrategicContract(
      createdBy,
      scope,
      options
    );
    return this.createContract(draft);
  }

  createProhibitedContract(createdBy: string, scope?: Partial<LearningScope>): LearningContract {
    const draft = ContractFactory.createProhibitedContract(createdBy, scope);
    return this.createContract(draft);
  }

  // ==========================================
  // Contract Lifecycle (coordinates lifecycle + repository)
  // ==========================================

  submitForReview(contractId: string, actor: string): LearningContract {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    const updated = this.lifecycleManager.submitForReview(contract, actor);
    this.repository.save(updated);
    return updated;
  }

  activateContract(contractId: string, actor: string): LearningContract {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    const updated = this.lifecycleManager.activate(contract, actor);
    this.repository.save(updated);
    return updated;
  }

  revokeContract(
    contractId: string,
    actor: string,
    reason: string
  ): LearningContract {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    const updated = this.lifecycleManager.revoke(contract, actor, reason);
    this.repository.save(updated);
    return updated;
  }

  amendContract(
    contractId: string,
    actor: string,
    changes: Partial<ContractDraft>,
    reason: string
  ): { original: LearningContract; newDraft: LearningContract } {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    const result = this.lifecycleManager.amend(contract, actor, changes, reason);
    this.repository.save(result.original);
    this.repository.save(result.newDraft);
    return result;
  }

  // ==========================================
  // Enforcement Hooks (coordinates repository + enforcement engine)
  // ==========================================

  checkMemoryCreation(
    contractId: string,
    boundaryMode: BoundaryMode,
    classification: number,
    options: {
      domain?: string;
      context?: string;
      tool?: string;
    } = {}
  ): EnforcementResult {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    const enforcementContext: EnforcementContext = {
      contract,
      boundary_mode: boundaryMode,
      ...options,
    };

    return this.enforcementEngine.checkMemoryCreation(
      enforcementContext,
      classification
    );
  }

  checkAbstraction(
    contractId: string,
    boundaryMode: BoundaryMode,
    targetAbstraction: AbstractionLevel,
    options: {
      domain?: string;
      context?: string;
      tool?: string;
    } = {}
  ): EnforcementResult {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    const enforcementContext: EnforcementContext = {
      contract,
      boundary_mode: boundaryMode,
      abstraction_level: targetAbstraction,
      ...options,
    };

    return this.enforcementEngine.checkAbstraction(
      enforcementContext,
      targetAbstraction
    );
  }

  checkRecall(
    contractId: string,
    boundaryMode: BoundaryMode,
    options: {
      domain?: string;
      context?: string;
      tool?: string;
      requester?: string;
    } = {}
  ): EnforcementResult {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    const enforcementContext: EnforcementContext = {
      contract,
      boundary_mode: boundaryMode,
      ...options,
    };

    return this.enforcementEngine.checkRecall(enforcementContext);
  }

  checkExport(contractId: string, boundaryMode: BoundaryMode): EnforcementResult {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    const enforcementContext: EnforcementContext = {
      contract,
      boundary_mode: boundaryMode,
      is_transfer: true,
    };

    return this.enforcementEngine.checkExport(enforcementContext);
  }

  // ==========================================
  // Memory Forgetting (coordinates repository + memory forgetting)
  // ==========================================

  freezeMemories(
    contractId: string,
    memories: MemoryReference[]
  ) {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    return this.memoryForgetting.freezeMemories(contract, memories);
  }

  tombstoneMemories(
    contractId: string,
    memories: MemoryReference[]
  ) {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    return this.memoryForgetting.tombstoneMemories(contract, memories);
  }

  deepPurge(
    contractId: string,
    memories: MemoryReference[],
    ownerConfirmation: {
      owner: string;
      confirmation_token: string;
      timestamp: Date;
    }
  ): ForgettingResult {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new ContractError('Contract not found', ErrorCode.CONTRACT_NOT_FOUND, { contract_id: contractId });
    }

    return this.memoryForgetting.deepPurge(contract, memories, ownerConfirmation);
  }

  // ==========================================
  // Query Methods
  // ==========================================

  getContract(contractId: string): LearningContract | null {
    return this.repository.get(contractId);
  }

  getAllContracts(): LearningContract[] {
    return this.repository.getAll();
  }

  getActiveContracts(): LearningContract[] {
    return this.repository.query({ active_only: true });
  }

  findApplicableContract(
    domain?: string,
    context?: string,
    tool?: string
  ): LearningContract | null {
    return this.repository.findApplicableContract(domain, context, tool);
  }

  // ==========================================
  // Audit Methods
  // ==========================================

  getAuditLog() {
    return this.auditLogger.export();
  }

  getContractHistory(contractId: string) {
    return this.auditLogger.getContractHistory(contractId);
  }

  getViolations() {
    return this.auditLogger.getViolations();
  }

  // ==========================================
  // Maintenance
  // ==========================================

  expireOldContracts(actor: string = 'system'): LearningContract[] {
    const expired = this.repository.getExpiredContracts();

    return expired.map((contract) => {
      const updated = this.lifecycleManager.expire(contract, actor);
      this.repository.save(updated);
      return updated;
    });
  }

  // ==========================================
  // Plain-Language Orchestration (coordinates multiple subsystems)
  // ==========================================

  createContractFromPlainLanguage(
    draft: ContractDraftFromLanguage
  ): LearningContract {
    // Convert plain-language draft to ContractDraft
    const contractDraft: ContractDraft = {
      created_by: draft.createdBy,
      contract_type: draft.contractType,
      scope: {
        domains: draft.domains,
        contexts: draft.contexts,
        tools: draft.tools,
        max_abstraction: this.getMaxAbstraction(draft.contractType, draft.allowGeneralization),
        transferable: false, // Never allow transfer by default
      },
      memory_permissions: {
        may_store: draft.contractType !== ContractType.OBSERVATION && draft.contractType !== ContractType.PROHIBITED,
        classification_cap: draft.classificationCap,
        retention: draft.retention,
        retention_until: draft.retentionUntil,
      },
      generalization_rules: {
        allowed: draft.allowGeneralization,
        conditions: draft.generalizationConditions,
      },
      recall_rules: {
        requires_owner: draft.requiresOwner,
        boundary_mode_min: draft.boundaryModeMin,
      },
      revocable: draft.contractType !== ContractType.PROHIBITED,
    };

    return this.createContract(contractDraft);
  }

  getContractSummary(
    contractId: string,
    options?: SummaryOptions
  ): string | null {
    const contract = this.getContract(contractId);
    if (!contract) {
      return null;
    }
    return this.summarizer.summarize(contract, options);
  }

  getContractShortSummary(contractId: string): string | null {
    const contract = this.getContract(contractId);
    if (!contract) {
      return null;
    }
    return this.summarizer.shortSummary(contract);
  }

  // ==========================================
  // Emergency Override (coordinates repository + override manager)
  // ==========================================

  triggerEmergencyOverride(
    triggeredBy: string,
    reason: string
  ): OverrideTriggerResult {
    const activeContracts = this.repository.query({ active_only: true });
    return this.emergencyOverride.triggerOverride(
      triggeredBy,
      reason,
      activeContracts.length
    );
  }

  // ==========================================
  // Cross-Subsystem Queries (coordinates permissions + repository)
  // ==========================================

  getContractsForUser(userId: string): LearningContract[] {
    const accessible = this.permissions.getUserContracts(userId);
    const contracts: LearningContract[] = [];

    for (const { contractId } of accessible) {
      const contract = this.getContract(contractId);
      if (contract) {
        contracts.push(contract);
      }
    }

    return contracts;
  }

  getOwnedContracts(userId: string): LearningContract[] {
    const accessible = this.permissions.getUserContracts(userId);
    const contracts: LearningContract[] = [];

    for (const { contractId, level } of accessible) {
      if (level === PermissionLevel.OWNER) {
        const contract = this.getContract(contractId);
        if (contract) {
          contracts.push(contract);
        }
      }
    }

    return contracts;
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  private getMaxAbstraction(
    contractType: ContractType,
    allowGeneralization: boolean
  ): AbstractionLevel {
    if (!allowGeneralization) {
      return AbstractionLevel.RAW;
    }

    switch (contractType) {
      case ContractType.STRATEGIC:
        return AbstractionLevel.STRATEGY;
      case ContractType.PROCEDURAL:
        return AbstractionLevel.HEURISTIC;
      case ContractType.EPISODIC:
        return AbstractionLevel.PATTERN;
      default:
        return AbstractionLevel.RAW;
    }
  }

}
