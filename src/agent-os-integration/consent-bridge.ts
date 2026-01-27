/**
 * Agent-OS Consent Bridge
 *
 * Bridges the consent models between Learning Contracts and Agent-OS.
 */

import { v4 as uuidv4 } from 'uuid';
import { LearningContractsSystem } from '../system';
import { LearningContract, ContractType, ContractState } from '../types';
import {
  AgentOSMemoryClass,
  AgentOSConsentRequest,
  AgentOSConsentResponse,
  ConsentAlignmentResult,
  MEMORY_CLASS_TO_CONTRACT_TYPE,
} from './types';

export interface ConsentRecord {
  contract_id: string;
  aos_consent_id: string;
  memory_class: AgentOSMemoryClass;
  user_id: string;
  purpose: string;
  granted_at: Date;
  expires_at?: Date;
  conditions?: string[];
  active: boolean;
}

export interface ConsentBridgeConfig {
  auto_create_contracts: boolean;
  default_retention_duration?: number;
  max_retention_duration?: number;
  default_domains?: string[];
  require_explicit_domains: boolean;
  onConsentChange?: (record: ConsentRecord, action: 'granted' | 'revoked') => void;
}

const DEFAULT_BRIDGE_CONFIG: ConsentBridgeConfig = {
  auto_create_contracts: true,
  default_retention_duration: 86400000,
  max_retention_duration: 2592000000,
  require_explicit_domains: false,
};

export class AgentOSConsentBridge {
  private lcs: LearningContractsSystem;
  private config: ConsentBridgeConfig;
  private consentRecords: Map<string, ConsentRecord> = new Map();
  private contractToConsent: Map<string, string> = new Map();
  private consentToContract: Map<string, string> = new Map();

  constructor(lcs: LearningContractsSystem, config: Partial<ConsentBridgeConfig> = {}) {
    this.lcs = lcs;
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
  }

  async processConsentRequest(request: AgentOSConsentRequest): Promise<AgentOSConsentResponse> {
    const existingContract = this.findMatchingContract(request);
    if (existingContract) {
      this.createConsentRecord(existingContract.contract_id, request, true);
      return {
        request_id: request.request_id,
        granted: true,
        contract_id: existingContract.contract_id,
        expiry: existingContract.memory_permissions.retention_until,
      };
    }

    if (!this.config.auto_create_contracts) {
      return { request_id: request.request_id, granted: false, denial_reason: 'No matching contract and auto-creation disabled' };
    }

    try {
      const contract = await this.createContractFromConsent(request);
      const record = this.createConsentRecord(contract.contract_id, request, true);
      this.config.onConsentChange?.(record, 'granted');
      return {
        request_id: request.request_id,
        granted: true,
        contract_id: contract.contract_id,
        expiry: contract.memory_permissions.retention_until,
        conditions: this.getConditionsFromContract(contract),
      };
    } catch (error) {
      return { request_id: request.request_id, granted: false, denial_reason: error instanceof Error ? error.message : 'Failed to create contract' };
    }
  }

  revokeConsent(aosConsentId: string, reason: string, revokedBy: string): Promise<boolean> {
    const contractId = this.consentToContract.get(aosConsentId);
    if (!contractId) {return Promise.resolve(false);}

    const record = this.consentRecords.get(aosConsentId);
    if (!record) {return Promise.resolve(false);}

    this.lcs.revokeContract(contractId, revokedBy, reason);
    record.active = false;
    this.consentRecords.set(aosConsentId, record);
    this.config.onConsentChange?.(record, 'revoked');
    return Promise.resolve(true);
  }

