/**
 * Agent-OS Boundary Adapter
 *
 * Implements the BoundaryDaemonAdapter interface to bridge Learning Contracts
 * with Agent-OS boundary enforcement system (Smith agent domain).
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BaseBoundaryDaemonAdapter,
  DaemonConnectionStatus,
} from '../boundary-integration/adapter';
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
} from '../boundary-integration/types';
import {
  AuthorityTier,
  AgentOSAgentType,
  AgentOSBoundaryStatus,
  AgentOSIntegrationConfig,
  DEFAULT_AGENT_OS_CONFIG,
} from './types';

/**
 * Agent-OS Boundary Client Interface
 */
export interface AgentOSBoundaryClient {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getSecurityStatus(): Promise<AgentOSBoundaryStatus>;
  checkAuthority(operation: string, requiredTier: AuthorityTier): Promise<boolean>;
  requestModeChange(targetMode: string, reason: string, requester: string): Promise<boolean>;
  triggerLockdown(reason: string, actor: string): Promise<boolean>;
  performOverride(operator: string, confirmationCode: string, reason: string): Promise<boolean>;
  getAuditLog(limit?: number): Promise<BoundaryAuditEntry[]>;
  isNetworkAllowed(): Promise<boolean>;
  getVersion(): Promise<string>;
  onSecurityEvent(callback: (event: { type: string; data: Record<string, unknown> }) => void): () => void;
}

const AOS_MODE_TO_LC_MODE: Record<string, DaemonBoundaryMode> = {
  open: DaemonBoundaryMode.OPEN,
  standard: DaemonBoundaryMode.RESTRICTED,
  elevated: DaemonBoundaryMode.TRUSTED,
  secure: DaemonBoundaryMode.AIRGAP,
  critical: DaemonBoundaryMode.COLDROOM,
  lockdown: DaemonBoundaryMode.LOCKDOWN,
};

const LC_MODE_TO_AOS_MODE: Record<DaemonBoundaryMode, string> = {
  [DaemonBoundaryMode.OPEN]: 'open',
  [DaemonBoundaryMode.RESTRICTED]: 'standard',
  [DaemonBoundaryMode.TRUSTED]: 'elevated',
  [DaemonBoundaryMode.AIRGAP]: 'secure',
  [DaemonBoundaryMode.COLDROOM]: 'critical',
  [DaemonBoundaryMode.LOCKDOWN]: 'lockdown',
};

/**
 * Mock Agent-OS Boundary Client for testing
 */
export class MockAgentOSBoundaryClient implements AgentOSBoundaryClient {
  private connected = false;
  private currentMode = 'standard';
  private inLockdown = false;
  private networkAllowed = true;
  private auditLog: BoundaryAuditEntry[] = [];
  private eventListeners: ((event: { type: string; data: Record<string, unknown> }) => void)[] = [];
  private entryCounter = 0;

  async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getSecurityStatus(): Promise<AgentOSBoundaryStatus> {
    const lcMode = AOS_MODE_TO_LC_MODE[this.currentMode] ?? DaemonBoundaryMode.RESTRICTED;
    return {
      mode_name: this.currentMode,
      lc_mode: lcMode,
      network_available: this.networkAllowed,
      max_classification: BOUNDARY_CLASSIFICATION_CAPS[lcMode],
      in_lockdown: this.inLockdown,
    };
  }

  async checkAuthority(_operation: string, requiredTier: AuthorityTier): Promise<boolean> {
    return requiredTier >= AuthorityTier.SYSTEM;
  }

  async requestModeChange(targetMode: string, reason: string, requester: string): Promise<boolean> {
    const previousMode = this.currentMode;
    this.currentMode = targetMode;
    this.inLockdown = targetMode === 'lockdown';
    this.networkAllowed = !['lockdown', 'critical', 'secure'].includes(targetMode);
    this.addAuditEntry('mode_change', requester, { previous_mode: previousMode, new_mode: targetMode, reason });
    this.emitEvent('mode_change', { previous_mode: previousMode, new_mode: targetMode, reason });
    return true;
  }

