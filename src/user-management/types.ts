/**
 * Multi-User Support Types
 *
 * Types for managing multiple concurrent users with access control.
 */

/**
 * Permission levels for contract access
 */
export enum PermissionLevel {
  /** Full control - can modify, revoke, share */
  OWNER = 'owner',
  /** Can use contract but not modify or share */
  DELEGATE = 'delegate',
  /** Can view contract details but not use */
  READER = 'reader',
}

/**
 * A permission grant for a specific user on a contract
 */
export interface ContractPermission {
  /** User ID granted the permission */
  user_id: string;
  /** Level of access */
  level: PermissionLevel;
  /** When permission was granted */
  granted_at: Date;
  /** Who granted the permission */
  granted_by: string;
  /** Optional expiration for temporary access */
  expires_at?: Date;
}

/**
 * Represents an active user connection
 */
export interface UserConnection {
  /** Unique connection ID */
  connection_id: string;
  /** User ID */
  user_id: string;
  /** Access point identifier (e.g., IP, device ID, terminal) */
  access_point: string;
  /** When connection was established */
  connected_at: Date;
  /** Last activity timestamp */
  last_activity: Date;
  /** Connection metadata */
  metadata?: Record<string, unknown>;
}

/**
 * User status in the system
 */
export enum UserStatus {
  /** User is connected */
  CONNECTED = 'connected',
  /** User is disconnected */
  DISCONNECTED = 'disconnected',
  /** User connection was forcibly terminated */
  KICKED = 'kicked',
}

/**
 * Represents a registered user
 */
export interface User {
  /** Unique user identifier */
  user_id: string;
  /** Display name */
  display_name?: string;
  /** When user was registered */
  registered_at: Date;
  /** Current connection status */
  status: UserStatus;
  /** Active connection (if connected) */
  connection?: UserConnection;
  /** User metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a connection attempt
 */
export interface ConnectionResult {
  success: boolean;
  connection_id?: string;
  user?: User;
  error?: string;
  /** If connection was denied because user already connected elsewhere */
  existing_connection?: UserConnection;
}

/**
 * Result of a disconnection
 */
export interface DisconnectionResult {
  success: boolean;
  user_id: string;
  duration_ms?: number;
  error?: string;
}

/**
 * Event when a user connects
 */
export interface UserConnectEvent {
  user_id: string;
  connection_id: string;
  access_point: string;
  timestamp: Date;
}

/**
 * Event when a user disconnects
 */
export interface UserDisconnectEvent {
  user_id: string;
  connection_id: string;
  access_point: string;
  timestamp: Date;
  reason: 'logout' | 'timeout' | 'kicked' | 'replaced';
  duration_ms: number;
}

/**
 * Event when a connection is rejected (user already connected)
 */
export interface ConnectionRejectedEvent {
  user_id: string;
  attempted_access_point: string;
  existing_access_point: string;
  timestamp: Date;
}

/**
 * Listener for user connect events
 */
export type UserConnectListener = (event: UserConnectEvent) => void;

/**
 * Listener for user disconnect events
 */
export type UserDisconnectListener = (event: UserDisconnectEvent) => void;

/**
 * Listener for connection rejected events
 */
export type ConnectionRejectedListener = (event: ConnectionRejectedEvent) => void;

/**
 * Configuration for UserManager
 */
export interface UserManagerConfig {
  /** Whether to allow replacing existing connections (default: false) */
  allow_connection_replace?: boolean;
  /** Inactivity timeout in ms (default: 30 minutes) */
  inactivity_timeout_ms?: number;
  /** Whether to auto-disconnect on timeout (default: false) */
  auto_disconnect_on_timeout?: boolean;
  /** Audit logger for events */
  auditLogger?: UserAuditLogger;
}

/**
 * Audit logger interface for user events
 */
export interface UserAuditLogger {
  logUserConnect(event: UserConnectEvent): void;
  logUserDisconnect(event: UserDisconnectEvent): void;
  logConnectionRejected(event: ConnectionRejectedEvent): void;
  logPermissionGranted(
    contractId: string,
    grantedTo: string,
    level: PermissionLevel,
    grantedBy: string
  ): void;
  logPermissionRevoked(
    contractId: string,
    revokedFrom: string,
    revokedBy: string
  ): void;
}

/**
 * Options for permission operations
 */
export interface GrantPermissionOptions {
  /** When the permission expires */
  expires_at?: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of checking permission
 */
export interface PermissionCheckResult {
  /** Whether the user has sufficient permission */
  allowed: boolean;
  /** The user's permission level (if any) */
  level?: PermissionLevel;
  /** Reason for denial (if not allowed) */
  reason?: string;
}

/**
 * User manager statistics
 */
export interface UserManagerStats {
  /** Total registered users */
  total_users: number;
  /** Currently connected users */
  connected_users: number;
  /** Total connections made */
  total_connections: number;
  /** Total disconnections */
  total_disconnections: number;
  /** Rejected connection attempts */
  rejected_connections: number;
}
