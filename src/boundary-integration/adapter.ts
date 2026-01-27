/**
 * Boundary Daemon Adapter Interface
 *
 * Abstract interface defining how Learning Contracts communicates with
 * the Boundary Daemon trust enforcement layer. Supports different implementations:
 * - Unix Socket adapter (for local daemon)
 * - HTTP API adapter (for remote daemon)
 * - Mock adapter (for testing)
 */

import {
  DaemonBoundaryMode,
  NetworkStatus,
  BoundaryStatus,
  RecallGateRequest,
  RecallGateResult,
  ToolGateRequest,
  ToolGateResult,
  ModeTransitionRequest,
  ModeTransitionResult,
  OverrideCeremonyRequest,
  OverrideCeremonyResult,
  TripwireEvent,
  TripwireType,
  BoundaryAuditEntry,
  AuditVerificationResult,
  BOUNDARY_CLASSIFICATION_CAPS,
  BOUNDARY_NETWORK_STATUS,
} from './types';

/**
 * Daemon connection status
 */
export interface DaemonConnectionStatus {
  /** Whether daemon is connected */
  connected: boolean;
  /** Daemon version (if connected) */
  version?: string;
  /** Socket/endpoint path */
  endpoint?: string;
  /** Last successful ping */
  last_ping?: Date;
  /** Error message (if not connected) */
  error?: string;
}

/**
 * Mode change listener callback
 */
export type ModeChangeListener = (
  previousMode: DaemonBoundaryMode,
  newMode: DaemonBoundaryMode,
  reason: string
) => void;

/**
 * Tripwire listener callback
 */
export type TripwireListener = (event: TripwireEvent) => void;

/**
 * Boundary Daemon Adapter Interface
 */
export interface BoundaryDaemonAdapter {
  /**
   * Check connection to the daemon
   */
  checkConnection(): Promise<DaemonConnectionStatus>;

  /**
   * Get current boundary status
   */
  getStatus(): Promise<BoundaryStatus>;

  /**
   * Get current boundary mode
   */
  getCurrentMode(): Promise<DaemonBoundaryMode>;

  /**
   * Check if a memory recall is allowed
   */
  checkRecall(request: RecallGateRequest): Promise<RecallGateResult>;

  /**
   * Check if a tool execution is allowed
   */
  checkTool(request: ToolGateRequest): Promise<ToolGateResult>;

  /**
   * Request mode transition
   */
  requestModeTransition(request: ModeTransitionRequest): Promise<ModeTransitionResult>;

  /**
   * Perform human override ceremony
   */
  performOverrideCeremony(request: OverrideCeremonyRequest): Promise<OverrideCeremonyResult>;

  /**
   * Trigger lockdown
   */
  triggerLockdown(reason: string, actor: string): Promise<BoundaryStatus>;

  /**
   * Get tripwire events
   */
  getTripwireEvents(since?: Date): Promise<TripwireEvent[]>;

  /**
   * Get audit log entries
   */
  getAuditLog(limit?: number, since?: Date): Promise<BoundaryAuditEntry[]>;

  /**
   * Verify audit log integrity
   */
  verifyAuditLog(): Promise<AuditVerificationResult>;

  /**
   * Register mode change listener
   */
  onModeChange(listener: ModeChangeListener): () => void;

  /**
   * Register tripwire listener
   */
  onTripwire(listener: TripwireListener): () => void;
}

/**
 * Abstract base class for Boundary Daemon adapters
 */
export abstract class BaseBoundaryDaemonAdapter implements BoundaryDaemonAdapter {
  protected connected: boolean = false;
  protected lastPing?: Date;
  protected modeChangeListeners: ModeChangeListener[] = [];
  protected tripwireListeners: TripwireListener[] = [];

  abstract checkConnection(): Promise<DaemonConnectionStatus>;
  abstract getStatus(): Promise<BoundaryStatus>;
  abstract getCurrentMode(): Promise<DaemonBoundaryMode>;
  abstract checkRecall(request: RecallGateRequest): Promise<RecallGateResult>;
  abstract checkTool(request: ToolGateRequest): Promise<ToolGateResult>;
  abstract requestModeTransition(request: ModeTransitionRequest): Promise<ModeTransitionResult>;
  abstract performOverrideCeremony(request: OverrideCeremonyRequest): Promise<OverrideCeremonyResult>;
  abstract triggerLockdown(reason: string, actor: string): Promise<BoundaryStatus>;
  abstract getTripwireEvents(since?: Date): Promise<TripwireEvent[]>;
  abstract getAuditLog(limit?: number, since?: Date): Promise<BoundaryAuditEntry[]>;
  abstract verifyAuditLog(): Promise<AuditVerificationResult>;

