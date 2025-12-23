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
  User,
  UserConnection,
  ConnectionResult,
  DisconnectionResult,
  // Permission types
  ContractPermission,
  PermissionCheckResult,
  GrantPermissionOptions,
  // Event types
  UserConnectEvent,
  UserDisconnectEvent,
  ConnectionRejectedEvent,
  // Listener types
  UserConnectListener,
  UserDisconnectListener,
  ConnectionRejectedListener,
  // Config types
  UserManagerConfig,
  UserAuditLogger,
  // Stats
  UserManagerStats,
} from './types';
