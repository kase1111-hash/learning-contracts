/**
 * User Manager
 *
 * Manages multiple concurrent users with one instance per user enforcement.
 */

import {
  User,
  UserConnection,
  UserStatus,
  ConnectionResult,
  DisconnectionResult,
  UserConnectEvent,
  UserDisconnectEvent,
  ConnectionRejectedEvent,
  UserConnectListener,
  UserDisconnectListener,
  ConnectionRejectedListener,
  UserManagerConfig,
  UserManagerStats,
  UserAuditLogger,
} from './types';

/**
 * Generates a unique ID
 */
function generateId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Manages user connections with one-instance-per-user enforcement
 */
export class UserManager {
  private users: Map<string, User> = new Map();
  private connections: Map<string, UserConnection> = new Map();
  private config: Required<Omit<UserManagerConfig, 'auditLogger'>> & {
    auditLogger?: UserAuditLogger;
  };

  // Statistics
  private stats: UserManagerStats = {
    total_users: 0,
    connected_users: 0,
    total_connections: 0,
    total_disconnections: 0,
    rejected_connections: 0,
  };

  // Event listeners
  private connectListeners: UserConnectListener[] = [];
  private disconnectListeners: UserDisconnectListener[] = [];
  private rejectedListeners: ConnectionRejectedListener[] = [];

  // Timeout timer
  private timeoutTimer?: ReturnType<typeof setInterval>;

  constructor(config: UserManagerConfig = {}) {
    this.config = {
      allow_connection_replace: config.allow_connection_replace ?? false,
      inactivity_timeout_ms: config.inactivity_timeout_ms ?? 30 * 60 * 1000, // 30 minutes
      auto_disconnect_on_timeout: config.auto_disconnect_on_timeout ?? false,
      auditLogger: config.auditLogger,
    };
  }

  /**
   * Registers a new user (does not connect them)
   */
  registerUser(userId: string, displayName?: string, metadata?: Record<string, unknown>): User {
    let user = this.users.get(userId);
    if (user) {
      // Update existing user
      if (displayName !== undefined) {
        user.display_name = displayName;
      }
      if (metadata !== undefined) {
        user.metadata = { ...user.metadata, ...metadata };
      }
      return { ...user };
    }

    // Create new user
    user = {
      user_id: userId,
      display_name: displayName,
      registered_at: new Date(),
      status: UserStatus.DISCONNECTED,
      metadata,
    };
    this.users.set(userId, user);
    this.stats.total_users++;

    return { ...user };
  }

  /**
   * Connects a user from an access point
   * Enforces one instance per user
   */
  connect(
    userId: string,
    accessPoint: string,
    metadata?: Record<string, unknown>
  ): ConnectionResult {
    // Get or create user - always work with the object in the map
    if (!this.users.has(userId)) {
      this.registerUser(userId);
    }
    let user = this.users.get(userId)!;

    // Check if already connected
    if (user.status === UserStatus.CONNECTED && user.connection) {
      if (this.config.allow_connection_replace) {
        // Disconnect existing connection first
        this.disconnect(userId, 'replaced');
        // Re-fetch user after disconnect
        user = this.users.get(userId)!;
      } else {
        // Reject new connection
        const rejectedEvent: ConnectionRejectedEvent = {
          user_id: userId,
          attempted_access_point: accessPoint,
          existing_access_point: user.connection.access_point,
          timestamp: new Date(),
        };

        this.stats.rejected_connections++;
        this.notifyRejectedListeners(rejectedEvent);

        if (this.config.auditLogger) {
          this.config.auditLogger.logConnectionRejected(rejectedEvent);
        }

        return {
          success: false,
          error: `User ${userId} is already connected from ${user.connection.access_point}`,
          existing_connection: { ...user.connection },
        };
      }
    }

    // Create new connection
    const connectionId = generateId();
    const now = new Date();
    const connection: UserConnection = {
      connection_id: connectionId,
      user_id: userId,
      access_point: accessPoint,
      connected_at: now,
      last_activity: now,
      metadata,
    };

    // Update user in the map directly
    user.status = UserStatus.CONNECTED;
    user.connection = connection;

    // Store connection
    this.connections.set(connectionId, connection);

    // Update stats
    this.stats.total_connections++;
    this.stats.connected_users++;

    // Emit event
    const connectEvent: UserConnectEvent = {
      user_id: userId,
      connection_id: connectionId,
      access_point: accessPoint,
      timestamp: now,
    };
    this.notifyConnectListeners(connectEvent);

    if (this.config.auditLogger) {
      this.config.auditLogger.logUserConnect(connectEvent);
    }

    return {
      success: true,
      connection_id: connectionId,
      user: { ...user },
    };
  }

