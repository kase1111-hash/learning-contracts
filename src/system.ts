/**
 * Learning Contracts System
 *
 * Main integration point for the Learning Contracts system.
 * Combines all components: lifecycle, enforcement, audit, and storage.
 */

import {
  LearningContract,
  AbstractionLevel,
  BoundaryMode,
  EnforcementContext,
  EnforcementResult,
} from './types';
import { ContractLifecycleManager, ContractDraft } from './contracts/lifecycle';
import { ContractFactory } from './contracts/factory';
import { EnforcementEngine } from './enforcement/engine';
import { AuditLogger } from './audit/logger';
import { ContractRepository } from './storage/repository';
import { MemoryForgetting, MemoryReference } from './memory/forgetting';
import {
  ConversationalContractBuilder,
  PlainLanguageSummarizer,
  PlainLanguageParser,
  ContractDraftFromLanguage,
  ConversationAnswer,
  BuilderResponse,
  SummaryOptions,
  CONTRACT_TEMPLATES,
  ContractTemplate,
  searchTemplates,
} from './plain-language';
import {
  ContractEnforcedVault,
  MemoryVaultAdapter,
  VaultAuditEvent,
} from './vault-integration';
import {
  BoundaryEnforcedSystem,
  BoundaryDaemonAdapter,
  BoundaryAuditEvent,
} from './boundary-integration';
import {
  SessionManager,
  Session,
  SessionEndResult,
  SessionCleanupOptions,
} from './session';
import {
  TimeboundExpiryManager,
  ExpiryCycleResult,
  ExpiryCheckResult,
  ExpiryManagerStats,
} from './expiry';
import {
  EmergencyOverrideManager,
  EmergencyOverrideStatus,
  OverrideTriggerResult,
  OverrideDisableResult,
  OverrideTriggerListener,
  OverrideDisableListener,
  BlockedOperationListener,
} from './emergency-override';

export class LearningContractsSystem {
  private auditLogger: AuditLogger;
  private repository: ContractRepository;
  private lifecycleManager: ContractLifecycleManager;
  private enforcementEngine: EnforcementEngine;
  private memoryForgetting: MemoryForgetting;
  private conversationBuilder: ConversationalContractBuilder;
  private summarizer: PlainLanguageSummarizer;
  private parser: PlainLanguageParser;
  private sessionManager: SessionManager;
  private expiryManager: TimeboundExpiryManager;
  private emergencyOverrideManager: EmergencyOverrideManager;

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
    this.emergencyOverrideManager = new EmergencyOverrideManager(this.auditLogger);
    this.enforcementEngine.setEmergencyOverrideManager(this.emergencyOverrideManager);
    this.conversationBuilder = new ConversationalContractBuilder();
    this.summarizer = new PlainLanguageSummarizer();
    this.parser = new PlainLanguageParser();

    // Initialize session manager with callbacks
    this.sessionManager = new SessionManager({
      contractResolver: (contractId: string) => this.getContract(contractId),
      contractExpirer: (contractId: string, actor: string) => {
        const contract = this.getContract(contractId);
        if (!contract) {
          throw new Error('Contract not found');
        }
        const expired = this.lifecycleManager.expire(contract, actor);
        this.repository.save(expired);
        return expired;
      },
      memoryFreezer: (contractId: string, memories: MemoryReference[]) => {
        const contract = this.getContract(contractId);
        if (!contract) {
          throw new Error('Contract not found');
        }
        return this.memoryForgetting.freezeMemories(contract, memories);
      },
      auditLogger: this.auditLogger,
    });

