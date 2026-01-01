/**
 * Boundary Daemon Connector Types
 *
 * Types for integrating with the Boundary Daemon for policy enforcement
 * and connection protection.
 */

/** Daemon connection configuration */
export interface DaemonConfig {
  /** Unix socket path for daemon communication */
  socket_path?: string;
  /** HTTP endpoint if using network mode */
  http_endpoint?: string;
  /** Connection timeout in ms */
  timeout_ms: number;
  /** Whether to use TLS for HTTP connections */
  use_tls: boolean;
  /** Client certificate for mutual TLS */
  client_cert?: string;
  /** Client key for mutual TLS */
  client_key?: string;
  /** CA certificate for verifying daemon */
  ca_cert?: string;
  /** Authentication token */
  auth_token?: string;
  /** Component name for identification */
  component_name: string;
  /** Component version */
  component_version: string;
  /** Reconnection settings */
  reconnect: {
    enabled: boolean;
    max_attempts: number;
    base_delay_ms: number;
    max_delay_ms: number;
  };
  /** Health check interval in ms */
  health_check_interval_ms: number;
}

/** Boundary modes from the daemon */
export enum DaemonBoundaryMode {
  /** Full network access */
  OPEN = 'OPEN',
  /** Limited network, monitored */
  RESTRICTED = 'RESTRICTED',
  /** VPN-only network */
  TRUSTED = 'TRUSTED',
  /** No network, local only */
  AIRGAP = 'AIRGAP',
  /** Encrypted storage only */
  COLDROOM = 'COLDROOM',
  /** Emergency shutdown */
  LOCKDOWN = 'LOCKDOWN',
}

/** Memory classification levels */
export enum DaemonClassificationLevel {
  /** Public information */
  PUBLIC = 0,
  /** Internal use only */
  INTERNAL = 1,
  /** Confidential */
  CONFIDENTIAL = 2,
  /** Sensitive */
  SENSITIVE = 3,
  /** Restricted */
  RESTRICTED = 4,
  /** Crown jewels - highest protection */
  CROWN_JEWEL = 5,
}

/** Classification cap per boundary mode */
export const CLASSIFICATION_CAPS: Record<DaemonBoundaryMode, number> = {
  [DaemonBoundaryMode.OPEN]: 1,
  [DaemonBoundaryMode.RESTRICTED]: 2,
  [DaemonBoundaryMode.TRUSTED]: 3,
  [DaemonBoundaryMode.AIRGAP]: 4,
  [DaemonBoundaryMode.COLDROOM]: 5,
  [DaemonBoundaryMode.LOCKDOWN]: -1, // No access
};

/** Policy decision result */
export interface PolicyDecision {
  /** Whether the operation is allowed */
  allowed: boolean;
  /** Reason for the decision */
  reason: string;
  /** Current boundary mode */
  boundary_mode: DaemonBoundaryMode;
  /** Required mode for operation (if denied) */
  required_mode?: DaemonBoundaryMode;
  /** Suggested remediation */
  remediation?: string;
  /** Decision timestamp */
  timestamp: Date;
  /** Unique decision ID */
  decision_id: string;
}