  /**
   * Disconnects a user
   */
  disconnect(
    userId: string,
    reason: 'logout' | 'timeout' | 'kicked' | 'replaced' = 'logout'
  ): DisconnectionResult {
    const user = this.users.get(userId);
    if (!user) {
      return {
        success: false,
        user_id: userId,
        error: `User ${userId} not found`,
      };
    }

    if (user.status !== UserStatus.CONNECTED || !user.connection) {
      return {
        success: false,
        user_id: userId,
        error: `User ${userId} is not connected`,
      };
    }

    const connection = user.connection;
    const now = new Date();
    const duration = now.getTime() - connection.connected_at.getTime();

    // Remove connection
    this.connections.delete(connection.connection_id);

    // Update user
    user.status = reason === 'kicked' ? UserStatus.KICKED : UserStatus.DISCONNECTED;
    user.connection = undefined;

    // Update stats
    this.stats.total_disconnections++;
    this.stats.connected_users--;

    // Emit event
    const disconnectEvent: UserDisconnectEvent = {
      user_id: userId,
      connection_id: connection.connection_id,
      access_point: connection.access_point,
      timestamp: now,
      reason,
      duration_ms: duration,
    };
    this.notifyDisconnectListeners(disconnectEvent);

    if (this.config.auditLogger) {
      this.config.auditLogger.logUserDisconnect(disconnectEvent);
    }

    return {
      success: true,
      user_id: userId,
      duration_ms: duration,
    };
  }

  /**
   * Kicks a user (forcibly disconnects)
   */
  kickUser(userId: string): DisconnectionResult {
    return this.disconnect(userId, 'kicked');
  }

  /**
   * Updates the last activity timestamp for a user
   */
  updateActivity(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user || !user.connection) {
      return false;
    }

    user.connection.last_activity = new Date();
    return true;
  }

  /**
   * Gets a user by ID
   */
  getUser(userId: string): User | null {
    const user = this.users.get(userId);
    return user ? { ...user, connection: user.connection ? { ...user.connection } : undefined } : null;
  }

  /**
   * Gets a connection by ID
   */
  getConnection(connectionId: string): UserConnection | null {
    const conn = this.connections.get(connectionId);
    return conn ? { ...conn } : null;
  }

  /**
   * Checks if a user is connected
   */
  isConnected(userId: string): boolean {
    const user = this.users.get(userId);
    return user?.status === UserStatus.CONNECTED && !!user.connection;
  }

  /**
   * Gets all connected users
   */
  getConnectedUsers(): User[] {
    return Array.from(this.users.values())
      .filter((u) => u.status === UserStatus.CONNECTED)
      .map((u) => ({
        ...u,
        connection: u.connection ? { ...u.connection } : undefined,
      }));
  }

  /**
   * Gets all registered users
   */
  getAllUsers(): User[] {
    return Array.from(this.users.values()).map((u) => ({
      ...u,
      connection: u.connection ? { ...u.connection } : undefined,
    }));
  }

  /**
   * Gets connection count
   */
  getConnectedCount(): number {
    return this.stats.connected_users;
  }

  /**
   * Gets manager statistics
   */
  getStats(): UserManagerStats {
    return { ...this.stats };
  }

  /**
   * Checks for and disconnects timed-out users
   */
  checkTimeouts(): string[] {
    const now = new Date();
    const timeout = this.config.inactivity_timeout_ms;
    const timedOut: string[] = [];

    for (const user of this.users.values()) {
      if (user.status === UserStatus.CONNECTED && user.connection) {
        const inactive = now.getTime() - user.connection.last_activity.getTime();
        if (inactive > timeout) {
          timedOut.push(user.user_id);
          if (this.config.auto_disconnect_on_timeout) {
            this.disconnect(user.user_id, 'timeout');
          }
        }
      }
    }

    return timedOut;
  }

  /**
   * Starts automatic timeout checking
   */
  startTimeoutChecks(intervalMs: number = 60000): void {
    if (this.timeoutTimer) {
      return;
    }

    this.timeoutTimer = setInterval(() => {
      this.checkTimeouts();
    }, intervalMs);
  }

  /**
   * Stops automatic timeout checking
   */
  stopTimeoutChecks(): void {
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
      this.timeoutTimer = undefined;
    }
  }

  /**
   * Registers a listener for connect events
   */
  onConnect(listener: UserConnectListener): () => void {
    this.connectListeners.push(listener);
    return () => {
      const idx = this.connectListeners.indexOf(listener);
      if (idx >= 0) {
        this.connectListeners.splice(idx, 1);
      }
    };
  }

  /**
   * Registers a listener for disconnect events
   */
  onDisconnect(listener: UserDisconnectListener): () => void {
    this.disconnectListeners.push(listener);
    return () => {
      const idx = this.disconnectListeners.indexOf(listener);
      if (idx >= 0) {
        this.disconnectListeners.splice(idx, 1);
      }
    };
  }

  /**
   * Registers a listener for connection rejected events
   */
  onConnectionRejected(listener: ConnectionRejectedListener): () => void {
    this.rejectedListeners.push(listener);
    return () => {
      const idx = this.rejectedListeners.indexOf(listener);
      if (idx >= 0) {
        this.rejectedListeners.splice(idx, 1);
      }
    };
  }

  private notifyConnectListeners(event: UserConnectEvent): void {
    for (const listener of this.connectListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in connect listener:', e);
      }
    }
  }

  private notifyDisconnectListeners(event: UserDisconnectEvent): void {
    for (const listener of this.disconnectListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in disconnect listener:', e);
      }
    }
  }

  private notifyRejectedListeners(event: ConnectionRejectedEvent): void {
    for (const listener of this.rejectedListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in rejected listener:', e);
      }
    }
  }

  /**
   * Clears all users and connections (for testing)
   */
  clear(): void {
    this.stopTimeoutChecks();
    this.users.clear();
    this.connections.clear();
    this.stats = {
      total_users: 0,
      connected_users: 0,
      total_connections: 0,
      total_disconnections: 0,
      rejected_connections: 0,
    };
  }
}