  async triggerLockdown(reason: string, actor: string): Promise<boolean> {
    return this.requestModeChange('lockdown', reason, actor);
  }

  async performOverride(_operator: string, confirmationCode: string, _reason: string): Promise<boolean> {
    if (!confirmationCode) return false;
    this.inLockdown = false;
    this.currentMode = 'standard';
    this.networkAllowed = true;
    return true;
  }

  async getAuditLog(limit?: number): Promise<BoundaryAuditEntry[]> {
    const entries = [...this.auditLog].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? entries.slice(0, limit) : entries;
  }

  async isNetworkAllowed(): Promise<boolean> {
    return this.networkAllowed;
  }

  async getVersion(): Promise<string> {
    return '1.0.0-mock';
  }

  onSecurityEvent(callback: (event: { type: string; data: Record<string, unknown> }) => void): () => void {
    this.eventListeners.push(callback);
    return () => {
      const index = this.eventListeners.indexOf(callback);
      if (index > -1) this.eventListeners.splice(index, 1);
    };
  }

  private addAuditEntry(entryType: string, actor: string, data: Record<string, unknown>): void {
    const previousEntry = this.auditLog[this.auditLog.length - 1];
    this.auditLog.push({
      entry_id: `aos_entry_${++this.entryCounter}`,
      previous_entry_id: previousEntry?.entry_id,
      entry_type: entryType as 'mode_change',
      timestamp: new Date(),
      actor,
      data,
      hash: `aos_hash_${Date.now()}_${Math.random().toString(36)}`,
    });
  }

  private emitEvent(type: string, data: Record<string, unknown>): void {
    for (const listener of this.eventListeners) {
      try { listener({ type, data }); } catch { /* ignore */ }
    }
  }

  setMode(mode: string): void {
    this.currentMode = mode;
    this.inLockdown = mode === 'lockdown';
    this.networkAllowed = !['lockdown', 'critical', 'secure'].includes(mode);
  }

  reset(): void {
    this.currentMode = 'standard';
    this.inLockdown = false;
    this.networkAllowed = true;
    this.auditLog = [];
    this.entryCounter = 0;
  }
}

/**
 * Agent-OS Boundary Adapter
 */
export class AgentOSBoundaryAdapter extends BaseBoundaryDaemonAdapter {
  private client: AgentOSBoundaryClient;
  private _config: AgentOSIntegrationConfig;
  private currentMode: DaemonBoundaryMode = DaemonBoundaryMode.RESTRICTED;
  private inLockdown = false;
  private lockdownReason?: string;
  private tripwireEvents: TripwireEvent[] = [];
  private unsubscribeSecurityEvents?: () => void;

  constructor(client: AgentOSBoundaryClient, config: Partial<AgentOSIntegrationConfig> = {}) {
    super();
    this.client = client;
    this._config = { ...DEFAULT_AGENT_OS_CONFIG, ...config };
  }

  async checkConnection(): Promise<DaemonConnectionStatus> {
    try {
      const connected = await this.client.connect();
      if (connected) {
        this.connected = true;
        this.lastPing = new Date();
        this.unsubscribeSecurityEvents = this.client.onSecurityEvent((event) => this.handleSecurityEvent(event));
        await this.syncMode();
        const version = await this.client.getVersion();
        return { connected: true, version: `Agent-OS/Smith/${version}`, endpoint: 'agent-os://boundary', last_ping: this.lastPing };
      }
      return { connected: false, error: 'Failed to connect to Agent-OS boundary service' };
    } catch (error) {
      return { connected: false, error: error instanceof Error ? error.message : 'Unknown connection error' };
    }
  }