  checkAlignment(contractId?: string, aosConsentId?: string): Promise<ConsentAlignmentResult> {
    if (contractId) {
      const contract = this.lcs.getContract(contractId);
      if (!contract) {return Promise.resolve({ aligned: false, lc_contract_id: contractId, discrepancies: ['Contract not found'], recommended_action: 'none' });}

      const consentId = this.contractToConsent.get(contractId);
      if (!consentId) {return Promise.resolve({ aligned: false, lc_contract_id: contractId, discrepancies: ['No Agent-OS consent associated'], recommended_action: 'none' });}

      const record = this.consentRecords.get(consentId);
      if (!record) {return Promise.resolve({ aligned: false, lc_contract_id: contractId, aos_consent_id: consentId, discrepancies: ['Consent record not found'], recommended_action: 'none' });}

      const discrepancies: string[] = [];
      if (contract.state !== ContractState.ACTIVE && record.active) {discrepancies.push('Contract is not active but consent is still active');}
      if (contract.state === ContractState.ACTIVE && !record.active) {discrepancies.push('Contract is active but consent has been revoked');}

      return Promise.resolve({ aligned: discrepancies.length === 0, lc_contract_id: contractId, aos_consent_id: consentId, discrepancies: discrepancies.length > 0 ? discrepancies : undefined, recommended_action: discrepancies.length > 0 ? 'update_contract' : 'none' });
    }

    if (aosConsentId) {
      const record = this.consentRecords.get(aosConsentId);
      if (!record) {return Promise.resolve({ aligned: false, aos_consent_id: aosConsentId, discrepancies: ['Consent record not found'], recommended_action: 'create_contract' });}

      const contract = this.lcs.getContract(record.contract_id);
      if (!contract) {return Promise.resolve({ aligned: false, aos_consent_id: aosConsentId, lc_contract_id: record.contract_id, discrepancies: ['Associated contract not found'], recommended_action: 'create_contract' });}

      return Promise.resolve({ aligned: record.active && contract.state === ContractState.ACTIVE, lc_contract_id: record.contract_id, aos_consent_id: aosConsentId, recommended_action: 'none' });
    }

    return Promise.resolve({ aligned: false, discrepancies: ['No contract or consent ID provided'], recommended_action: 'none' });
  }

