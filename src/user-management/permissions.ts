/**
 * Permission Manager
 *
 * Manages contract permissions and access control.
 */

import {
  ContractPermission,
  PermissionLevel,
  PermissionCheckResult,
  GrantPermissionOptions,
  UserAuditLogger,
} from './types';

/**
 * Validates an ID string for security
 * IDs must be non-empty strings containing only safe characters
 */
function validateId(id: string, type: 'contract' | 'user'): void {
  if (!id || typeof id !== 'string') {
    throw new Error(`Invalid ${type} ID: must be a non-empty string`);
  }
  if (id.length > 256) {
    throw new Error(`Invalid ${type} ID: exceeds maximum length of 256 characters`);
  }
  // Allow alphanumeric, hyphens, underscores, and periods
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(id)) {
    throw new Error(`Invalid ${type} ID: contains invalid characters`);
  }
}

/** Symbol for internal owner setting - only accessible within the module */
const INTERNAL_SET_OWNER = Symbol('internal-set-owner');

/**
 * Manages permissions for contracts
 */
export class PermissionManager {
  /** Map of contract_id -> permissions array */
  private permissions: Map<string, ContractPermission[]> = new Map();
  private auditLogger?: UserAuditLogger;
  private internalToken: symbol;

  constructor(auditLogger?: UserAuditLogger) {
    this.auditLogger = auditLogger;
    this.internalToken = INTERNAL_SET_OWNER;
  }

  /**
   * Gets the internal token for secure owner setting
   * @internal This should only be used by LearningContractsSystem
   */
  getInternalToken(): symbol {
    return this.internalToken;
  }

  /**
   * Sets the owner of a contract (requires internal token for security)
   * @param contractId - Contract ID
   * @param ownerId - Owner user ID
   * @param token - Internal security token (must match)
   * @throws Error if token is invalid
   */
  setOwner(contractId: string, ownerId: string, token?: symbol): void {
    // Validate the security token
    if (token !== this.internalToken) {
      throw new Error('Unauthorized: setOwner requires internal authorization token');
    }

    // Validate IDs
    validateId(contractId, 'contract');
    validateId(ownerId, 'user');

    const perms = this.permissions.get(contractId) || [];

    // Remove any existing owner permission
    const filtered = perms.filter((p) => p.level !== PermissionLevel.OWNER);

    // Add owner permission
    filtered.push({
      user_id: ownerId,
      level: PermissionLevel.OWNER,
      granted_at: new Date(),
      granted_by: ownerId,
    });

    this.permissions.set(contractId, filtered);
  }

  /**
   * Gets the owner of a contract
   */
  getOwner(contractId: string): string | null {
    const perms = this.permissions.get(contractId);
    if (!perms) {return null;}

    const ownerPerm = perms.find((p) => p.level === PermissionLevel.OWNER);
    return ownerPerm?.user_id ?? null;
  }

  /**
   * Grants a permission to a user
   * Only owners can grant permissions
   */
  grantPermission(
    contractId: string,
    granterId: string,
    userId: string,
    level: PermissionLevel,
    options: GrantPermissionOptions = {}
  ): PermissionCheckResult {
    // Validate IDs
    try {
      validateId(contractId, 'contract');
      validateId(granterId, 'user');
      validateId(userId, 'user');
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : 'Invalid ID',
      };
    }

    // Check if granter is owner
    const granterLevel = this.getUserPermissionLevel(contractId, granterId);
    if (granterLevel !== PermissionLevel.OWNER) {
      return {
        allowed: false,
        level: granterLevel,
        reason: 'Only the contract owner can grant permissions',
      };
    }

    // Cannot grant owner permission
    if (level === PermissionLevel.OWNER) {
      return {
        allowed: false,
        level: granterLevel,
        reason: 'Cannot grant owner permission. Use transferOwnership instead.',
      };
    }

    // Cannot grant to self
    if (userId === granterId) {
      return {
        allowed: false,
        level: granterLevel,
        reason: 'Cannot grant permission to yourself',
      };
    }

