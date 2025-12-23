/**
 * Boundary-Enforced System
 *
 * Integrates the Boundary Daemon with Learning Contracts to provide:
 * - Automatic contract suspension on boundary downgrade
 * - Automatic contract resumption on boundary upgrade
 * - Recall gate enforcement before memory access
 * - Tool gate enforcement for tool execution
 * - Real-time boundary mode monitoring
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DaemonBoundaryMode,
  RecallGateRequest,
  RecallGateResult,
  ToolGateRequest,
  ToolGateResult,
  BoundaryStatus,
  TripwireEvent,
  ContractSuspensionEvent,
  ContractResumeEvent,
  DAEMON_TO_LC_MODE,
} from './types';
import { BoundaryDaemonAdapter, ModeChangeListener, TripwireListener } from './adapter';
import { LearningContract, ContractState, BoundaryMode } from '../types';

/**
 * Contract suspension state
 */
interface SuspendedContract {
  /** Contract ID */
  contract_id: string;
  /** Suspension event */
  suspension_event: ContractSuspensionEvent;
  /** Original contract state */
  original_state: ContractState;
  /** Minimum required mode */
  required_mode: DaemonBoundaryMode;
}

/**
 * Contract resolver function type
 */
export type ContractResolver = (contract_id: string) => LearningContract | null;

/**
 * Active contracts provider function type
 */
export type ActiveContractsProvider = () => LearningContract[];

/**
 * Suspension event listener
 */
export type SuspensionListener = (event: ContractSuspensionEvent) => void;

/**
 * Resume event listener
 */
export type ResumeListener = (event: ContractResumeEvent) => void;

/**
 * Boundary event audit logger
 */
export type BoundaryAuditLogger = (event: BoundaryAuditEvent) => void;

/**
 * Boundary audit event
 */
export interface BoundaryAuditEvent {
  /** Event ID */
  event_id: string;
  /** Event type */
  event_type: 'mode_change' | 'suspension' | 'resume' | 'recall_gate' | 'tool_gate' | 'tripwire';
  /** Timestamp */
  timestamp: Date;
  /** Actor */
  actor: string;
  /** Contract ID (if applicable) */
  contract_id?: string;
  /** Details */
  details: Record<string, unknown>;
}

/**
 * Configuration for BoundaryEnforcedSystem
 */
export interface BoundaryEnforcedSystemConfig {
  /** Boundary daemon adapter */
  adapter: BoundaryDaemonAdapter;
  /** Contract resolver function */
  contractResolver: ContractResolver;
  /** Active contracts provider */
  activeContractsProvider: ActiveContractsProvider;
  /** Audit logger */
  auditLogger?: BoundaryAuditLogger;
  /** Auto-resume on upgrade */
  autoResumeOnUpgrade?: boolean;
}

/**
 * Mapping from Learning Contracts BoundaryMode to DaemonBoundaryMode
 */
const LC_MODE_TO_DAEMON: Record<BoundaryMode, DaemonBoundaryMode> = {
  [BoundaryMode.RESTRICTED]: DaemonBoundaryMode.RESTRICTED,
  [BoundaryMode.NORMAL]: DaemonBoundaryMode.OPEN,
  [BoundaryMode.TRUSTED]: DaemonBoundaryMode.TRUSTED,
  [BoundaryMode.PRIVILEGED]: DaemonBoundaryMode.AIRGAP,
};

/**
 * Order of daemon modes from least to most restrictive (higher index = more restrictive)
 */
const DAEMON_MODE_ORDER: DaemonBoundaryMode[] = [
  DaemonBoundaryMode.OPEN,
  DaemonBoundaryMode.RESTRICTED,
  DaemonBoundaryMode.TRUSTED,
  DaemonBoundaryMode.AIRGAP,
  DaemonBoundaryMode.COLDROOM,
  DaemonBoundaryMode.LOCKDOWN,
];

/**
 * Get mode restrictiveness index (higher = more restrictive)
 */
function getModeRestrictiveness(mode: DaemonBoundaryMode): number {
  return DAEMON_MODE_ORDER.indexOf(mode);
}

/**
 * Check if newMode is a downgrade from previousMode
 */
