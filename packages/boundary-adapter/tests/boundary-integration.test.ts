/**
 * Boundary Daemon Integration Tests
 */

import {
  LearningContractsSystem,
} from 'learning-contracts';

import {
  MockBoundaryDaemonAdapter,
  BoundaryEnforcedSystem,
  DaemonBoundaryMode,
  TripwireType,
} from '../src';

describe('MockBoundaryDaemonAdapter', () => {
  let adapter: MockBoundaryDaemonAdapter;

  beforeEach(() => {
    adapter = new MockBoundaryDaemonAdapter();
  });

  describe('checkConnection', () => {
    test('should report connection status', async () => {
      const status = await adapter.checkConnection();

      expect(status.connected).toBe(true);
      expect(status.version).toBe('1.0.0-mock');
    });
  });

  describe('getStatus', () => {
    test('should return current boundary status', async () => {
      const status = await adapter.getStatus();

      expect(status.mode).toBe(DaemonBoundaryMode.OPEN);
      expect(status.healthy).toBe(true);
      expect(status.in_lockdown).toBe(false);
    });
  });

  describe('checkRecall', () => {
    test('should allow recall within classification cap', async () => {
      adapter.setMode(DaemonBoundaryMode.TRUSTED);

      const result = await adapter.checkRecall({
        memory_class: 2,
        memory_id: 'mem_123',
        requester: 'test-user',
      });

      expect(result.allowed).toBe(true);
      expect(result.max_class).toBe(3);
    });

    test('should deny recall above classification cap', async () => {
      adapter.setMode(DaemonBoundaryMode.OPEN);

      const result = await adapter.checkRecall({
        memory_class: 3,
        memory_id: 'mem_123',
        requester: 'test-user',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds');
    });

    test('should deny all recalls in lockdown', async () => {
      await adapter.triggerLockdown('Test lockdown', 'admin');

      const result = await adapter.checkRecall({
        memory_class: 0,
        memory_id: 'mem_123',
        requester: 'test-user',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('lockdown');
    });
  });

  describe('checkTool', () => {
    test('should allow network tools in OPEN mode', async () => {
      adapter.setMode(DaemonBoundaryMode.OPEN);

      const result = await adapter.checkTool({
        tool_name: 'wget',
        requires_network: true,
      });

      expect(result.allowed).toBe(true);
    });

    test('should deny network tools in AIRGAP mode', async () => {
      adapter.setMode(DaemonBoundaryMode.AIRGAP);

      const result = await adapter.checkTool({
        tool_name: 'wget',
        requires_network: true,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('offline');
    });
  });

  describe('requestModeTransition', () => {
    test('should allow upgrade to more restrictive mode', async () => {
      adapter.setMode(DaemonBoundaryMode.OPEN);

      const result = await adapter.requestModeTransition({
        target_mode: DaemonBoundaryMode.TRUSTED,
        requester: 'admin',
        reason: 'Entering protected work',
      });

      expect(result.success).toBe(true);
      expect(result.current_mode).toBe(DaemonBoundaryMode.TRUSTED);
    });

    test('should not allow downgrade without override', async () => {
      adapter.setMode(DaemonBoundaryMode.AIRGAP);

      const result = await adapter.requestModeTransition({
        target_mode: DaemonBoundaryMode.OPEN,
        requester: 'admin',
        reason: 'Returning to normal',
      });

      expect(result.success).toBe(false);
      expect(result.requires_cooldown).toBe(true);
    });

    test('should not allow transition out of lockdown without override', async () => {
      await adapter.triggerLockdown('Security incident', 'admin');

      const result = await adapter.requestModeTransition({
        target_mode: DaemonBoundaryMode.OPEN,
        requester: 'admin',
        reason: 'Trying to escape lockdown',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('override ceremony');
    });
  });

  describe('performOverrideCeremony', () => {
    test('should allow override with physical presence', async () => {
      await adapter.triggerLockdown('Security incident', 'admin');

      const result = await adapter.performOverrideCeremony({
        target_mode: DaemonBoundaryMode.TRUSTED,
        operator: 'admin',
        confirmation_code: 'CONFIRM-123',
        physical_presence_verified: true,
        reason: 'Incident resolved',
      });

      expect(result.success).toBe(true);
      expect(result.new_mode).toBe(DaemonBoundaryMode.TRUSTED);
    });

    test('should deny override without physical presence', async () => {
      const result = await adapter.performOverrideCeremony({
        target_mode: DaemonBoundaryMode.OPEN,
        operator: 'admin',
        confirmation_code: 'CONFIRM-123',
        physical_presence_verified: false,
        reason: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Physical presence');
    });
  });

  describe('triggerLockdown', () => {
    test('should enter lockdown mode', async () => {
      const status = await adapter.triggerLockdown('Security incident', 'admin');

      expect(status.mode).toBe(DaemonBoundaryMode.LOCKDOWN);
      expect(status.in_lockdown).toBe(true);
      expect(status.lockdown_reason).toBe('Security incident');
    });
  });

  describe('mode change listeners', () => {
    test('should notify listeners on mode change', async () => {
      const listener = jest.fn();
      adapter.onModeChange(listener);

      adapter.setMode(DaemonBoundaryMode.TRUSTED);

      expect(listener).toHaveBeenCalledWith(
        DaemonBoundaryMode.OPEN,
        DaemonBoundaryMode.TRUSTED,
        expect.any(String)
      );
    });
  });

  describe('tripwire simulation', () => {
    test('should trigger lockdown on tripwire', () => {
      const tripwireListener = jest.fn();
      adapter.onTripwire(tripwireListener);

      adapter.simulateTripwire(TripwireType.NETWORK_VIOLATION, 'Network detected in AIRGAP');

      expect(tripwireListener).toHaveBeenCalled();
    });
  });
});

describe('BoundaryEnforcedSystem', () => {
  let system: LearningContractsSystem;
  let adapter: MockBoundaryDaemonAdapter;
  let boundarySystem: BoundaryEnforcedSystem;

  beforeEach(() => {
    system = new LearningContractsSystem();
    adapter = new MockBoundaryDaemonAdapter(DaemonBoundaryMode.OPEN);
    boundarySystem = new BoundaryEnforcedSystem({
      adapter,
      contractResolver: (id: string) => system.getContract(id),
      activeContractsProvider: () => system.getActiveContracts(),
    });
  });

  afterEach(() => {
    boundarySystem.destroy();
  });

  describe('initialization', () => {
    test('should sync with daemon on initialize', async () => {
      adapter.setMode(DaemonBoundaryMode.TRUSTED);
      await boundarySystem.initialize();

      expect(boundarySystem.getCachedMode()).toBe(DaemonBoundaryMode.TRUSTED);
    });
  });

  describe('canContractOperate', () => {
    test('should return true when mode meets contract requirement', () => {
      adapter.setMode(DaemonBoundaryMode.TRUSTED);

      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Episodic requires NORMAL which maps to OPEN or higher
      expect(boundarySystem.canContractOperate(contract)).toBe(true);
    });

    test('should return false when mode is below contract requirement', () => {
      adapter.setMode(DaemonBoundaryMode.OPEN);

      let contract = system.createStrategicContract('alice', {
        domains: ['business'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Strategic requires TRUSTED, OPEN is below that
      expect(boundarySystem.canContractOperate(contract)).toBe(false);
    });
  });

  describe('automatic suspension on downgrade', () => {
    test('should suspend contracts when boundary downgrades', async () => {
      // Create strategic contract (requires TRUSTED)
      let contract = system.createStrategicContract('alice', {
        domains: ['business'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Start in TRUSTED mode where contract can operate
      adapter.setMode(DaemonBoundaryMode.TRUSTED);
      await boundarySystem.initialize();

      expect(boundarySystem.isContractSuspended(contract.contract_id)).toBe(false);

      // Downgrade to OPEN mode
      adapter.setMode(DaemonBoundaryMode.OPEN);

      // Contract should be suspended
      expect(boundarySystem.isContractSuspended(contract.contract_id)).toBe(true);
    });

    test('should emit suspension event', async () => {
      const suspensionListener = jest.fn();
      boundarySystem.onSuspension(suspensionListener);

      let contract = system.createStrategicContract('alice', {
        domains: ['business'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      adapter.setMode(DaemonBoundaryMode.TRUSTED);
      await boundarySystem.initialize();

      // Downgrade
      adapter.setMode(DaemonBoundaryMode.OPEN);

      expect(suspensionListener).toHaveBeenCalledWith(
        expect.objectContaining({
          contract_id: contract.contract_id,
        })
      );
    });
  });

  describe('automatic resume on upgrade', () => {
    test('should resume contracts when boundary upgrades', async () => {
      let contract = system.createStrategicContract('alice', {
        domains: ['business'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      // Start in OPEN mode (contract will be suspended on init)
      adapter.setMode(DaemonBoundaryMode.OPEN);
      await boundarySystem.initialize();

      expect(boundarySystem.isContractSuspended(contract.contract_id)).toBe(true);

      // Upgrade to TRUSTED mode
      adapter.setMode(DaemonBoundaryMode.TRUSTED);

      // Contract should be resumed
      expect(boundarySystem.isContractSuspended(contract.contract_id)).toBe(false);
    });

    test('should emit resume event', async () => {
      const resumeListener = jest.fn();
      boundarySystem.onResume(resumeListener);

      let contract = system.createStrategicContract('alice', {
        domains: ['business'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      adapter.setMode(DaemonBoundaryMode.OPEN);
      await boundarySystem.initialize();

      // Upgrade
      adapter.setMode(DaemonBoundaryMode.TRUSTED);

      expect(resumeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          contract_id: contract.contract_id,
        })
      );
    });
  });

  describe('recall gate', () => {
    test('should check recall gate with daemon', async () => {
      adapter.setMode(DaemonBoundaryMode.TRUSTED);

      const result = await boundarySystem.checkRecallGate({
        memory_class: 2,
        memory_id: 'mem_123',
        requester: 'alice',
      });

      expect(result.allowed).toBe(true);
    });

    test('should deny recall above classification cap', async () => {
      adapter.setMode(DaemonBoundaryMode.OPEN);

      const result = await boundarySystem.checkRecallGate({
        memory_class: 3,
        memory_id: 'mem_123',
        requester: 'alice',
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe('tool gate', () => {
    test('should check tool gate with daemon', async () => {
      adapter.setMode(DaemonBoundaryMode.OPEN);

      const result = await boundarySystem.checkToolGate({
        tool_name: 'curl',
        requires_network: true,
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('lockdown', () => {
    test('should trigger lockdown through boundary system', async () => {
      const status = await boundarySystem.triggerLockdown('Emergency', 'admin');

      expect(status.in_lockdown).toBe(true);
      expect(boundarySystem.getCachedMode()).toBe(DaemonBoundaryMode.LOCKDOWN);
    });

    test('should suspend all contracts on lockdown', async () => {
      let contract1 = system.createEpisodicContract('alice', {
        domains: ['test1'],
      });
      contract1 = system.submitForReview(contract1.contract_id, 'alice');
      contract1 = system.activateContract(contract1.contract_id, 'alice');

      let contract2 = system.createProceduralContract('bob', {
        domains: ['test2'],
      });
      contract2 = system.submitForReview(contract2.contract_id, 'bob');
      contract2 = system.activateContract(contract2.contract_id, 'bob');

      await boundarySystem.initialize();

      // Trigger lockdown
      await boundarySystem.triggerLockdown('Emergency', 'admin');

      // All contracts should be suspended
      expect(boundarySystem.isContractSuspended(contract1.contract_id)).toBe(true);
      expect(boundarySystem.isContractSuspended(contract2.contract_id)).toBe(true);
    });
  });

  describe('manual suspension/resume', () => {
    test('should manually suspend a contract', async () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      await boundarySystem.initialize();

      const event = boundarySystem.suspendContract(contract.contract_id, 'Manual test');

      expect(event).not.toBeNull();
      expect(boundarySystem.isContractSuspended(contract.contract_id)).toBe(true);
    });

    test('should manually resume a suspended contract', async () => {
      let contract = system.createEpisodicContract('alice', {
        domains: ['test'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      await boundarySystem.initialize();

      boundarySystem.suspendContract(contract.contract_id, 'Manual test');
      const event = boundarySystem.resumeContract(contract.contract_id, 'Test complete');

      expect(event).not.toBeNull();
      expect(boundarySystem.isContractSuspended(contract.contract_id)).toBe(false);
    });
  });

  describe('getSuspendedContracts', () => {
    test('should return list of suspended contracts', async () => {
      let contract1 = system.createStrategicContract('alice', {
        domains: ['business'],
      });
      contract1 = system.submitForReview(contract1.contract_id, 'alice');
      contract1 = system.activateContract(contract1.contract_id, 'alice');

      let contract2 = system.createStrategicContract('bob', {
        domains: ['strategy'],
      });
      contract2 = system.submitForReview(contract2.contract_id, 'bob');
      contract2 = system.activateContract(contract2.contract_id, 'bob');

      adapter.setMode(DaemonBoundaryMode.OPEN);
      await boundarySystem.initialize();

      const suspended = boundarySystem.getSuspendedContracts();

      expect(suspended.length).toBe(2);
    });
  });
});
