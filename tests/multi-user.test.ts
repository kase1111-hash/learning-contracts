/**
 * Multi-User Support Tests
 */

import {
  LearningContractsSystem,
  UserManager,
  PermissionManager,
  PermissionLevel,
  UserStatus,
} from '../src';

describe('Multi-User Support', () => {
  describe('UserManager', () => {
    let userManager: UserManager;

    beforeEach(() => {
      userManager = new UserManager();
    });

    describe('User Connection', () => {
      test('should connect a new user', () => {
        const result = userManager.connect('alice', 'terminal-1');

        expect(result.success).toBe(true);
        expect(result.connection_id).toBeDefined();
        expect(result.user).toBeDefined();
        expect(result.user?.user_id).toBe('alice');
        expect(result.user?.status).toBe(UserStatus.CONNECTED);
      });

      test('should reject second connection from same user', () => {
        userManager.connect('alice', 'terminal-1');

        const result = userManager.connect('alice', 'terminal-2');

        expect(result.success).toBe(false);
        expect(result.error).toContain('already connected');
        expect(result.existing_connection).toBeDefined();
        expect(result.existing_connection?.access_point).toBe('terminal-1');
      });

      test('should allow multiple different users to connect', () => {
        const result1 = userManager.connect('alice', 'terminal-1');
        const result2 = userManager.connect('bob', 'terminal-2');
        const result3 = userManager.connect('charlie', 'terminal-3');

        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
        expect(result3.success).toBe(true);

        expect(userManager.getConnectedCount()).toBe(3);
      });

      test('should store connection metadata', () => {
        const metadata = { device: 'laptop', os: 'linux' };
        const result = userManager.connect('alice', 'terminal-1', metadata);

        expect(result.success).toBe(true);
        expect(result.user?.connection?.metadata).toEqual(metadata);
      });

      test('should track connection timestamp', () => {
        const before = new Date();
        const result = userManager.connect('alice', 'terminal-1');
        const after = new Date();

        expect(result.user?.connection?.connected_at.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(result.user?.connection?.connected_at.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    describe('User Disconnection', () => {
      test('should disconnect a connected user', () => {
        userManager.connect('alice', 'terminal-1');

        const result = userManager.disconnect('alice');

        expect(result.success).toBe(true);
        expect(result.duration_ms).toBeGreaterThanOrEqual(0);
        expect(userManager.isConnected('alice')).toBe(false);
      });

      test('should fail to disconnect non-existent user', () => {
        const result = userManager.disconnect('unknown');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });

      test('should fail to disconnect already disconnected user', () => {
        userManager.connect('alice', 'terminal-1');
        userManager.disconnect('alice');

        const result = userManager.disconnect('alice');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not connected');
      });

      test('should set correct status on kick', () => {
        userManager.connect('alice', 'terminal-1');

        const result = userManager.kickUser('alice');

        expect(result.success).toBe(true);
        const user = userManager.getUser('alice');
        expect(user?.status).toBe(UserStatus.KICKED);
      });
    });

    describe('Connection Replace Mode', () => {
      test('should replace existing connection when allowed', () => {
        const managerWithReplace = new UserManager({
          allow_connection_replace: true,
        });

        const result1 = managerWithReplace.connect('alice', 'terminal-1');
        expect(result1.success).toBe(true);

        const result2 = managerWithReplace.connect('alice', 'terminal-2');
        expect(result2.success).toBe(true);

        const user = managerWithReplace.getUser('alice');
        expect(user?.connection?.access_point).toBe('terminal-2');
      });
    });

    describe('User Queries', () => {
      test('should get user by ID', () => {
        userManager.connect('alice', 'terminal-1');

        const user = userManager.getUser('alice');

        expect(user).toBeDefined();
        expect(user?.user_id).toBe('alice');
      });

      test('should return null for non-existent user', () => {
        const user = userManager.getUser('unknown');
        expect(user).toBeNull();
      });

      test('should check if user is connected', () => {
        userManager.connect('alice', 'terminal-1');

        expect(userManager.isConnected('alice')).toBe(true);
        expect(userManager.isConnected('bob')).toBe(false);
      });

      test('should get all connected users', () => {
        userManager.connect('alice', 'terminal-1');
        userManager.connect('bob', 'terminal-2');
        userManager.connect('charlie', 'terminal-3');
        userManager.disconnect('bob');

        const connected = userManager.getConnectedUsers();

        expect(connected.length).toBe(2);
        expect(connected.map((u) => u.user_id).sort()).toEqual(['alice', 'charlie']);
      });

      test('should get all registered users', () => {
        userManager.connect('alice', 'terminal-1');
        userManager.connect('bob', 'terminal-2');
        userManager.disconnect('bob');

        const all = userManager.getAllUsers();

        expect(all.length).toBe(2);
        expect(all.map((u) => u.user_id).sort()).toEqual(['alice', 'bob']);
      });
    });

    describe('Activity Tracking', () => {
      test('should update last activity', () => {
        userManager.connect('alice', 'terminal-1');

        const before = userManager.getUser('alice')?.connection?.last_activity;

        // Wait a tiny bit
        const updated = userManager.updateActivity('alice');

        expect(updated).toBe(true);
        const after = userManager.getUser('alice')?.connection?.last_activity;
        expect(after?.getTime()).toBeGreaterThanOrEqual(before?.getTime() ?? 0);
      });

      test('should return false for non-connected user', () => {
        expect(userManager.updateActivity('unknown')).toBe(false);
      });
    });

    describe('Timeout Checking', () => {
      test('should detect timed out users', () => {
        const managerWithShortTimeout = new UserManager({
          inactivity_timeout_ms: 10, // 10ms timeout for testing
        });

        managerWithShortTimeout.connect('alice', 'terminal-1');

        // Wait for timeout
        const start = Date.now();
        while (Date.now() - start < 20) {
          // Busy wait for 20ms
        }

        const timedOut = managerWithShortTimeout.checkTimeouts();
        expect(timedOut).toContain('alice');
      });
    });

    describe('Event Listeners', () => {
      test('should notify connect listeners', () => {
        let receivedEvent: any = null;

        userManager.onConnect((event) => {
          receivedEvent = event;
        });

        userManager.connect('alice', 'terminal-1');

        expect(receivedEvent).toBeDefined();
        expect(receivedEvent.user_id).toBe('alice');
        expect(receivedEvent.access_point).toBe('terminal-1');
      });

      test('should notify disconnect listeners', () => {
        let receivedEvent: any = null;

        userManager.onDisconnect((event) => {
          receivedEvent = event;
        });

        userManager.connect('alice', 'terminal-1');
        userManager.disconnect('alice');

        expect(receivedEvent).toBeDefined();
        expect(receivedEvent.user_id).toBe('alice');
        expect(receivedEvent.reason).toBe('logout');
      });

      test('should notify rejected listeners', () => {
        let receivedEvent: any = null;

        userManager.onConnectionRejected((event) => {
          receivedEvent = event;
        });

        userManager.connect('alice', 'terminal-1');
        userManager.connect('alice', 'terminal-2');

        expect(receivedEvent).toBeDefined();
        expect(receivedEvent.user_id).toBe('alice');
        expect(receivedEvent.existing_access_point).toBe('terminal-1');
        expect(receivedEvent.attempted_access_point).toBe('terminal-2');
      });

      test('should allow unsubscribing from listeners', () => {
        let count = 0;

        const unsubscribe = userManager.onConnect(() => {
          count++;
        });

        userManager.connect('alice', 'terminal-1');
        expect(count).toBe(1);

        unsubscribe();

        userManager.connect('bob', 'terminal-2');
        expect(count).toBe(1);
      });
    });

    describe('Statistics', () => {
      test('should track connection statistics', () => {
        userManager.connect('alice', 'terminal-1');
        userManager.connect('bob', 'terminal-2');
        userManager.connect('alice', 'terminal-3'); // Should be rejected
        userManager.disconnect('bob');

        const stats = userManager.getStats();

        expect(stats.total_users).toBe(2);
        expect(stats.total_connections).toBe(2);
        expect(stats.connected_users).toBe(1);
        expect(stats.total_disconnections).toBe(1);
        expect(stats.rejected_connections).toBe(1);
      });
    });
  });

  describe('PermissionManager', () => {
    let permissionManager: PermissionManager;

    beforeEach(() => {
      permissionManager = new PermissionManager();
    });

    describe('Owner Management', () => {
      test('should set owner of a contract', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const owner = permissionManager.getOwner('contract-1');
        expect(owner).toBe('alice');
      });

      test('should return null for contract without owner', () => {
        const owner = permissionManager.getOwner('unknown');
        expect(owner).toBeNull();
      });

      test('should get user permission level', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const level = permissionManager.getUserPermissionLevel('contract-1', 'alice');
        expect(level).toBe(PermissionLevel.OWNER);
      });
    });

    describe('Granting Permissions', () => {
      test('should allow owner to grant delegate permission', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const result = permissionManager.grantPermission(
          'contract-1',
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );

        expect(result.allowed).toBe(true);
        expect(permissionManager.getUserPermissionLevel('contract-1', 'bob')).toBe(
          PermissionLevel.DELEGATE
        );
      });

      test('should allow owner to grant reader permission', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const result = permissionManager.grantPermission(
          'contract-1',
          'alice',
          'bob',
          PermissionLevel.READER
        );

        expect(result.allowed).toBe(true);
        expect(permissionManager.getUserPermissionLevel('contract-1', 'bob')).toBe(
          PermissionLevel.READER
        );
      });

      test('should not allow non-owner to grant permissions', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const result = permissionManager.grantPermission(
          'contract-1',
          'bob',
          'charlie',
          PermissionLevel.DELEGATE
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('owner');
      });

      test('should not allow granting owner permission', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const result = permissionManager.grantPermission(
          'contract-1',
          'alice',
          'bob',
          PermissionLevel.OWNER
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('transferOwnership');
      });

      test('should not allow granting to self', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const result = permissionManager.grantPermission(
          'contract-1',
          'alice',
          'alice',
          PermissionLevel.DELEGATE
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('yourself');
      });

      test('should support temporary permissions with expiration', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const expiration = new Date(Date.now() + 60000); // 1 minute from now
        permissionManager.grantPermission(
          'contract-1',
          'alice',
          'bob',
          PermissionLevel.DELEGATE,
          { expires_at: expiration }
        );

        const perms = permissionManager.getContractPermissions('contract-1');
        const bobPerm = perms.find((p) => p.user_id === 'bob');

        expect(bobPerm?.expires_at).toEqual(expiration);
      });
    });

    describe('Revoking Permissions', () => {
      test('should allow owner to revoke permissions', () => {
        permissionManager.setOwner('contract-1', 'alice');
        permissionManager.grantPermission(
          'contract-1',
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );

        const result = permissionManager.revokePermission('contract-1', 'alice', 'bob');

        expect(result.allowed).toBe(true);
        expect(permissionManager.getUserPermissionLevel('contract-1', 'bob')).toBeUndefined();
      });

      test('should not allow non-owner to revoke permissions', () => {
        permissionManager.setOwner('contract-1', 'alice');
        permissionManager.grantPermission(
          'contract-1',
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );

        const result = permissionManager.revokePermission('contract-1', 'bob', 'charlie');

        expect(result.allowed).toBe(false);
      });

      test('should not allow owner to revoke own permission', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const result = permissionManager.revokePermission('contract-1', 'alice', 'alice');

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('transferOwnership');
      });
    });

    describe('Ownership Transfer', () => {
      test('should transfer ownership to another user', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const result = permissionManager.transferOwnership('contract-1', 'alice', 'bob');

        expect(result.allowed).toBe(true);
        expect(permissionManager.getOwner('contract-1')).toBe('bob');
        expect(permissionManager.getUserPermissionLevel('contract-1', 'alice')).toBeUndefined();
      });

      test('should not allow non-owner to transfer ownership', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const result = permissionManager.transferOwnership('contract-1', 'bob', 'charlie');

        expect(result.allowed).toBe(false);
      });

      test('should not allow transfer to self', () => {
        permissionManager.setOwner('contract-1', 'alice');

        const result = permissionManager.transferOwnership('contract-1', 'alice', 'alice');

        expect(result.allowed).toBe(false);
      });
    });

    describe('Permission Checking', () => {
      test('should check if user has required permission level', () => {
        permissionManager.setOwner('contract-1', 'alice');
        permissionManager.grantPermission(
          'contract-1',
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );

        // Owner has all permissions
        expect(
          permissionManager.hasPermission('contract-1', 'alice', PermissionLevel.OWNER).allowed
        ).toBe(true);
        expect(
          permissionManager.hasPermission('contract-1', 'alice', PermissionLevel.DELEGATE).allowed
        ).toBe(true);
        expect(
          permissionManager.hasPermission('contract-1', 'alice', PermissionLevel.READER).allowed
        ).toBe(true);

        // Delegate has delegate and reader
        expect(
          permissionManager.hasPermission('contract-1', 'bob', PermissionLevel.OWNER).allowed
        ).toBe(false);
        expect(
          permissionManager.hasPermission('contract-1', 'bob', PermissionLevel.DELEGATE).allowed
        ).toBe(true);
        expect(
          permissionManager.hasPermission('contract-1', 'bob', PermissionLevel.READER).allowed
        ).toBe(true);
      });

      test('should check operation permissions', () => {
        permissionManager.setOwner('contract-1', 'alice');
        permissionManager.grantPermission(
          'contract-1',
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );
        permissionManager.grantPermission(
          'contract-1',
          'alice',
          'charlie',
          PermissionLevel.READER
        );

        // Owner can do everything
        expect(permissionManager.checkOperation('contract-1', 'alice', 'read').allowed).toBe(true);
        expect(permissionManager.checkOperation('contract-1', 'alice', 'use').allowed).toBe(true);
        expect(permissionManager.checkOperation('contract-1', 'alice', 'modify').allowed).toBe(
          true
        );
        expect(permissionManager.checkOperation('contract-1', 'alice', 'share').allowed).toBe(true);

        // Delegate can read and use
        expect(permissionManager.checkOperation('contract-1', 'bob', 'read').allowed).toBe(true);
        expect(permissionManager.checkOperation('contract-1', 'bob', 'use').allowed).toBe(true);
        expect(permissionManager.checkOperation('contract-1', 'bob', 'modify').allowed).toBe(
          false
        );
        expect(permissionManager.checkOperation('contract-1', 'bob', 'share').allowed).toBe(false);

        // Reader can only read
        expect(permissionManager.checkOperation('contract-1', 'charlie', 'read').allowed).toBe(
          true
        );
        expect(permissionManager.checkOperation('contract-1', 'charlie', 'use').allowed).toBe(
          false
        );
      });
    });

    describe('Permission Queries', () => {
      test('should get all permissions on a contract', () => {
        permissionManager.setOwner('contract-1', 'alice');
        permissionManager.grantPermission(
          'contract-1',
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );
        permissionManager.grantPermission(
          'contract-1',
          'alice',
          'charlie',
          PermissionLevel.READER
        );

        const perms = permissionManager.getContractPermissions('contract-1');

        expect(perms.length).toBe(3);
        expect(perms.find((p) => p.user_id === 'alice')?.level).toBe(PermissionLevel.OWNER);
        expect(perms.find((p) => p.user_id === 'bob')?.level).toBe(PermissionLevel.DELEGATE);
        expect(perms.find((p) => p.user_id === 'charlie')?.level).toBe(PermissionLevel.READER);
      });

      test('should get all contracts user has access to', () => {
        permissionManager.setOwner('contract-1', 'alice');
        permissionManager.setOwner('contract-2', 'bob');
        permissionManager.grantPermission(
          'contract-1',
          'alice',
          'charlie',
          PermissionLevel.DELEGATE
        );
        permissionManager.grantPermission(
          'contract-2',
          'bob',
          'charlie',
          PermissionLevel.READER
        );

        const charlieContracts = permissionManager.getUserContracts('charlie');

        expect(charlieContracts.length).toBe(2);
        expect(
          charlieContracts.find((c) => c.contractId === 'contract-1')?.level
        ).toBe(PermissionLevel.DELEGATE);
        expect(
          charlieContracts.find((c) => c.contractId === 'contract-2')?.level
        ).toBe(PermissionLevel.READER);
      });
    });

    describe('Expired Permission Cleanup', () => {
      test('should clean up expired permissions', () => {
        permissionManager.setOwner('contract-1', 'alice');

        // Grant a permission that's already expired
        const pastDate = new Date(Date.now() - 1000);
        permissionManager.grantPermission(
          'contract-1',
          'alice',
          'bob',
          PermissionLevel.DELEGATE,
          { expires_at: pastDate }
        );

        // Permission should not be returned as active
        expect(
          permissionManager.getUserPermissionLevel('contract-1', 'bob')
        ).toBeUndefined();

        const removed = permissionManager.cleanupExpired();
        expect(removed).toBe(1);
      });
    });
  });

  describe('LearningContractsSystem Integration', () => {
    let system: LearningContractsSystem;

    beforeEach(() => {
      system = new LearningContractsSystem();
    });

    describe('User Connection Integration', () => {
      test('should connect users through the system', () => {
        const result = system.connectUser('alice', 'terminal-1');

        expect(result.success).toBe(true);
        expect(system.isUserConnected('alice')).toBe(true);
      });

      test('should enforce one instance per user', () => {
        system.connectUser('alice', 'terminal-1');

        const result = system.connectUser('alice', 'terminal-2');

        expect(result.success).toBe(false);
        expect(system.getConnectedUserCount()).toBe(1);
      });

      test('should disconnect users through the system', () => {
        system.connectUser('alice', 'terminal-1');

        const result = system.disconnectUser('alice');

        expect(result.success).toBe(true);
        expect(system.isUserConnected('alice')).toBe(false);
      });

      test('should kick users through the system', () => {
        system.connectUser('alice', 'terminal-1');

        const result = system.kickUser('alice');

        expect(result.success).toBe(true);
        expect(system.getUser('alice')?.status).toBe(UserStatus.KICKED);
      });

      test('should get all connected users', () => {
        system.connectUser('alice', 'terminal-1');
        system.connectUser('bob', 'terminal-2');
        system.connectUser('charlie', 'terminal-3');
        system.disconnectUser('bob');

        const connected = system.getConnectedUsers();

        expect(connected.length).toBe(2);
      });

      test('should track user manager stats', () => {
        system.connectUser('alice', 'terminal-1');
        system.connectUser('bob', 'terminal-2');
        system.disconnectUser('alice');

        const stats = system.getUserManagerStats();

        expect(stats.total_connections).toBe(2);
        expect(stats.total_disconnections).toBe(1);
        expect(stats.connected_users).toBe(1);
      });
    });

    describe('Contract Permission Integration', () => {
      test('should set owner when contract is created', () => {
        const contract = system.createEpisodicContract('alice', {
          domains: ['coding'],
        });

        const owner = system.getContractOwner(contract.contract_id);
        expect(owner).toBe('alice');
      });

      test('should grant permissions through the system', () => {
        const contract = system.createEpisodicContract('alice', {
          domains: ['coding'],
        });

        const result = system.grantContractPermission(
          contract.contract_id,
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );

        expect(result.allowed).toBe(true);
        expect(system.getUserPermissionLevel(contract.contract_id, 'bob')).toBe(
          PermissionLevel.DELEGATE
        );
      });

      test('should revoke permissions through the system', () => {
        const contract = system.createEpisodicContract('alice', {
          domains: ['coding'],
        });
        system.grantContractPermission(
          contract.contract_id,
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );

        const result = system.revokeContractPermission(
          contract.contract_id,
          'alice',
          'bob'
        );

        expect(result.allowed).toBe(true);
        expect(system.getUserPermissionLevel(contract.contract_id, 'bob')).toBeUndefined();
      });

      test('should transfer ownership through the system', () => {
        const contract = system.createEpisodicContract('alice', {
          domains: ['coding'],
        });

        const result = system.transferContractOwnership(
          contract.contract_id,
          'alice',
          'bob'
        );

        expect(result.allowed).toBe(true);
        expect(system.getContractOwner(contract.contract_id)).toBe('bob');
      });

      test('should check user permissions through the system', () => {
        const contract = system.createEpisodicContract('alice', {
          domains: ['coding'],
        });
        system.grantContractPermission(
          contract.contract_id,
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );

        const result = system.checkUserPermission(
          contract.contract_id,
          'bob',
          PermissionLevel.DELEGATE
        );

        expect(result.allowed).toBe(true);
      });

      test('should check contract operations through the system', () => {
        const contract = system.createEpisodicContract('alice', {
          domains: ['coding'],
        });
        system.grantContractPermission(
          contract.contract_id,
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );

        expect(system.checkContractOperation(contract.contract_id, 'bob', 'use').allowed).toBe(
          true
        );
        expect(system.checkContractOperation(contract.contract_id, 'bob', 'modify').allowed).toBe(
          false
        );
      });

      test('should get contracts for user', () => {
        system.createEpisodicContract('alice', {
          domains: ['coding'],
        });
        const contract2 = system.createEpisodicContract('bob', {
          domains: ['design'],
        });
        system.grantContractPermission(
          contract2.contract_id,
          'bob',
          'alice',
          PermissionLevel.READER
        );

        const aliceContracts = system.getContractsForUser('alice');

        expect(aliceContracts.length).toBe(2);
      });

      test('should get owned contracts', () => {
        const contract1 = system.createEpisodicContract('alice', {
          domains: ['coding'],
        });
        const contract2 = system.createEpisodicContract('alice', {
          domains: ['design'],
        });
        const contract3 = system.createEpisodicContract('bob', {
          domains: ['testing'],
        });
        system.grantContractPermission(
          contract3.contract_id,
          'bob',
          'alice',
          PermissionLevel.DELEGATE
        );

        const owned = system.getOwnedContracts('alice');

        expect(owned.length).toBe(2);
        expect(owned.map((c) => c.contract_id).sort()).toEqual(
          [contract1.contract_id, contract2.contract_id].sort()
        );
      });

      test('should get all contract permissions', () => {
        const contract = system.createEpisodicContract('alice', {
          domains: ['coding'],
        });
        system.grantContractPermission(
          contract.contract_id,
          'alice',
          'bob',
          PermissionLevel.DELEGATE
        );
        system.grantContractPermission(
          contract.contract_id,
          'alice',
          'charlie',
          PermissionLevel.READER
        );

        const perms = system.getContractPermissions(contract.contract_id);

        expect(perms.length).toBe(3);
      });

      test('should get user accessible contracts with levels', () => {
        const contract1 = system.createEpisodicContract('alice', {
          domains: ['coding'],
        });
        const contract2 = system.createEpisodicContract('bob', {
          domains: ['design'],
        });
        system.grantContractPermission(
          contract2.contract_id,
          'bob',
          'alice',
          PermissionLevel.DELEGATE
        );

        const accessible = system.getUserAccessibleContracts('alice');

        expect(accessible.length).toBe(2);
        expect(accessible.find((a) => a.contractId === contract1.contract_id)?.level).toBe(
          PermissionLevel.OWNER
        );
        expect(accessible.find((a) => a.contractId === contract2.contract_id)?.level).toBe(
          PermissionLevel.DELEGATE
        );
      });
    });

    describe('Multiple User Workflow', () => {
      test('should support multiple users with different contracts', () => {
        // Connect users
        system.connectUser('alice', 'terminal-1');
        system.connectUser('bob', 'terminal-2');
        system.connectUser('charlie', 'terminal-3');

        // Create contracts
        const aliceContract = system.createEpisodicContract('alice', {
          domains: ['coding'],
        });
        const bobContract = system.createEpisodicContract('bob', {
          domains: ['design'],
        });

        // Share access
        system.grantContractPermission(
          aliceContract.contract_id,
          'alice',
          'charlie',
          PermissionLevel.DELEGATE
        );
        system.grantContractPermission(
          bobContract.contract_id,
          'bob',
          'charlie',
          PermissionLevel.READER
        );

        // Verify access
        expect(system.getContractsForUser('alice').length).toBe(1);
        expect(system.getContractsForUser('bob').length).toBe(1);
        expect(system.getContractsForUser('charlie').length).toBe(2);

        // Verify permissions
        expect(
          system.checkContractOperation(aliceContract.contract_id, 'charlie', 'use').allowed
        ).toBe(true);
        expect(
          system.checkContractOperation(bobContract.contract_id, 'charlie', 'use').allowed
        ).toBe(false); // Reader can't use

        // Disconnect a user
        system.disconnectUser('bob');
        expect(system.getConnectedUserCount()).toBe(2);

        // Permissions should still work after disconnect
        expect(system.getContractOwner(bobContract.contract_id)).toBe('bob');
      });

      test('should prevent duplicate user connections', () => {
        system.connectUser('alice', 'terminal-1');
        system.connectUser('bob', 'terminal-2');

        // Try to connect alice again
        const result = system.connectUser('alice', 'terminal-3');

        expect(result.success).toBe(false);
        expect(system.getConnectedUserCount()).toBe(2);

        // Verify alice's connection is still from terminal-1
        const alice = system.getUser('alice');
        expect(alice?.connection?.access_point).toBe('terminal-1');
      });
    });
  });
});