function isDowngrade(previousMode: DaemonBoundaryMode, newMode: DaemonBoundaryMode): boolean {
  return getModeRestrictiveness(newMode) < getModeRestrictiveness(previousMode);
}

/**
 * Boundary-Enforced System
 *
 * Provides boundary daemon integration with automatic contract management.
 */
export class BoundaryEnforcedSystem {
  private adapter: BoundaryDaemonAdapter;
  private resolveContract: ContractResolver;
  private getActiveContracts: ActiveContractsProvider;
  private logAudit: BoundaryAuditLogger;
  private autoResumeOnUpgrade: boolean;

  private suspendedContracts: Map<string, SuspendedContract> = new Map();
  private suspensionListeners: SuspensionListener[] = [];
  private resumeListeners: ResumeListener[] = [];
  private unsubscribeModeChange?: () => void;
  private unsubscribeTripwire?: () => void;

  private currentMode: DaemonBoundaryMode = DaemonBoundaryMode.OPEN;

  constructor(config: BoundaryEnforcedSystemConfig) {
    this.adapter = config.adapter;
    this.resolveContract = config.contractResolver;
    this.getActiveContracts = config.activeContractsProvider;
    this.logAudit = config.auditLogger ?? (() => {});
    this.autoResumeOnUpgrade = config.autoResumeOnUpgrade ?? true;

    // Subscribe to daemon events
    this.subscribeToEvents();
  }

  /**
   * Subscribe to daemon events
   */
  private subscribeToEvents(): void {
    this.unsubscribeModeChange = this.adapter.onModeChange(
      this.handleModeChange.bind(this)
    );

    this.unsubscribeTripwire = this.adapter.onTripwire(
      this.handleTripwire.bind(this)
    );
  }

  /**
   * Initialize system and sync with daemon
   */
  async initialize(): Promise<void> {
    const status = await this.adapter.getStatus();
    this.currentMode = status.mode;

    // Check all active contracts against current mode
    await this.evaluateAllContracts();
  }

  /**
   * Get current daemon mode
   */
  async getCurrentMode(): Promise<DaemonBoundaryMode> {
    this.currentMode = await this.adapter.getCurrentMode();
    return this.currentMode;
  }

  /**
   * Get cached current mode (without querying daemon)
   */
  getCachedMode(): DaemonBoundaryMode {
    return this.currentMode;
  }

  /**
   * Get full boundary status
   */
  async getStatus(): Promise<BoundaryStatus> {
    return this.adapter.getStatus();
  }

  /**
   * Check if a memory recall is allowed by the boundary daemon
   */
  async checkRecallGate(request: RecallGateRequest): Promise<RecallGateResult> {
    const result = await this.adapter.checkRecall(request);

    this.logAudit({
      event_id: uuidv4(),
      event_type: 'recall_gate',
      timestamp: new Date(),
      actor: request.requester ?? 'system',
      details: {
        memory_id: request.memory_id,
        memory_class: request.memory_class,
        allowed: result.allowed,
        current_mode: result.current_mode,
        reason: result.reason,
      },
    });

    return result;
  }

  /**
   * Check if a tool execution is allowed
   */
  async checkToolGate(request: ToolGateRequest): Promise<ToolGateResult> {
    const result = await this.adapter.checkTool(request);

    this.logAudit({
      event_id: uuidv4(),
      event_type: 'tool_gate',
      timestamp: new Date(),
      actor: 'system',
      details: {
        tool_name: request.tool_name,
        requires_network: request.requires_network,
        allowed: result.allowed,
        current_mode: result.current_mode,
        reason: result.reason,
      },
    });

    return result;
  }

  /**
   * Check if a contract can operate in the current boundary mode
   */
  canContractOperate(contract: LearningContract): boolean {
    // LOCKDOWN blocks all contracts
    if (this.currentMode === DaemonBoundaryMode.LOCKDOWN) {
      return false;
    }

    // Get required mode from contract
    const requiredLcMode = contract.recall_rules.boundary_mode_min;
    const requiredDaemonMode = LC_MODE_TO_DAEMON[requiredLcMode];

    // Check if current mode meets requirement
    // Higher restrictiveness = more capability (except LOCKDOWN)
    return getModeRestrictiveness(this.currentMode) >= getModeRestrictiveness(requiredDaemonMode);
  }

