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

export class LearningContractsSystem {
  private auditLogger: AuditLogger;
  private repository: ContractRepository;
  private lifecycleManager: ContractLifecycleManager;
  private enforcementEngine: EnforcementEngine;
  private memoryForgetting: MemoryForgetting;
  private conversationBuilder: ConversationalContractBuilder;
  private summarizer: PlainLanguageSummarizer;
  private parser: PlainLanguageParser;

  constructor() {
    this.auditLogger = new AuditLogger();
    this.repository = new ContractRepository();
    this.lifecycleManager = new ContractLifecycleManager(this.auditLogger);
    this.enforcementEngine = new EnforcementEngine(
      this.lifecycleManager,
      this.auditLogger
    );
    this.memoryForgetting = new MemoryForgetting(this.auditLogger);
    this.conversationBuilder = new ConversationalContractBuilder();
    this.summarizer = new PlainLanguageSummarizer();
    this.parser = new PlainLanguageParser();
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
}