  syncAll(): Promise<{ synced: number; revoked: number; errors: string[] }> {
    let synced = 0;
    let revoked = 0;
    const errors: string[] = [];

    for (const [consentId, record] of this.consentRecords) {
      try {
        const contract = this.lcs.getContract(record.contract_id);
        if (!contract || contract.state === ContractState.EXPIRED || contract.state === ContractState.REVOKED) {
          if (record.active) {
            record.active = false;
            this.consentRecords.set(consentId, record);
            this.config.onConsentChange?.(record, 'revoked');
            revoked++;
          }
        }
        synced++;
      } catch (error) {
        errors.push(`Failed to sync consent ${consentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    return Promise.resolve({ synced, revoked, errors });
  }

  getConsentRecord(aosConsentId: string): ConsentRecord | undefined { return this.consentRecords.get(aosConsentId); }
  getConsentByContractId(contractId: string): ConsentRecord | undefined {
    const consentId = this.contractToConsent.get(contractId);
    return consentId ? this.consentRecords.get(consentId) : undefined;
  }
  getActiveConsents(): ConsentRecord[] { return Array.from(this.consentRecords.values()).filter((r) => r.active); }
  getConsentsForUser(userId: string): ConsentRecord[] { return Array.from(this.consentRecords.values()).filter((r) => r.user_id === userId); }

  private findMatchingContract(request: AgentOSConsentRequest): LearningContract | undefined {
    const contracts = this.lcs.getActiveContracts();
    const targetType = MEMORY_CLASS_TO_CONTRACT_TYPE[request.memory_class];
    return contracts.find((contract: LearningContract) => this.isContractTypeCompatible(contract.contract_type, targetType) && this.doesScopeMatch(contract, request));
  }

  private isContractTypeCompatible(contractType: ContractType, targetType: ContractType): boolean {
    if (contractType === ContractType.STRATEGIC) {return true;}
    if (contractType === ContractType.PROCEDURAL) {return targetType !== ContractType.STRATEGIC;}
    if (contractType === ContractType.EPISODIC) {return targetType === ContractType.EPISODIC || targetType === ContractType.OBSERVATION;}
    return contractType === targetType;
  }

  private doesScopeMatch(contract: LearningContract, request: AgentOSConsentRequest): boolean {
    if (!contract.scope.domains?.length) {return true;}
    return contract.scope.domains.some((d: string) => d === request.data_type || d === '*' || request.data_type.startsWith(d));
  }

  private createContractFromConsent(request: AgentOSConsentRequest): Promise<LearningContract> {
    const contractType = MEMORY_CLASS_TO_CONTRACT_TYPE[request.memory_class];
    const domains = this.config.default_domains ?? [request.data_type];
    const scope = { domains };

    let contract: LearningContract;
    switch (contractType) {
      case ContractType.OBSERVATION:
        contract = this.lcs.createObservationContract(request.user_id, scope);
        break;
      case ContractType.EPISODIC:
        contract = this.lcs.createEpisodicContract(request.user_id, scope);
        break;
      case ContractType.PROCEDURAL:
        contract = this.lcs.createProceduralContract(request.user_id, scope);
        break;
      case ContractType.STRATEGIC:
        contract = this.lcs.createStrategicContract(request.user_id, scope);
        break;
      default:
        throw new Error(`Unsupported contract type: ${contractType}`);
    }

    this.lcs.submitForReview(contract.contract_id, request.user_id);
    this.lcs.activateContract(contract.contract_id, request.user_id);
    return Promise.resolve(this.lcs.getContract(contract.contract_id)!);
  }

  private createConsentRecord(contractId: string, request: AgentOSConsentRequest, active: boolean): ConsentRecord {
    const aosConsentId = `aos_consent_${uuidv4()}`;
    const record: ConsentRecord = { contract_id: contractId, aos_consent_id: aosConsentId, memory_class: request.memory_class, user_id: request.user_id, purpose: request.purpose, granted_at: new Date(), active };
    if (request.retention_requested) {
      const duration = this.parseRetentionDuration(request.retention_requested);
      if (duration) {record.expires_at = new Date(Date.now() + duration);}
    }
    this.consentRecords.set(aosConsentId, record);
    this.contractToConsent.set(contractId, aosConsentId);
    this.consentToContract.set(aosConsentId, contractId);
    return record;
  }

  private getConditionsFromContract(contract: LearningContract): string[] {
    const conditions: string[] = [];
    if (contract.scope.domains?.length) {conditions.push(`Limited to domains: ${contract.scope.domains.join(', ')}`);}
    if (contract.scope.max_abstraction) {conditions.push(`Max abstraction: ${contract.scope.max_abstraction}`);}
    if (!contract.scope.transferable) {conditions.push('Non-transferable');}
    return conditions;
  }

  private parseRetentionDuration(duration: string): number | undefined {
    const match = duration.match(/^(\d+)\s*(h|hour|hours|d|day|days|w|week|weeks|m|month|months)$/i);
    if (!match) {return undefined;}
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 'h': case 'hour': case 'hours': return value * 3600000;
      case 'd': case 'day': case 'days': return value * 86400000;
      case 'w': case 'week': case 'weeks': return value * 604800000;
      case 'm': case 'month': case 'months': return value * 2592000000;
      default: return undefined;
    }
  }

  clear(): void {
    this.consentRecords.clear();
    this.contractToConsent.clear();
    this.consentToContract.clear();
  }

  getStats(): { total_consents: number; active_consents: number; expired_consents: number; by_memory_class: Record<AgentOSMemoryClass, number> } {
    const records = Array.from(this.consentRecords.values());
    const byClass: Record<AgentOSMemoryClass, number> = { [AgentOSMemoryClass.EPHEMERAL]: 0, [AgentOSMemoryClass.WORKING]: 0, [AgentOSMemoryClass.LONG_TERM]: 0 };
    for (const record of records) {byClass[record.memory_class]++;}
    return {
      total_consents: records.length,
      active_consents: records.filter((r) => r.active).length,
      expired_consents: records.filter((r) => r.expires_at && r.expires_at < new Date()).length,
      by_memory_class: byClass,
    };
  }
}