  /**
   * Get the minimum daemon mode required for a contract
   */
  getRequiredDaemonMode(contract: LearningContract): DaemonBoundaryMode {
    const requiredLcMode = contract.recall_rules.boundary_mode_min;
    return LC_MODE_TO_DAEMON[requiredLcMode];
  }

  /**
   * Get list of suspended contracts
   */
  getSuspendedContracts(): SuspendedContract[] {
    return Array.from(this.suspendedContracts.values());
  }

  /**
   * Check if a contract is suspended
   */
  isContractSuspended(contractId: string): boolean {
    return this.suspendedContracts.has(contractId);
  }

  /**
   * Manually suspend a contract
   */
  suspendContract(contractId: string, reason: string): ContractSuspensionEvent | null {
    const contract = this.resolveContract(contractId);
    if (!contract) return null;

    return this.doSuspendContract(contract, reason, this.currentMode, this.currentMode);
  }

  /**
   * Manually resume a contract
   */
  resumeContract(contractId: string, reason: string): ContractResumeEvent | null {
    const suspended = this.suspendedContracts.get(contractId);
    if (!suspended) return null;

    // Check if current mode allows resume
    if (!this.canContractOperate(this.resolveContract(contractId)!)) {
      return null;
    }

    return this.doResumeContract(suspended, reason);
  }

