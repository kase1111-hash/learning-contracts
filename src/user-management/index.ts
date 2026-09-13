/**
 * Multi-User Support Module
 *
 * Provides user management and contract permission sharing.
 */

export { UserManager } from './manager';
export { PermissionManager } from './permissions';

export {
  // Enums
  PermissionLevel,
  UserStatus,
  // User types
  type User,
  type UserConnection,
  type ConnectionResult,
  type DisconnectionResult,
  // Permission types
  type ContractPermission,
  type PermissionCheckResult,
  type GrantPermissionOptions,
  // Event types
  type UserConnectEvent,
  type UserDisconnectEvent,
  type ConnectionRejectedEvent,
  // Listener types
  type UserConnectListener,
  type UserDisconnectListener,
  type ConnectionRejectedListener,
  // Config types
  type UserManagerConfig,
  type UserAuditLogger,
  // Stats
  type UserManagerStats,
} from './types';