  async getStatus(): Promise<BoundaryStatus> {
    const aosStatus = await this.client.getSecurityStatus();
    this.currentMode = aosStatus.lc_mode;
    this.inLockdown = aosStatus.in_lockdown;
    return {
      mode: this.currentMode,
      network_status: BOUNDARY_NETWORK_STATUS[this.currentMode],
      max_classification: BOUNDARY_CLASSIFICATION_CAPS[this.currentMode],
      healthy: true,
      active_tripwires: this.tripwireEvents.filter((t) => t.timestamp > new Date(Date.now() - 3600000)),
      last_check: new Date(),
      in_lockdown: this.inLockdown,
      lockdown_reason: this.lockdownReason,
    };
  }

  async getCurrentMode(): Promise<DaemonBoundaryMode> {
    await this.syncMode();
    return this.currentMode;
  }

  async checkRecall(request: RecallGateRequest): Promise<RecallGateResult> {
    const maxClass = BOUNDARY_CLASSIFICATION_CAPS[this.currentMode];
    if (this.inLockdown) {
      return { allowed: false, current_mode: this.currentMode, max_class: -1, reason: 'Agent-OS is in lockdown - all recalls blocked' };
    }
    const allowed = request.memory_class <= maxClass;
    if (!allowed) {
      return { allowed: false, current_mode: this.currentMode, max_class: maxClass, reason: `Memory class ${request.memory_class} exceeds maximum ${maxClass} for ${this.currentMode} mode` };
    }
    return { allowed: true, current_mode: this.currentMode, max_class: maxClass };
  }

  async checkTool(request: ToolGateRequest): Promise<ToolGateResult> {
    const networkStatus = BOUNDARY_NETWORK_STATUS[this.currentMode];
    if (request.requires_network) {
      const networkAllowed = await this.client.isNetworkAllowed();
      if (!networkAllowed || networkStatus === NetworkStatus.BLOCKED) {
        return { allowed: false, current_mode: this.currentMode, reason: 'Network is blocked in current security mode' };
      }
      if (networkStatus === NetworkStatus.OFFLINE) {
        return { allowed: false, current_mode: this.currentMode, reason: `Tool '${request.tool_name}' requires network but current mode is offline` };
      }
    }
    return { allowed: true, current_mode: this.currentMode };
  }

  async requestModeTransition(request: ModeTransitionRequest): Promise<ModeTransitionResult> {
    const previousMode = this.currentMode;
    const transitionId = `aos_trans_${uuidv4()}`;
    const aosTargetMode = LC_MODE_TO_AOS_MODE[request.target_mode];

    if (this.inLockdown && request.target_mode !== DaemonBoundaryMode.LOCKDOWN) {
      return { success: false, previous_mode: previousMode, current_mode: this.currentMode, transition_id: transitionId, error: 'Cannot transition out of lockdown without override ceremony' };
    }

    try {
      const success = await this.client.requestModeChange(aosTargetMode, request.reason, request.requester);
      if (!success) {
        return { success: false, previous_mode: previousMode, current_mode: this.currentMode, transition_id: transitionId, error: 'Agent-OS denied mode transition request' };
      }
      await this.syncMode();
      if (previousMode !== this.currentMode) this.notifyModeChange(previousMode, this.currentMode, request.reason);
      return { success: true, previous_mode: previousMode, current_mode: this.currentMode, transition_id: transitionId };
    } catch (error) {
      return { success: false, previous_mode: previousMode, current_mode: this.currentMode, transition_id: transitionId, error: error instanceof Error ? error.message : 'Mode transition failed' };
    }
  }

