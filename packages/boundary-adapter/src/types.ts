/**
 * Boundary Daemon Integration Types
 *
 * TypeScript type definitions matching the boundary-daemon Python package.
 * These types enable type-safe integration between Learning Contracts
 * and the Boundary Daemon trust enforcement layer.
 */

/**
 * Boundary modes from boundary-daemon
 *
 * Six distinct security postures, ordered from most permissive to most restrictive.
 * Higher modes have access to higher classification levels.
 */
export enum DaemonBoundaryMode {
  /** Unrestricted usage - Network online, Classes 0-1 */
  OPEN = 'open',
  /** Research work - Network online, Classes 0-2 */
  RESTRICTED = 'restricted',
  /** Protected operations - VPN only, Classes 0-3 */
  TRUSTED = 'trusted',
  /** High-value IP isolation - Offline, Classes 0-4 */
  AIRGAP = 'airgap',
  /** Critical asset protection - Offline, Classes 0-5 */
  COLDROOM = 'coldroom',
  /** Emergency response - All blocked */
  LOCKDOWN = 'lockdown',
}

/**
 * Memory classification levels allowed per boundary mode
 */
export const BOUNDARY_CLASSIFICATION_CAPS: Record<DaemonBoundaryMode, number> = {
  [DaemonBoundaryMode.OPEN]: 1,
  [DaemonBoundaryMode.RESTRICTED]: 2,
  [DaemonBoundaryMode.TRUSTED]: 3,
  [DaemonBoundaryMode.AIRGAP]: 4,
  [DaemonBoundaryMode.COLDROOM]: 5,
  [DaemonBoundaryMode.LOCKDOWN]: -1, // No access
};

/**
 * Network status for boundary modes
 */
export enum NetworkStatus {
  ONLINE = 'online',
  VPN_ONLY = 'vpn_only',
  OFFLINE = 'offline',
  BLOCKED = 'blocked',
}

/**
 * Network status per boundary mode
 */
export const BOUNDARY_NETWORK_STATUS: Record<DaemonBoundaryMode, NetworkStatus> = {
  [DaemonBoundaryMode.OPEN]: NetworkStatus.ONLINE,
  [DaemonBoundaryMode.RESTRICTED]: NetworkStatus.ONLINE,
  [DaemonBoundaryMode.TRUSTED]: NetworkStatus.VPN_ONLY,
  [DaemonBoundaryMode.AIRGAP]: NetworkStatus.OFFLINE,
  [DaemonBoundaryMode.COLDROOM]: NetworkStatus.OFFLINE,
  [DaemonBoundaryMode.LOCKDOWN]: NetworkStatus.BLOCKED,
};

/**
 * Tripwire types that can trigger lockdown
 */
export enum TripwireType {
  /** Network activity detected in AIRGAP mode */
  NETWORK_VIOLATION = 'network_violation',
  /** Physical media detected in COLDROOM mode */
  MEDIA_VIOLATION = 'media_violation',
  /** Unauthorized memory recall attempt */
  RECALL_VIOLATION = 'recall_violation',
  /** Daemon tampering detected */
  TAMPERING = 'tampering',
  /** Manual lockdown triggered */
  MANUAL = 'manual',
}

/**
 * Tripwire event from boundary daemon
 */