/** Policy request for the daemon */
export interface PolicyRequest {
  /** Type of operation */
  operation: PolicyOperation;
  /** Requesting component */
  component: string;
  /** Contract ID if applicable */
  contract_id?: string;
  /** Classification level of data */
  classification?: DaemonClassificationLevel;
  /** Domain of operation */
  domain?: string;
  /** Context of operation */
  context?: string;
  /** Network requirements */
  requires_network?: boolean;
  /** Target host if network required */
  target_host?: string;
  /** Target port if network required */
  target_port?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Types of operations that require policy decisions */
export enum PolicyOperation {
  /** Memory creation */
  MEMORY_CREATE = 'memory_create',
  /** Memory recall */
  MEMORY_RECALL = 'memory_recall',
  /** Memory export */
  MEMORY_EXPORT = 'memory_export',
  /** Abstraction/generalization */
  ABSTRACTION = 'abstraction',
  /** Contract creation */
  CONTRACT_CREATE = 'contract_create',
  /** Contract activation */
  CONTRACT_ACTIVATE = 'contract_activate',
  /** Tool execution */
  TOOL_EXECUTE = 'tool_execute',
  /** Network access */
  NETWORK_ACCESS = 'network_access',
  /** File access */
  FILE_ACCESS = 'file_access',
  /** External integration */
  EXTERNAL_INTEGRATION = 'external_integration',
}

/** Daemon status information */
export interface DaemonStatus {
  /** Whether daemon is connected */
  connected: boolean;
  /** Current boundary mode */
  boundary_mode: DaemonBoundaryMode;
  /** Daemon version */
  version: string;
  /** Uptime in seconds */
  uptime_seconds: number;
  /** Active sandboxes count */
  active_sandboxes: number;
  /** Active policies count */
  active_policies: number;
  /** Last mode change timestamp */
  last_mode_change?: Date;
  /** Health status */
  health: 'healthy' | 'degraded' | 'unhealthy';
  /** Health check latency in ms */
  latency_ms?: number;
}

/** Mode change event from daemon */
export interface ModeChangeEvent {
  /** Previous mode */
  previous_mode: DaemonBoundaryMode;
  /** New mode */
  new_mode: DaemonBoundaryMode;
  /** Reason for change */
  reason: string;
  /** Who triggered the change */
  triggered_by: string;
  /** Timestamp */
  timestamp: Date;
  /** Whether contracts should be suspended */
  suspend_contracts: boolean;
}

/** Tripwire event from daemon */
export interface TripwireEvent {
  /** Tripwire type */
  tripwire_type: string;
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Description */
  description: string;
  /** Affected component */
  affected_component?: string;
  /** Indicators of compromise */
  indicators?: Array<{
    type: string;
    value: string;
  }>;
  /** Timestamp */
  timestamp: Date;
  /** Automatic response taken */
  auto_response?: string;
}

/** Attestation request for component verification */
export interface AttestationRequest {
  /** Component name */
  component: string;
  /** Component version */
  version: string;
  /** Nonce for freshness */
  nonce: string;
  /** Capabilities requested */
  capabilities: string[];
}

/** Attestation response from daemon */
export interface AttestationResponse {
  /** Whether attestation succeeded */
  success: boolean;
  /** Attestation token (signed) */
  token?: string;
  /** Token expiration */
  expires_at?: Date;
  /** Granted capabilities */
  granted_capabilities?: string[];
  /** Denied capabilities with reasons */
  denied_capabilities?: Array<{
    capability: string;
    reason: string;
  }>;
  /** Failure reason if not successful */
  failure_reason?: string;
}

/** Connection protection settings */
export interface ConnectionProtection {
  /** Whether to encrypt connections */
  encrypt: boolean;
  /** Whether to use mutual TLS */
  mutual_tls: boolean;
  /** Allowed IP ranges */
  allowed_ip_ranges?: string[];
  /** Blocked IP ranges */
  blocked_ip_ranges?: string[];
  /** Rate limiting */
  rate_limit?: {
    requests_per_second: number;
    burst_size: number;
  };
  /** Connection timeout in ms */
  timeout_ms: number;
  /** Idle timeout in ms */
  idle_timeout_ms: number;
}

/** Event handlers for daemon events */
export interface DaemonEventHandlers {
  /** Called when mode changes */
  onModeChange?: (event: ModeChangeEvent) => void | Promise<void>;
  /** Called when tripwire triggers */
  onTripwire?: (event: TripwireEvent) => void | Promise<void>;
  /** Called when connection is established */
  onConnect?: () => void | Promise<void>;
  /** Called when connection is lost */
  onDisconnect?: (reason: string) => void | Promise<void>;
  /** Called when lockdown is triggered */
  onLockdown?: (reason: string) => void | Promise<void>;
}

/** Daemon command types */
export enum DaemonCommand {
  /** Get current status */
  STATUS = 'status',
  /** Request policy decision */
  POLICY = 'policy',
  /** Request attestation */
  ATTEST = 'attest',
  /** Report event */
  REPORT = 'report',
  /** Register component */
  REGISTER = 'register',
  /** Heartbeat */
  HEARTBEAT = 'heartbeat',
  /** Request mode change */
  MODE_CHANGE = 'mode_change',
  /** Emergency lockdown */
  LOCKDOWN = 'lockdown',
}

/** Daemon response wrapper */
export interface DaemonResponse<T = unknown> {
  /** Whether request succeeded */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  error_code?: string;
  /** Response timestamp */
  timestamp: Date;
  /** Request ID for correlation */
  request_id: string;
}
