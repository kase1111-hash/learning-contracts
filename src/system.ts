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

export class LearningContractsSystem {
  private auditLogger: AuditLogger;
  private repository: ContractRepository;
  private lifecycleManager: ContractLifecycleManager;
  private enforcementEngine: EnforcementEngine;
  private memoryForgetting: MemoryForgetting;

  constructor() {
    this.auditLogger = new AuditLogger();
    this.repository = new ContractRepository();
    this.lifecycleManager = new ContractLifecycleManager(this.auditLogger);
    this.enforcementEngine = new EnforcementEngine(
      this.lifecycleManager,
      this.auditLogger
    );
    this.memoryForgetting = new MemoryForgetting(this.auditLogger);
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
}