export interface TripwireEvent {
  /** Event ID */
  event_id: string;
  /** Type of tripwire triggered */
  tripwire_type: TripwireType;
  /** Timestamp */
  timestamp: Date;
  /** Previous boundary mode */
  previous_mode: DaemonBoundaryMode;
  /** Description of violation */
  description: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Recall gate check request
 */
export interface RecallGateRequest {
  /** Memory classification level (0-5) */
  memory_class: number;
  /** Memory ID being recalled */
  memory_id: string;
  /** Requester identity */
  requester?: string;
  /** Purpose/justification */
  purpose?: string;
}

/**
 * Recall gate check result
 */
export interface RecallGateResult {
  /** Whether recall is allowed */
  allowed: boolean;
  /** Current boundary mode */
  current_mode: DaemonBoundaryMode;
  /** Maximum allowed classification */
  max_class: number;
  /** Reason for denial (if denied) */
  reason?: string;
  /** Warnings (if allowed but with caveats) */
  warnings?: string[];
}

/**
 * Tool gate check request
 */
export interface ToolGateRequest {
  /** Tool name */
  tool_name: string;
  /** Whether tool requires network */
  requires_network: boolean;
  /** Additional tool properties */
  properties?: Record<string, unknown>;
}

/**
 * Tool gate check result
 */
export interface ToolGateResult {
  /** Whether tool is allowed */
  allowed: boolean;
  /** Current boundary mode */
  current_mode: DaemonBoundaryMode;
  /** Reason for denial (if denied) */
  reason?: string;
}

/**
 * Boundary status from daemon
 */
export interface BoundaryStatus {
  /** Current boundary mode */
  mode: DaemonBoundaryMode;
  /** Network status */
  network_status: NetworkStatus;
  /** Maximum memory classification allowed */
  max_classification: number;
  /** Whether daemon is healthy */
  healthy: boolean;
  /** Active tripwires (if any) */
  active_tripwires: TripwireEvent[];
  /** Last status check timestamp */
  last_check: Date;
  /** Whether in lockdown */
  in_lockdown: boolean;
  /** Lockdown reason (if in lockdown) */
  lockdown_reason?: string;
}

/**
 * Mode transition request
 */
export interface ModeTransitionRequest {
  /** Target mode */
  target_mode: DaemonBoundaryMode;
  /** Requester identity */
  requester: string;
  /** Reason for transition */
  reason: string;
  /** Override token (for privileged transitions) */
  override_token?: string;
}

/**
 * Mode transition result
 */
export interface ModeTransitionResult {
  /** Whether transition succeeded */
  success: boolean;
  /** Previous mode */
  previous_mode: DaemonBoundaryMode;
  /** Current mode (after transition) */
  current_mode: DaemonBoundaryMode;
  /** Transition ID for audit */
  transition_id: string;
  /** Error message (if failed) */
  error?: string;
  /** Whether cooldown is required */
  requires_cooldown?: boolean;
  /** Cooldown end time (if required) */
  cooldown_until?: Date;
}

/**
 * Human override ceremony request
 */
export interface OverrideCeremonyRequest {
  /** Target mode */
  target_mode: DaemonBoundaryMode;
  /** Human operator identity */
  operator: string;
  /** Confirmation code (multi-step) */
  confirmation_code: string;
  /** Physical presence verified */
  physical_presence_verified: boolean;
  /** Reason for override */
  reason: string;
}

/**
 * Human override ceremony result
 */
export interface OverrideCeremonyResult {
  /** Whether ceremony succeeded */
  success: boolean;
  /** Ceremony ID */
  ceremony_id: string;
  /** New mode (if successful) */
  new_mode?: DaemonBoundaryMode;
  /** Error message (if failed) */
  error?: string;
  /** Ceremony logged */
  logged: boolean;
}

/**
 * Audit log entry from boundary daemon
 */
export interface BoundaryAuditEntry {
  /** Entry ID (hash-chained) */
  entry_id: string;
  /** Previous entry ID (for chain verification) */
  previous_entry_id?: string;
  /** Entry type */
  entry_type: 'mode_change' | 'recall_check' | 'tool_check' | 'tripwire' | 'override' | 'status';
  /** Timestamp */
  timestamp: Date;
  /** Actor */
  actor: string;
  /** Entry data */
  data: Record<string, unknown>;
  /** Entry hash */
  hash: string;
}

/**
 * Audit log verification result
 */
export interface AuditVerificationResult {
  /** Whether log is valid */
  valid: boolean;
  /** Number of entries verified */
  entries_verified: number;
  /** First invalid entry (if invalid) */
  first_invalid_entry?: string;
  /** Verification timestamp */
  verified_at: Date;
}

/**
 * Mapping from Learning Contracts BoundaryMode to Daemon modes
 *
 * Learning Contracts uses 4 modes, Daemon uses 6.
 * This maps LC modes to their closest Daemon equivalents.
 */
export const LC_TO_DAEMON_MODE: Record<string, DaemonBoundaryMode> = {
  restricted: DaemonBoundaryMode.RESTRICTED,
  normal: DaemonBoundaryMode.OPEN,
  trusted: DaemonBoundaryMode.TRUSTED,
  privileged: DaemonBoundaryMode.AIRGAP,
};

/**
 * Mapping from Daemon modes to Learning Contracts BoundaryMode
 */
export const DAEMON_TO_LC_MODE: Record<DaemonBoundaryMode, string> = {
  [DaemonBoundaryMode.OPEN]: 'normal',
  [DaemonBoundaryMode.RESTRICTED]: 'restricted',
  [DaemonBoundaryMode.TRUSTED]: 'trusted',
  [DaemonBoundaryMode.AIRGAP]: 'privileged',
  [DaemonBoundaryMode.COLDROOM]: 'privileged',
  [DaemonBoundaryMode.LOCKDOWN]: 'restricted', // Most restrictive LC mode
};

/**
 * Contract suspension event
 */
export interface ContractSuspensionEvent {
  /** Event ID */
  event_id: string;
  /** Contract ID being suspended */
  contract_id: string;
  /** Reason for suspension */
  reason: string;
  /** Previous boundary mode */
  previous_mode: DaemonBoundaryMode;
  /** New boundary mode (that triggered suspension) */
  new_mode: DaemonBoundaryMode;
  /** Timestamp */
  timestamp: Date;
  /** Whether suspension is temporary */
  temporary: boolean;
  /** Resume condition (if temporary) */
  resume_condition?: string;
}

/**
 * Contract resume event
 */
export interface ContractResumeEvent {
  /** Event ID */
  event_id: string;
  /** Contract ID being resumed */
  contract_id: string;
  /** Reason for resume */
  reason: string;
  /** Current boundary mode */
  current_mode: DaemonBoundaryMode;
  /** Timestamp */
  timestamp: Date;
  /** Corresponding suspension event ID */
  suspension_event_id: string;
}

/**
 * Options for boundary-enforced operations
 */
export interface BoundaryEnforcedOptions {
  /** Require specific minimum mode */
  require_mode?: DaemonBoundaryMode;
  /** Skip network check */
  skip_network_check?: boolean;
  /** Override actor for logging */
  actor?: string;
}