    // Initialize timebound expiry manager
    this.expiryManager = new TimeboundExpiryManager({
      findTimeboundExpired: () => this.repository.getTimeboundExpiredContracts(),
      contractResolver: (contractId: string) => this.getContract(contractId),
      contractExpirer: (contractId: string, actor: string) => {
        const contract = this.getContract(contractId);
        if (!contract) {
          throw new Error('Contract not found');
        }
        const expired = this.lifecycleManager.expire(contract, actor);
        this.repository.save(expired);
        return expired;
      },
      memoryFreezer: (contractId: string, memories: MemoryReference[]) => {
        const contract = this.getContract(contractId);
        if (!contract) {
          throw new Error('Contract not found');
        }
        return this.memoryForgetting.freezeMemories(contract, memories);
      },
    });
  }

  /**
   * Contract Creation Methods
   */

  createContract(draft: ContractDraft): LearningContract {
    const contract = this.lifecycleManager.createDraft(draft);
    this.repository.save(contract);
    return contract;
  }

  createObservationContract(createdBy: string, scope?: any) {
    const draft = ContractFactory.createObservationContract(createdBy, scope);
    return this.createContract(draft);
  }

  createEpisodicContract(createdBy: string, scope?: any, options?: any) {
    const draft = ContractFactory.createEpisodicContract(
      createdBy,
      scope,
      options
    );
    return this.createContract(draft);
  }

  createProceduralContract(createdBy: string, scope?: any, options?: any) {
    const draft = ContractFactory.createProceduralContract(
      createdBy,
      scope,
      options
    );
    return this.createContract(draft);
  }

  createStrategicContract(createdBy: string, scope?: any, options?: any) {
    const draft = ContractFactory.createStrategicContract(
      createdBy,
      scope,
      options
    );
    return this.createContract(draft);
  }

  createProhibitedContract(createdBy: string, scope?: any) {
    const draft = ContractFactory.createProhibitedContract(createdBy, scope);
    return this.createContract(draft);
  }

  /**
   * Contract Lifecycle Methods
   */

  submitForReview(contractId: string, actor: string): LearningContract {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    const updated = this.lifecycleManager.submitForReview(contract, actor);
    this.repository.save(updated);
    return updated;
  }

  activateContract(contractId: string, actor: string): LearningContract {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new Error('Contract not found');
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
      throw new Error('Contract not found');
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
      throw new Error('Contract not found');
    }

    const result = this.lifecycleManager.amend(contract, actor, changes, reason);
    this.repository.save(result.original);
    this.repository.save(result.newDraft);
    return result;
  }

  /**
   * Enforcement Methods (Four Mandatory Hooks)
   */

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
      throw new Error('Contract not found');
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
      throw new Error('Contract not found');
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
      throw new Error('Contract not found');
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
      throw new Error('Contract not found');
    }

    const enforcementContext: EnforcementContext = {
      contract,
      boundary_mode: boundaryMode,
      is_transfer: true,
    };

    return this.enforcementEngine.checkExport(enforcementContext);
  }

  /**
   * Memory Forgetting Methods
   */

  freezeMemories(
    contractId: string,
    memories: MemoryReference[]
  ) {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    return this.memoryForgetting.freezeMemories(contract, memories);
  }

  tombstoneMemories(
    contractId: string,
    memories: MemoryReference[]
  ) {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    return this.memoryForgetting.tombstoneMemories(contract, memories);
  }

  deepPurge(
    contractId: string,
    memories: MemoryReference[],
    ownerConfirmation: any
  ) {
    const contract = this.getContract(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    return this.memoryForgetting.deepPurge(contract, memories, ownerConfirmation);
  }

  /**
   * Query Methods
   */

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

  /**
   * Audit Methods
   */

  getAuditLog() {
    return this.auditLogger.export();
  }

  getContractHistory(contractId: string) {
    return this.auditLogger.getContractHistory(contractId);
  }

  getViolations() {
    return this.auditLogger.getViolations();
  }

  /**
   * Maintenance Methods
   */

  expireOldContracts(actor: string = 'system'): LearningContract[] {
    const expired = this.repository.getExpiredContracts();

    return expired.map((contract) => {
      const updated = this.lifecycleManager.expire(contract, actor);
      this.repository.save(updated);
      return updated;
    });
  }

  /**
   * Plain-Language Interface Methods
   */

  /**
   * Start a new plain-language contract creation conversation
   */
  startPlainLanguageConversation(userId: string): BuilderResponse {
    return this.conversationBuilder.startConversation(userId);
  }

  /**
   * Process input in a plain-language conversation
   */
  processConversationInput(
    conversationId: string,
    input: string | ConversationAnswer
  ): BuilderResponse {
    return this.conversationBuilder.processInput(conversationId, input);
  }

  /**
   * Use a template in a conversation
   */
  useTemplateInConversation(
    conversationId: string,
    templateId: string
  ): BuilderResponse {
    return this.conversationBuilder.useTemplate(conversationId, templateId);
  }

  /**
   * Create a contract from a plain-language draft
   */
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
        may_store: draft.contractType !== 'observation' && draft.contractType !== 'prohibited',
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
      revocable: draft.contractType !== 'prohibited',
    };

    return this.createContract(contractDraft);
  }

  /**
   * Get plain-language summary of a contract
   */
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

  /**
   * Get short summary of a contract
   */
  getContractShortSummary(contractId: string): string | null {
    const contract = this.getContract(contractId);
    if (!contract) {
      return null;
    }
    return this.summarizer.shortSummary(contract);
  }

  /**
   * Parse natural language to understand intent (without starting a conversation)
   */
  parseNaturalLanguage(input: string) {
    return this.parser.parse(input);
  }

  /**
   * Get all available contract templates
   */
  getContractTemplates(): ContractTemplate[] {
    return CONTRACT_TEMPLATES;
  }

  /**
   * Search contract templates
   */
  searchContractTemplates(query: string): ContractTemplate[] {
    return searchTemplates(query);
  }

  /**
   * Cancel a plain-language conversation
   */
  cancelConversation(conversationId: string): boolean {
    return this.conversationBuilder.cancelConversation(conversationId);
  }

  /**
   * Clean up old conversations
   */
  cleanupOldConversations(maxAgeMs?: number): number {
    return this.conversationBuilder.cleanupOldConversations(maxAgeMs);
  }

  /**
   * Get abstraction level based on contract type
   */
  private getMaxAbstraction(
    contractType: string,
    allowGeneralization: boolean
  ): AbstractionLevel {
    if (!allowGeneralization) {
      return AbstractionLevel.RAW;
    }

    switch (contractType) {
      case 'strategic':
        return AbstractionLevel.STRATEGY;
      case 'procedural':
        return AbstractionLevel.HEURISTIC;
      case 'episodic':
        return AbstractionLevel.PATTERN;
      default:
        return AbstractionLevel.RAW;
    }
  }

  /**
   * Memory Vault Integration Methods
   */

  /**
   * Create a contract-enforced vault instance
   *
   * The returned vault enforces all Learning Contract rules before
   * allowing memory operations. This is the recommended way to
   * integrate with Memory Vault.
   *
   * @param adapter - The vault adapter to wrap (e.g., HTTP adapter, mock)
   * @param boundaryMode - Current boundary mode for enforcement
   * @param defaultActor - Default actor for operations
   */
  createContractEnforcedVault(
    adapter: MemoryVaultAdapter,
    boundaryMode: BoundaryMode,
    defaultActor?: string
  ): ContractEnforcedVault {
    return new ContractEnforcedVault({
      adapter,
      contractResolver: (contractId: string) => this.getContract(contractId),
      contractFinder: (domain, context, tool) =>
        this.findApplicableContract(domain, context, tool),
      auditLogger: (event: VaultAuditEvent) => this.logVaultEvent(event),
      boundaryMode,
      defaultActor,
    });
  }

  /**
   * Log a vault audit event to the main audit log
   */
  private logVaultEvent(event: VaultAuditEvent): void {
    const contractId = event.contract_id ?? 'unknown';
    const memoryId = event.memory_id ?? 'unknown';

    switch (event.event_type) {
      case 'store':
        if (event.allowed) {
          this.auditLogger.logMemoryCreated(
            contractId,
            memoryId,
            (event.details?.classification as number) ?? 0,
            event.actor
          );
        }
        break;

      case 'recall':
        if (event.allowed) {
          this.auditLogger.logMemoryRecalled(contractId, memoryId, event.actor);
        }
        break;

      case 'tombstone':
        this.auditLogger.logMemoryTombstoned(
          contractId,
          [memoryId],
          []
        );
        break;

      case 'violation':
        // Violations are logged via enforcement check
        this.auditLogger.logGeneralizationAttempt(
          contractId,
          false,
          event.denial_reason
        );
        break;

      case 'query':
        // Queries don't have a specific log method, they're not sensitive
        break;
    }
  }

  /**
   * Boundary Daemon Integration Methods
   */

  /**
   * Create a boundary-enforced system instance
   *
   * The returned system monitors boundary mode changes and automatically
   * suspends/resumes contracts based on their required boundary modes.
   *
   * @param adapter - The boundary daemon adapter to use
   * @param autoResumeOnUpgrade - Whether to auto-resume suspended contracts on upgrade
   */
  createBoundaryEnforcedSystem(
    adapter: BoundaryDaemonAdapter,
    autoResumeOnUpgrade: boolean = true
  ): BoundaryEnforcedSystem {
    return new BoundaryEnforcedSystem({
      adapter,
      contractResolver: (contractId: string) => this.getContract(contractId),
      activeContractsProvider: () => this.getActiveContracts(),
      auditLogger: (event: BoundaryAuditEvent) => this.logBoundaryEvent(event),
      autoResumeOnUpgrade,
    });
  }

  /**
   * Log a boundary audit event to the main audit log
   */
  private logBoundaryEvent(event: BoundaryAuditEvent): void {
    switch (event.event_type) {
      case 'suspension':
        if (event.contract_id) {
          this.auditLogger.logStateTransition(
            event.contract_id,
            event.actor,
            this.getContract(event.contract_id)?.state as any,
            this.getContract(event.contract_id)?.state as any,
            {
              boundary_event_id: event.event_id,
              boundary_event_type: 'suspension',
              reason: event.details?.reason,
              previous_mode: event.details?.previous_mode,
              new_mode: event.details?.new_mode,
            }
          );
        }
        break;

      case 'resume':
        if (event.contract_id) {
          this.auditLogger.logStateTransition(
            event.contract_id,
            event.actor,
            this.getContract(event.contract_id)?.state as any,
            this.getContract(event.contract_id)?.state as any,
            {
              boundary_event_id: event.event_id,
              boundary_event_type: 'resume',
              reason: event.details?.reason,
            }
          );
        }
        break;

      case 'mode_change':
        // Mode changes are logged but don't need contract-specific logging
        break;

      case 'recall_gate':
      case 'tool_gate':
      case 'tripwire':
        // These are informational events
        break;
    }
  }

  /**
   * Session Management Methods
   */

  /**
   * Start a new session
   *
   * Sessions track active usage periods. Session-scoped contracts
   * are automatically expired when their session ends.
   *
   * @param userId - User who owns this session
   * @param metadata - Optional session metadata
   */
  startSession(userId: string, metadata?: Record<string, unknown>): Session {
    return this.sessionManager.startSession(userId, metadata);
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | null {
    return this.sessionManager.getSession(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Session[] {
    return this.sessionManager.getActiveSessions();
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): Session[] {
    return this.sessionManager.getUserSessions(userId);
  }

  /**
   * Associate a session-scoped contract with a session
   *
   * Only contracts with retention='session' can be associated.
   *
   * @param sessionId - Session to associate with
   * @param contractId - Contract to associate
   */
  associateContractWithSession(sessionId: string, contractId: string): boolean {
    return this.sessionManager.associateContract(sessionId, contractId);
  }

  /**
   * Get the session ID for a contract
   */
  getContractSession(contractId: string): string | null {
    return this.sessionManager.getContractSession(contractId);
  }

  /**
   * Check if a contract is associated with a session
   */
  isContractInSession(contractId: string): boolean {
    return this.sessionManager.isContractInSession(contractId);
  }

  /**
   * End a session and clean up associated contracts
   *
   * All session-scoped contracts associated with this session
   * will be expired and their memories frozen.
   *
   * @param sessionId - Session to end
   * @param options - Cleanup options
   */
  endSession(
    sessionId: string,
    options: SessionCleanupOptions = {}
  ): SessionEndResult {
    return this.sessionManager.endSession(sessionId, options);
  }

  /**
   * End all sessions for a user
   */
  endUserSessions(
    userId: string,
    options: SessionCleanupOptions = {}
  ): SessionEndResult[] {
    return this.sessionManager.endUserSessions(userId, options);
  }

  /**
   * Check for and expire timed-out sessions
   *
   * Call this periodically to clean up stale sessions.
   */
  expireTimedOutSessions(options: SessionCleanupOptions = {}): SessionEndResult[] {
    return this.sessionManager.expireTimedOutSessions(options);
  }

  /**
   * Register a listener for session end events
   */
  onSessionEnd(listener: (session: Session, result: SessionEndResult) => void): () => void {
    return this.sessionManager.onSessionEnd(listener);
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    endedSessions: number;
    expiredSessions: number;
    totalContractsInSessions: number;
  } {
    return this.sessionManager.getStats();
  }

  /**
   * Clean up old ended/expired sessions from memory
   */
  cleanupOldSessions(maxAgeMs?: number): number {
    return this.sessionManager.cleanupOldSessions(maxAgeMs);
  }

  /**
   * Timebound Expiry Methods
   */

  /**
   * Start automatic timebound expiry checking
   *
   * When running, the system will periodically check for contracts
   * with expired retention_until timestamps and automatically expire them.
   */
  startTimeboundExpiryChecks(): void {
    this.expiryManager.start();
  }

  /**
   * Stop automatic timebound expiry checking
   */
  stopTimeboundExpiryChecks(): void {
    this.expiryManager.stop();
  }

  /**
   * Check if automatic timebound expiry checking is running
   */
  isTimeboundExpiryRunning(): boolean {
    return this.expiryManager.isRunning();
  }

  /**
   * Run a single timebound expiry check cycle
   *
   * Can be called manually even when automatic checking is not running.
   * Useful for testing or manual maintenance.
   */
  runTimeboundExpiryCycle(): ExpiryCycleResult {
    return this.expiryManager.runExpiryCycle();
  }

  /**
   * Check a specific contract for timebound expiry (dry run)
   *
   * Returns information about whether the contract would be expired
   * without actually expiring it.
   */
  checkTimeboundExpiry(contractId: string): ExpiryCheckResult | null {
    return this.expiryManager.checkContract(contractId);
  }

  /**
   * Force expire a specific contract immediately
   *
   * Bypasses the scheduled check and expires the contract now.
   */
  forceTimeboundExpiry(contractId: string): ExpiryCheckResult {
    return this.expiryManager.forceExpire(contractId);
  }

  /**
   * Register a listener for individual contract expiry events
   */
  onTimeboundExpiry(
    listener: (contract: LearningContract, result: ExpiryCheckResult) => void
  ): () => void {
    return this.expiryManager.onExpiry(listener);
  }

  /**
   * Register a listener for expiry cycle completion events
   */
  onExpiryCycleComplete(listener: (result: ExpiryCycleResult) => void): () => void {
    return this.expiryManager.onCycleComplete(listener);
  }

  /**
   * Get the timebound expiry check interval in milliseconds
   */
  getTimeboundExpiryInterval(): number {
    return this.expiryManager.getCheckInterval();
  }

  /**
   * Set a new timebound expiry check interval
   *
   * If automatic checking is running, it will be restarted with the new interval.
   */
  setTimeboundExpiryInterval(intervalMs: number): void {
    this.expiryManager.setCheckInterval(intervalMs);
  }

  /**
   * Get timebound expiry manager statistics
   */
  getTimeboundExpiryStats(): ExpiryManagerStats {
    return this.expiryManager.getStats();
  }

  /**
   * Reset timebound expiry statistics
   */
  resetTimeboundExpiryStats(): void {
    this.expiryManager.resetStats();
  }

  // ==========================================
  // Emergency Override Methods
  // ==========================================

  /**
   * Triggers an emergency override that blocks all learning operations.
   *
   * When triggered:
   * - All memory creation is blocked
   * - All abstraction/generalization is blocked
   * - All recall operations are blocked
   * - All export operations are blocked
   *
   * This implements the "pause all learning" command for human supremacy.
   *
   * @param triggeredBy - Identifier of who/what triggered the override
   * @param reason - Reason for triggering the override
   * @returns Result of the trigger operation
   */
  triggerEmergencyOverride(
    triggeredBy: string,
    reason: string
  ): OverrideTriggerResult {
    const activeContracts = this.repository.query({ active_only: true });
    return this.emergencyOverrideManager.triggerOverride(
      triggeredBy,
      reason,
      activeContracts.length
    );
  }

  /**
   * Disables an active emergency override, resuming normal operation.
   *
   * @param disabledBy - Identifier of who/what is disabling the override
   * @param reason - Optional reason for disabling
   * @returns Result of the disable operation
   */
  disableEmergencyOverride(
    disabledBy: string,
    reason?: string
  ): OverrideDisableResult {
    return this.emergencyOverrideManager.disableOverride(disabledBy, reason);
  }

  /**
   * Gets the current status of the emergency override.
   *
   * @returns Current emergency override status
   */
  getEmergencyOverrideStatus(): EmergencyOverrideStatus {
    return this.emergencyOverrideManager.getStatus();
  }

  /**
   * Checks if emergency override is currently active.
   *
   * @returns True if emergency override is active
   */
  isEmergencyOverrideActive(): boolean {
    return this.emergencyOverrideManager.isActive();
  }

  /**
   * Registers a listener for emergency override trigger events.
   *
   * @param listener - Callback to invoke when override is triggered
   * @returns Unsubscribe function
   */
  onEmergencyOverrideTrigger(listener: OverrideTriggerListener): () => void {
    return this.emergencyOverrideManager.onTrigger(listener);
  }

  /**
   * Registers a listener for emergency override disable events.
   *
   * @param listener - Callback to invoke when override is disabled
   * @returns Unsubscribe function
   */
  onEmergencyOverrideDisable(listener: OverrideDisableListener): () => void {
    return this.emergencyOverrideManager.onDisable(listener);
  }

  /**
   * Registers a listener for blocked operation events during emergency override.
   *
   * @param listener - Callback to invoke when an operation is blocked
   * @returns Unsubscribe function
   */
  onEmergencyOverrideBlockedOperation(
    listener: BlockedOperationListener
  ): () => void {
    return this.emergencyOverrideManager.onBlockedOperation(listener);
  }
}