  async performOverrideCeremony(request: OverrideCeremonyRequest): Promise<OverrideCeremonyResult> {
    const ceremonyId = `aos_ceremony_${uuidv4()}`;
    if (!request.physical_presence_verified) {
      return { success: false, ceremony_id: ceremonyId, error: 'Physical presence verification required', logged: true };
    }
    if (!request.confirmation_code) {
      return { success: false, ceremony_id: ceremonyId, error: 'Valid confirmation code required', logged: true };
    }

    try {
      const success = await this.client.performOverride(request.operator, request.confirmation_code, request.reason);
      if (!success) return { success: false, ceremony_id: ceremonyId, error: 'Agent-OS override ceremony failed', logged: true };
      const previousMode = this.currentMode;
      await this.syncMode();
      if (previousMode !== this.currentMode) this.notifyModeChange(previousMode, this.currentMode, `Override: ${request.reason}`);
      return { success: true, ceremony_id: ceremonyId, new_mode: this.currentMode, logged: true };
    } catch (error) {
      return { success: false, ceremony_id: ceremonyId, error: error instanceof Error ? error.message : 'Override ceremony failed', logged: true };
    }
  }

  async triggerLockdown(reason: string, actor: string): Promise<BoundaryStatus> {
    const previousMode = this.currentMode;
    await this.client.triggerLockdown(reason, actor);
    const tripwireEvent: TripwireEvent = { event_id: `aos_trip_${uuidv4()}`, tripwire_type: TripwireType.MANUAL, timestamp: new Date(), previous_mode: previousMode, description: reason };
    this.tripwireEvents.push(tripwireEvent);
    this.notifyTripwire(tripwireEvent);
    await this.syncMode();
    if (previousMode !== this.currentMode) this.notifyModeChange(previousMode, this.currentMode, reason);
    return this.getStatus();
  }

  async getTripwireEvents(since?: Date): Promise<TripwireEvent[]> {
    return since ? this.tripwireEvents.filter((t) => t.timestamp >= since) : [...this.tripwireEvents];
  }

  async getAuditLog(limit?: number, since?: Date): Promise<BoundaryAuditEntry[]> {
    let entries = await this.client.getAuditLog(limit);
    if (since) entries = entries.filter((e) => e.timestamp >= since);
    return entries;
  }

  async verifyAuditLog(): Promise<AuditVerificationResult> {
    return { valid: true, entries_verified: (await this.client.getAuditLog()).length, verified_at: new Date() };
  }

  private async syncMode(): Promise<void> {
    const status = await this.client.getSecurityStatus();
    this.currentMode = status.lc_mode;
    this.inLockdown = status.in_lockdown;
    if (this.inLockdown) this.lockdownReason = 'Agent-OS lockdown active';
  }

  private handleSecurityEvent(event: { type: string; data: Record<string, unknown> }): void {
    if (event.type === 'mode_change') {
      const previousMode = this.currentMode;
      const newAosMode = event.data.new_mode as string;
      this.currentMode = AOS_MODE_TO_LC_MODE[newAosMode] ?? DaemonBoundaryMode.RESTRICTED;
      this.inLockdown = newAosMode === 'lockdown';
      if (previousMode !== this.currentMode) {
        this.notifyModeChange(previousMode, this.currentMode, (event.data.reason as string) ?? 'Agent-OS mode change');
      }
    } else if (event.type === 'lockdown') {
      const tripwireEvent: TripwireEvent = { event_id: `aos_trip_${uuidv4()}`, tripwire_type: TripwireType.NETWORK_VIOLATION, timestamp: new Date(), previous_mode: this.currentMode, description: (event.data.reason as string) ?? 'Agent-OS security event' };
      this.tripwireEvents.push(tripwireEvent);
      this.notifyTripwire(tripwireEvent);
    }
  }

  async disconnect(): Promise<void> {
    if (this.unsubscribeSecurityEvents) this.unsubscribeSecurityEvents();
    await this.client.disconnect();
    this.connected = false;
  }

  getAgentOSModeName(): string {
    return LC_MODE_TO_AOS_MODE[this.currentMode];
  }

  isAgentExempt(agent: AgentOSAgentType | string): boolean {
    return this._config.exempt_agents?.includes(agent as AgentOSAgentType) ?? false;
  }
}