  /**
   * Register suspension listener
   */
  onSuspension(listener: SuspensionListener): () => void {
    this.suspensionListeners.push(listener);
    return () => {
      const index = this.suspensionListeners.indexOf(listener);
      if (index > -1) {
        this.suspensionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Register resume listener
   */
  onResume(listener: ResumeListener): () => void {
    this.resumeListeners.push(listener);
    return () => {
      const index = this.resumeListeners.indexOf(listener);
      if (index > -1) {
        this.resumeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Trigger emergency lockdown
   */
  async triggerLockdown(reason: string, actor: string): Promise<BoundaryStatus> {
    return this.adapter.triggerLockdown(reason, actor);
  }

  /**
   * Clean up subscriptions
   */
  destroy(): void {
    if (this.unsubscribeModeChange) {
      this.unsubscribeModeChange();
    }
    if (this.unsubscribeTripwire) {
      this.unsubscribeTripwire();
    }
  }

  /**
   * Handle mode change from daemon
   */
  private handleModeChange: ModeChangeListener = (
    previousMode: DaemonBoundaryMode,
    newMode: DaemonBoundaryMode,
    reason: string
  ) => {
    this.currentMode = newMode;

    this.logAudit({
      event_id: uuidv4(),
      event_type: 'mode_change',
      timestamp: new Date(),
      actor: 'boundary-daemon',
      details: {
        previous_mode: previousMode,
        new_mode: newMode,
        reason,
      },
    });

    // LOCKDOWN blocks everything - always suspend all contracts
    if (newMode === DaemonBoundaryMode.LOCKDOWN) {
      this.handleDowngrade(previousMode, newMode, reason);
    } else if (isDowngrade(previousMode, newMode)) {
      // On downgrade, check for contracts that need suspension
      this.handleDowngrade(previousMode, newMode, reason);
    } else if (this.autoResumeOnUpgrade) {
      // On upgrade, check for contracts that can be resumed
      this.handleUpgrade(previousMode, newMode, reason);
    }
  };

  /**
   * Handle tripwire event from daemon
   */
  private handleTripwire: TripwireListener = (event: TripwireEvent) => {
    this.logAudit({
      event_id: uuidv4(),
      event_type: 'tripwire',
      timestamp: new Date(),
      actor: 'boundary-daemon',
      details: {
        tripwire_type: event.tripwire_type,
        previous_mode: event.previous_mode,
        description: event.description,
      },
    });

    // Tripwires typically trigger lockdown, which will be handled by mode change
  };

  /**
   * Handle boundary downgrade
   */
  private handleDowngrade(
    previousMode: DaemonBoundaryMode,
    newMode: DaemonBoundaryMode,
    reason: string
  ): void {
    const activeContracts = this.getActiveContracts();

    for (const contract of activeContracts) {
      // Skip already suspended contracts
      if (this.suspendedContracts.has(contract.contract_id)) {
        continue;
      }

      // Check if contract can still operate
      if (!this.canContractOperate(contract)) {
        this.doSuspendContract(
          contract,
          `Boundary downgrade: ${reason}`,
          previousMode,
          newMode
        );
      }
    }
  }

  /**
   * Handle boundary upgrade
   */
  private handleUpgrade(
    _previousMode: DaemonBoundaryMode,
    _newMode: DaemonBoundaryMode,
    reason: string
  ): void {
    // Check suspended contracts that can now resume
    for (const suspended of this.suspendedContracts.values()) {
      const contract = this.resolveContract(suspended.contract_id);
      if (!contract) continue;

      if (this.canContractOperate(contract)) {
        this.doResumeContract(suspended, `Boundary upgrade: ${reason}`);
      }
    }
  }

  /**
   * Evaluate all active contracts against current mode
   */
  private async evaluateAllContracts(): Promise<void> {
    const activeContracts = this.getActiveContracts();

    for (const contract of activeContracts) {
      if (!this.canContractOperate(contract)) {
        this.doSuspendContract(
          contract,
          'Initial boundary evaluation',
          this.currentMode,
          this.currentMode
        );
      }
    }
  }

  /**
   * Perform contract suspension
   */
  private doSuspendContract(
    contract: LearningContract,
    reason: string,
    previousMode: DaemonBoundaryMode,
    newMode: DaemonBoundaryMode
  ): ContractSuspensionEvent {
    const event: ContractSuspensionEvent = {
      event_id: uuidv4(),
      contract_id: contract.contract_id,
      reason,
      previous_mode: previousMode,
      new_mode: newMode,
      timestamp: new Date(),
      temporary: true,
      resume_condition: `Boundary mode must be >= ${this.getRequiredDaemonMode(contract)}`,
    };

    const suspended: SuspendedContract = {
      contract_id: contract.contract_id,
      suspension_event: event,
      original_state: contract.state,
      required_mode: this.getRequiredDaemonMode(contract),
    };

    this.suspendedContracts.set(contract.contract_id, suspended);

    this.logAudit({
      event_id: event.event_id,
      event_type: 'suspension',
      timestamp: event.timestamp,
      actor: 'boundary-enforced-system',
      contract_id: contract.contract_id,
      details: {
        reason,
        previous_mode: previousMode,
        new_mode: newMode,
        required_mode: suspended.required_mode,
      },
    });

    // Notify listeners
    for (const listener of this.suspensionListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Suspension listener error:', e);
      }
    }

    return event;
  }

  /**
   * Perform contract resumption
   */
  private doResumeContract(
    suspended: SuspendedContract,
    reason: string
  ): ContractResumeEvent {
    const event: ContractResumeEvent = {
      event_id: uuidv4(),
      contract_id: suspended.contract_id,
      reason,
      current_mode: this.currentMode,
      timestamp: new Date(),
      suspension_event_id: suspended.suspension_event.event_id,
    };

    this.suspendedContracts.delete(suspended.contract_id);

    this.logAudit({
      event_id: event.event_id,
      event_type: 'resume',
      timestamp: event.timestamp,
      actor: 'boundary-enforced-system',
      contract_id: suspended.contract_id,
      details: {
        reason,
        current_mode: this.currentMode,
        suspension_event_id: event.suspension_event_id,
      },
    });

    // Notify listeners
    for (const listener of this.resumeListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Resume listener error:', e);
      }
    }

    return event;
  }

  /**
   * Get the underlying adapter
   */
  getAdapter(): BoundaryDaemonAdapter {
    return this.adapter;
  }

  /**
   * Convert Learning Contracts BoundaryMode to DaemonBoundaryMode
   */
  static toDaemonMode(lcMode: BoundaryMode): DaemonBoundaryMode {
    return LC_MODE_TO_DAEMON[lcMode];
  }

  /**
   * Convert DaemonBoundaryMode to Learning Contracts BoundaryMode
   */
  static toLcMode(daemonMode: DaemonBoundaryMode): BoundaryMode {
    const lcModeStr = DAEMON_TO_LC_MODE[daemonMode];
    return lcModeStr as BoundaryMode;
  }
}