    const perms = this.permissions.get(contractId) || [];

    // Remove any existing permission for this user (except owner)
    const filtered = perms.filter(
      (p) => p.user_id !== userId || p.level === PermissionLevel.OWNER
    );

    // Add new permission
    filtered.push({
      user_id: userId,
      level,
      granted_at: new Date(),
      granted_by: granterId,
      expires_at: options.expires_at,
    });

    this.permissions.set(contractId, filtered);

    if (this.auditLogger) {
      this.auditLogger.logPermissionGranted(contractId, userId, level, granterId);
    }

    return {
      allowed: true,
      level,
    };
  }

  /**
   * Revokes a permission from a user
   * Only owners can revoke permissions
   */
  revokePermission(
    contractId: string,
    revokerId: string,
    userId: string
  ): PermissionCheckResult {
    // Validate IDs
    try {
      validateId(contractId, 'contract');
      validateId(revokerId, 'user');
      validateId(userId, 'user');
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : 'Invalid ID',
      };
    }

    // Check if revoker is owner
    const revokerLevel = this.getUserPermissionLevel(contractId, revokerId);
    if (revokerLevel !== PermissionLevel.OWNER) {
      return {
        allowed: false,
        level: revokerLevel,
        reason: 'Only the contract owner can revoke permissions',
      };
    }

    // Cannot revoke own owner permission
    if (userId === revokerId) {
      return {
        allowed: false,
        level: revokerLevel,
        reason: 'Cannot revoke your own owner permission. Use transferOwnership instead.',
      };
    }

    const perms = this.permissions.get(contractId);
    if (!perms) {
      return {
        allowed: false,
        reason: 'Contract has no permissions',
      };
    }

    // Find and remove permission
    const userPerm = perms.find((p) => p.user_id === userId);
    if (!userPerm) {
      return {
        allowed: false,
        reason: `User ${userId} has no permission on this contract`,
      };
    }

    const filtered = perms.filter((p) => p.user_id !== userId);
    this.permissions.set(contractId, filtered);

    if (this.auditLogger) {
      this.auditLogger.logPermissionRevoked(contractId, userId, revokerId);
    }

    return {
      allowed: true,
      level: userPerm.level,
    };
  }

  /**
   * Transfers ownership to another user
   * Only the current owner can transfer ownership
   */
  transferOwnership(
    contractId: string,
    currentOwnerId: string,
    newOwnerId: string
  ): PermissionCheckResult {
    // Validate IDs
    try {
      validateId(contractId, 'contract');
      validateId(currentOwnerId, 'user');
      validateId(newOwnerId, 'user');
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : 'Invalid ID',
      };
    }

    // Verify current owner
    const currentLevel = this.getUserPermissionLevel(contractId, currentOwnerId);
    if (currentLevel !== PermissionLevel.OWNER) {
      return {
        allowed: false,
        level: currentLevel,
        reason: 'Only the current owner can transfer ownership',
      };
    }

    if (currentOwnerId === newOwnerId) {
      return {
        allowed: false,
        level: currentLevel,
        reason: 'Cannot transfer ownership to yourself',
      };
    }

    const perms = this.permissions.get(contractId) || [];

    // Remove current owner's permission
    let filtered = perms.filter((p) => p.user_id !== currentOwnerId);

    // Remove any existing permission for new owner
    filtered = filtered.filter((p) => p.user_id !== newOwnerId);

    // Add new owner permission
    filtered.push({
      user_id: newOwnerId,
      level: PermissionLevel.OWNER,
      granted_at: new Date(),
      granted_by: currentOwnerId,
    });

    this.permissions.set(contractId, filtered);

    if (this.auditLogger) {
      this.auditLogger.logPermissionGranted(
        contractId,
        newOwnerId,
        PermissionLevel.OWNER,
        currentOwnerId
      );
    }

    return {
      allowed: true,
      level: PermissionLevel.OWNER,
    };
  }

  /**
   * Gets a user's permission level for a contract
   */
  getUserPermissionLevel(contractId: string, userId: string): PermissionLevel | undefined {
    const perms = this.permissions.get(contractId);
    if (!perms) {return undefined;}

    const now = new Date();
    const userPerm = perms.find((p) => {
      if (p.user_id !== userId) {return false;}
      // Check if expired
      if (p.expires_at && p.expires_at < now) {return false;}
      return true;
    });

    return userPerm?.level;
  }

  /**
   * Checks if a user has at least a certain permission level
   */
  hasPermission(
    contractId: string,
    userId: string,
    requiredLevel: PermissionLevel
  ): PermissionCheckResult {
    const userLevel = this.getUserPermissionLevel(contractId, userId);

    if (!userLevel) {
      return {
        allowed: false,
        reason: `User ${userId} has no permission on contract ${contractId}`,
      };
    }

    const allowed = this.isLevelSufficient(userLevel, requiredLevel);

    return {
      allowed,
      level: userLevel,
      reason: allowed
        ? undefined
        : `User has ${userLevel} permission but ${requiredLevel} is required`,
    };
  }

  /**
   * Checks if a user can perform an operation
   */
  checkOperation(
    contractId: string,
    userId: string,
    operation: 'read' | 'use' | 'modify' | 'share'
  ): PermissionCheckResult {
    const requiredLevel = this.getRequiredLevel(operation);
    return this.hasPermission(contractId, userId, requiredLevel);
  }

  /**
   * Gets all permissions for a contract
   */
  getContractPermissions(contractId: string): ContractPermission[] {
    const perms = this.permissions.get(contractId) || [];
    const now = new Date();

    // Filter out expired permissions
    return perms
      .filter((p) => !p.expires_at || p.expires_at >= now)
      .map((p) => ({ ...p }));
  }

  /**
   * Gets all contracts a user has access to
   */
  getUserContracts(userId: string): { contractId: string; level: PermissionLevel }[] {
    const result: { contractId: string; level: PermissionLevel }[] = [];
    const now = new Date();

    for (const [contractId, perms] of this.permissions.entries()) {
      const userPerm = perms.find((p) => {
        if (p.user_id !== userId) {return false;}
        if (p.expires_at && p.expires_at < now) {return false;}
        return true;
      });

      if (userPerm) {
        result.push({ contractId, level: userPerm.level });
      }
    }

    return result;
  }

  /**
   * Removes all permissions for a contract (when contract is deleted)
   */
  removeContractPermissions(contractId: string): void {
    this.permissions.delete(contractId);
  }

  /**
   * Cleans up expired permissions
   */
  cleanupExpired(): number {
    let removed = 0;
    const now = new Date();

    for (const [contractId, perms] of this.permissions.entries()) {
      const before = perms.length;
      const filtered = perms.filter((p) => !p.expires_at || p.expires_at >= now);
      removed += before - filtered.length;
      this.permissions.set(contractId, filtered);
    }

    return removed;
  }

  /**
   * Gets the required permission level for an operation
   */
  private getRequiredLevel(operation: 'read' | 'use' | 'modify' | 'share'): PermissionLevel {
    switch (operation) {
      case 'read':
        return PermissionLevel.READER;
      case 'use':
        return PermissionLevel.DELEGATE;
      case 'modify':
      case 'share':
        return PermissionLevel.OWNER;
    }
  }

  /**
   * Checks if a level is sufficient for a required level
   */
  private isLevelSufficient(
    userLevel: PermissionLevel,
    requiredLevel: PermissionLevel
  ): boolean {
    const hierarchy: PermissionLevel[] = [
      PermissionLevel.READER,
      PermissionLevel.DELEGATE,
      PermissionLevel.OWNER,
    ];

    const userIdx = hierarchy.indexOf(userLevel);
    const requiredIdx = hierarchy.indexOf(requiredLevel);

    return userIdx >= requiredIdx;
  }

  /**
   * Clears all permissions (for testing)
   */
  clear(): void {
    this.permissions.clear();
  }
}