  /**
   * Register mode change listener
   */
  onModeChange(listener: ModeChangeListener): () => void {
    this.modeChangeListeners.push(listener);
    return () => {
      const index = this.modeChangeListeners.indexOf(listener);
      if (index > -1) {
        this.modeChangeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Register tripwire listener
   */
  onTripwire(listener: TripwireListener): () => void {
    this.tripwireListeners.push(listener);
    return () => {
      const index = this.tripwireListeners.indexOf(listener);
      if (index > -1) {
        this.tripwireListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify mode change listeners
   */
  protected notifyModeChange(
    previousMode: DaemonBoundaryMode,
    newMode: DaemonBoundaryMode,
    reason: string
  ): void {
    for (const listener of this.modeChangeListeners) {
      try {
        listener(previousMode, newMode, reason);
      } catch (e) {
        console.error('Mode change listener error:', e);
      }
    }
  }

  /**
   * Notify tripwire listeners
   */
  protected notifyTripwire(event: TripwireEvent): void {
    for (const listener of this.tripwireListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Tripwire listener error:', e);
      }
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Mock Boundary Daemon Adapter for Testing
 *
 * In-memory implementation that doesn't require actual daemon.
 * Useful for unit tests and development.
 */
export class MockBoundaryDaemonAdapter extends BaseBoundaryDaemonAdapter {
  private currentMode: DaemonBoundaryMode = DaemonBoundaryMode.OPEN;
  private inLockdown: boolean = false;
  private lockdownReason?: string;
  private tripwireEvents: TripwireEvent[] = [];
  private auditEntries: BoundaryAuditEntry[] = [];
  private entryCounter: number = 0;

  constructor(initialMode: DaemonBoundaryMode = DaemonBoundaryMode.OPEN) {
    super();
    this.currentMode = initialMode;
  }

  checkConnection(): Promise<DaemonConnectionStatus> {
    this.connected = true;
    this.lastPing = new Date();
    return Promise.resolve({
      connected: true,
      version: '1.0.0-mock',
      endpoint: 'mock://boundary-daemon',
      last_ping: this.lastPing,
    });
  }

  getStatus(): Promise<BoundaryStatus> {
    return Promise.resolve({
      mode: this.currentMode,
      network_status: BOUNDARY_NETWORK_STATUS[this.currentMode],
      max_classification: BOUNDARY_CLASSIFICATION_CAPS[this.currentMode],
      healthy: true,
      active_tripwires: this.tripwireEvents.filter(
        t => t.timestamp > new Date(Date.now() - 3600000) // Last hour
      ),
      last_check: new Date(),
      in_lockdown: this.inLockdown,
      lockdown_reason: this.lockdownReason,
    });
  }

  getCurrentMode(): Promise<DaemonBoundaryMode> {
    return Promise.resolve(this.currentMode);
  }

  checkRecall(request: RecallGateRequest): Promise<RecallGateResult> {
    const maxClass = BOUNDARY_CLASSIFICATION_CAPS[this.currentMode];

    // Lockdown blocks all recalls
    if (this.inLockdown) {
      this.addAuditEntry('recall_check', 'system', {
        memory_id: request.memory_id,
        memory_class: request.memory_class,
        allowed: false,
        reason: 'Lockdown active',
      });

      return Promise.resolve({
        allowed: false,
        current_mode: this.currentMode,
        max_class: -1,
        reason: 'Vault is in lockdown - all recalls blocked',
      });
    }

    const allowed = request.memory_class <= maxClass;

    this.addAuditEntry('recall_check', request.requester ?? 'unknown', {
      memory_id: request.memory_id,
      memory_class: request.memory_class,
      allowed,
      max_class: maxClass,
    });

    if (!allowed) {
      return Promise.resolve({
        allowed: false,
        current_mode: this.currentMode,
        max_class: maxClass,
        reason: `Memory class ${request.memory_class} exceeds maximum ${maxClass} for ${this.currentMode} mode`,
      });
    }

    return Promise.resolve({
      allowed: true,
      current_mode: this.currentMode,
      max_class: maxClass,
    });
  }

  checkTool(request: ToolGateRequest): Promise<ToolGateResult> {
    const networkStatus = BOUNDARY_NETWORK_STATUS[this.currentMode];

    // Check network requirement
    if (request.requires_network) {
      if (networkStatus === NetworkStatus.BLOCKED) {
        return Promise.resolve({
          allowed: false,
          current_mode: this.currentMode,
          reason: 'Network is blocked in lockdown mode',
        });
      }

      if (networkStatus === NetworkStatus.OFFLINE) {
        return Promise.resolve({
          allowed: false,
          current_mode: this.currentMode,
          reason: `Tool '${request.tool_name}' requires network but current mode is offline`,
        });
      }
    }

    this.addAuditEntry('tool_check', 'system', {
      tool_name: request.tool_name,
      requires_network: request.requires_network,
      allowed: true,
    });

    return Promise.resolve({
      allowed: true,
      current_mode: this.currentMode,
    });
  }

  requestModeTransition(request: ModeTransitionRequest): Promise<ModeTransitionResult> {
    const previousMode = this.currentMode;
    const transitionId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Can't transition out of lockdown without override
    if (this.inLockdown && request.target_mode !== DaemonBoundaryMode.LOCKDOWN) {
      return Promise.resolve({
        success: false,
        previous_mode: previousMode,
        current_mode: this.currentMode,
        transition_id: transitionId,
        error: 'Cannot transition out of lockdown without override ceremony',
      });
    }

    // Check if downgrade requires cooldown
    const modeOrder = [
      DaemonBoundaryMode.LOCKDOWN,
      DaemonBoundaryMode.COLDROOM,
      DaemonBoundaryMode.AIRGAP,
      DaemonBoundaryMode.TRUSTED,
      DaemonBoundaryMode.RESTRICTED,
      DaemonBoundaryMode.OPEN,
    ];

    const currentIndex = modeOrder.indexOf(this.currentMode);
    const targetIndex = modeOrder.indexOf(request.target_mode);

    // Upgrading security (lower index = more secure)
    if (targetIndex < currentIndex) {
      // Upgrade is immediate
      this.currentMode = request.target_mode;
      if (request.target_mode === DaemonBoundaryMode.LOCKDOWN) {
        this.inLockdown = true;
        this.lockdownReason = request.reason;
      }
    } else {
      // Downgrading requires cooldown for significant changes
      const requiresCooldown = targetIndex - currentIndex > 1;
      if (requiresCooldown && !request.override_token) {
        return Promise.resolve({
          success: false,
          previous_mode: previousMode,
          current_mode: this.currentMode,
          transition_id: transitionId,
          error: 'Significant downgrade requires override token',
          requires_cooldown: true,
          cooldown_until: new Date(Date.now() + 300000), // 5 minutes
        });
      }

      this.currentMode = request.target_mode;
    }

    this.addAuditEntry('mode_change', request.requester, {
      previous_mode: previousMode,
      new_mode: this.currentMode,
      reason: request.reason,
    });

    // Notify listeners
    if (previousMode !== this.currentMode) {
      this.notifyModeChange(previousMode, this.currentMode, request.reason);
    }

    return Promise.resolve({
      success: true,
      previous_mode: previousMode,
      current_mode: this.currentMode,
      transition_id: transitionId,
    });
  }

  performOverrideCeremony(request: OverrideCeremonyRequest): Promise<OverrideCeremonyResult> {
    const ceremonyId = `ceremony_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate physical presence
    if (!request.physical_presence_verified) {
      return Promise.resolve({
        success: false,
        ceremony_id: ceremonyId,
        error: 'Physical presence verification required',
        logged: true,
      });
    }

    // Validate confirmation code (in mock, just check it's not empty)
    if (!request.confirmation_code) {
      return Promise.resolve({
        success: false,
        ceremony_id: ceremonyId,
        error: 'Valid confirmation code required',
        logged: true,
      });
    }

    const previousMode = this.currentMode;
    this.currentMode = request.target_mode;

    if (request.target_mode !== DaemonBoundaryMode.LOCKDOWN) {
      this.inLockdown = false;
      this.lockdownReason = undefined;
    }

    this.addAuditEntry('override', request.operator, {
      ceremony_id: ceremonyId,
      previous_mode: previousMode,
      new_mode: this.currentMode,
      reason: request.reason,
      physical_presence: true,
    });

    // Notify listeners
    if (previousMode !== this.currentMode) {
      this.notifyModeChange(previousMode, this.currentMode, `Override: ${request.reason}`);
    }

    return Promise.resolve({
      success: true,
      ceremony_id: ceremonyId,
      new_mode: this.currentMode,
      logged: true,
    });
  }

  async triggerLockdown(reason: string, actor: string): Promise<BoundaryStatus> {
    const previousMode = this.currentMode;
    this.currentMode = DaemonBoundaryMode.LOCKDOWN;
    this.inLockdown = true;
    this.lockdownReason = reason;

    const tripwireEvent: TripwireEvent = {
      event_id: `trip_${Date.now()}`,
      tripwire_type: TripwireType.MANUAL,
      timestamp: new Date(),
      previous_mode: previousMode,
      description: reason,
    };

    this.tripwireEvents.push(tripwireEvent);
    this.notifyTripwire(tripwireEvent);

    this.addAuditEntry('tripwire', actor, {
      type: 'manual_lockdown',
      previous_mode: previousMode,
      reason,
    });

    if (previousMode !== this.currentMode) {
      this.notifyModeChange(previousMode, this.currentMode, reason);
    }

    return this.getStatus();
  }

  getTripwireEvents(since?: Date): Promise<TripwireEvent[]> {
    if (since) {
      return Promise.resolve(this.tripwireEvents.filter(t => t.timestamp >= since));
    }
    return Promise.resolve([...this.tripwireEvents]);
  }

  getAuditLog(limit?: number, since?: Date): Promise<BoundaryAuditEntry[]> {
    let entries = [...this.auditEntries];

    if (since) {
      entries = entries.filter(e => e.timestamp >= since);
    }

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      entries = entries.slice(0, limit);
    }

    return Promise.resolve(entries);
  }

  verifyAuditLog(): Promise<AuditVerificationResult> {
    // In mock, always valid
    return Promise.resolve({
      valid: true,
      entries_verified: this.auditEntries.length,
      verified_at: new Date(),
    });
  }

  /**
   * Add an audit entry (internal)
   */
  private addAuditEntry(
    entryType: 'mode_change' | 'recall_check' | 'tool_check' | 'tripwire' | 'override' | 'status',
    actor: string,
    data: Record<string, unknown>
  ): void {
    const previousEntry = this.auditEntries[this.auditEntries.length - 1];

    const entry: BoundaryAuditEntry = {
      entry_id: `entry_${++this.entryCounter}`,
      previous_entry_id: previousEntry?.entry_id,
      entry_type: entryType,
      timestamp: new Date(),
      actor,
      data,
      hash: `hash_${Date.now()}_${Math.random().toString(36)}`,
    };

    this.auditEntries.push(entry);
  }

  /**
   * Simulate a tripwire (for testing)
   */
  simulateTripwire(type: TripwireType, description: string): void {
    const event: TripwireEvent = {
      event_id: `trip_${Date.now()}`,
      tripwire_type: type,
      timestamp: new Date(),
      previous_mode: this.currentMode,
      description,
    };

    this.tripwireEvents.push(event);

    // Auto-lockdown on tripwire
    if (type !== TripwireType.MANUAL) {
      this.currentMode = DaemonBoundaryMode.LOCKDOWN;
      this.inLockdown = true;
      this.lockdownReason = description;
    }

    this.notifyTripwire(event);
    this.notifyModeChange(event.previous_mode, DaemonBoundaryMode.LOCKDOWN, description);
  }

  /**
   * Reset to initial state (for testing)
   */
  reset(mode: DaemonBoundaryMode = DaemonBoundaryMode.OPEN): void {
    this.currentMode = mode;
    this.inLockdown = false;
    this.lockdownReason = undefined;
    this.tripwireEvents = [];
    this.auditEntries = [];
    this.entryCounter = 0;
  }

  /**
   * Set mode directly (for testing)
   */
  setMode(mode: DaemonBoundaryMode): void {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    this.inLockdown = mode === DaemonBoundaryMode.LOCKDOWN;

    if (previousMode !== mode) {
      this.notifyModeChange(previousMode, mode, 'Direct mode set (testing)');
    }
  }
}
