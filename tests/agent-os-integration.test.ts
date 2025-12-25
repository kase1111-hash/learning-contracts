/**
 * Agent-OS Integration Tests
 *
 * Tests for the Learning Contracts integration with Agent-OS.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LearningContractsSystem } from '../src/system';
import {
  AgentOSMemoryAdapter,
  MockAgentOSMemoryClient,
  AgentOSBoundaryAdapter,
  MockAgentOSBoundaryClient,
  AgentOSKernelHooks,
  MockAgentOSKernelClient,
  AgentOSConsentBridge,
  MockInteropTransport,
  AgentOSPythonClient,
  AgentOSMemoryClass,
  AgentOSAgentType,
  KernelEventType,
  AuthorityTier,
  generatePythonClientCode,
  generateAgentOSIntegrationModule,
  createKernelRules,
  createKernelPolicies,
} from '../src/agent-os-integration';
import { DaemonBoundaryMode } from '../src/boundary-integration';

describe('Agent-OS Integration', () => {
  let lcs: LearningContractsSystem;

  beforeEach(() => {
    lcs = new LearningContractsSystem();
  });

  describe('AgentOSMemoryAdapter', () => {
    let memoryClient: MockAgentOSMemoryClient;
    let memoryAdapter: AgentOSMemoryAdapter;

    beforeEach(async () => {
      memoryClient = new MockAgentOSMemoryClient();
      memoryAdapter = new AgentOSMemoryAdapter(memoryClient);
      await memoryAdapter.checkConnection();
    });

    it('should connect to Agent-OS memory service', async () => {
      const status = await memoryAdapter.checkConnection();
      expect(status.connected).toBe(true);
      expect(status.version).toContain('Agent-OS');
    });

    it('should store memory in Agent-OS', async () => {
      const result = await memoryAdapter.storeMemory({
        content: 'Test content',
        classification: 2,
        created_by: 'test-user',
        metadata: {
          purpose: 'testing',
          data_type: 'test',
        },
      });

      expect(result.success).toBe(true);
      expect(result.memory_id).toBeDefined();
      expect(result.memory_id).toMatch(/^lc_/);
    });

    it('should recall memory from Agent-OS', async () => {
      // Store first
      const storeResult = await memoryAdapter.storeMemory({
        content: 'Test content for recall',
        classification: 1,
        created_by: 'test-user',
      });

      expect(storeResult.success).toBe(true);

      // Recall
      const recallResult = await memoryAdapter.recallMemory({
        memory_id: storeResult.memory_id!,
        requester: 'test-user',
        justification: 'Testing',
      });

      expect(recallResult.success).toBe(true);
      expect(recallResult.content).toBeDefined();
    });

    it('should map classification to Agent-OS memory class', async () => {
      // Classification 0 -> EPHEMERAL
      const ephemeralResult = await memoryAdapter.storeMemory({
        content: 'Ephemeral',
        classification: 0,
        created_by: 'test-user',
      });

      expect(memoryAdapter.getAgentOSMemoryClass(ephemeralResult.memory_id!))
        .toBe(AgentOSMemoryClass.EPHEMERAL);

      // Classification 3 -> LONG_TERM
      const longTermResult = await memoryAdapter.storeMemory({
        content: 'Long term',
        classification: 3,
        created_by: 'test-user',
      });

      expect(memoryAdapter.getAgentOSMemoryClass(longTermResult.memory_id!))
        .toBe(AgentOSMemoryClass.LONG_TERM);
    });

    it('should handle lockdown state', async () => {
      memoryClient.setLockdown(true);

      const result = await memoryAdapter.storeMemory({
        content: 'Should fail',
        classification: 1,
        created_by: 'test-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('lockdown');
    });

    it('should tombstone memory', async () => {
      const storeResult = await memoryAdapter.storeMemory({
        content: 'To be deleted',
        classification: 1,
        created_by: 'test-user',
      });

      const tombstoneInfo = await memoryAdapter.tombstoneMemory({
        memory_id: storeResult.memory_id!,
        reason: 'User requested deletion',
        requested_by: 'test-user',
      });

      expect(tombstoneInfo.memory_id).toBe(storeResult.memory_id);

      // Recall should fail
      const recallResult = await memoryAdapter.recallMemory({
        memory_id: storeResult.memory_id!,
        requester: 'test-user',
        justification: 'Testing',
      });

      expect(recallResult.success).toBe(false);
      expect(recallResult.error).toContain('tombstoned');
    });
  });

  describe('AgentOSBoundaryAdapter', () => {
    let boundaryClient: MockAgentOSBoundaryClient;
    let boundaryAdapter: AgentOSBoundaryAdapter;

    beforeEach(async () => {
      boundaryClient = new MockAgentOSBoundaryClient();
      boundaryAdapter = new AgentOSBoundaryAdapter(boundaryClient);
      await boundaryAdapter.checkConnection();
    });

    it('should connect to Agent-OS boundary service', async () => {
      const status = await boundaryAdapter.checkConnection();
      expect(status.connected).toBe(true);
      expect(status.version).toContain('Agent-OS/Smith');
    });

    it('should get current boundary status', async () => {
      const status = await boundaryAdapter.getStatus();
      expect(status.mode).toBe(DaemonBoundaryMode.RESTRICTED);
      expect(status.healthy).toBe(true);
    });

    it('should check recall permissions', async () => {
      // Should allow class 2 in RESTRICTED mode
      const allowed = await boundaryAdapter.checkRecall({
        memory_id: 'test-mem',
        memory_class: 2,
        requester: 'test-user',
      });
      expect(allowed.allowed).toBe(true);

      // Should deny class 5 in RESTRICTED mode
      const denied = await boundaryAdapter.checkRecall({
        memory_id: 'test-mem',
        memory_class: 5,
        requester: 'test-user',
      });
      expect(denied.allowed).toBe(false);
    });

    it('should check tool permissions', async () => {
      const result = await boundaryAdapter.checkTool({
        tool_name: 'test-tool',
        requires_network: false,
      });
      expect(result.allowed).toBe(true);
    });

    it('should handle mode transitions', async () => {
      const result = await boundaryAdapter.requestModeTransition({
        target_mode: DaemonBoundaryMode.TRUSTED,
        reason: 'Testing',
        requester: 'test-user',
      });

      expect(result.success).toBe(true);
      expect(result.current_mode).toBe(DaemonBoundaryMode.TRUSTED);
    });

    it('should trigger lockdown', async () => {
      const status = await boundaryAdapter.triggerLockdown(
        'Security test',
        'test-user'
      );

      expect(status.in_lockdown).toBe(true);
      expect(status.mode).toBe(DaemonBoundaryMode.LOCKDOWN);
    });

    it('should emit mode change events', async () => {
      let eventReceived = false;
      let previousMode: DaemonBoundaryMode | null = null;
      let newMode: DaemonBoundaryMode | null = null;

      boundaryAdapter.onModeChange((prev, next, _reason) => {
        eventReceived = true;
        previousMode = prev;
        newMode = next;
      });

      await boundaryAdapter.requestModeTransition({
        target_mode: DaemonBoundaryMode.AIRGAP,
        reason: 'Testing events',
        requester: 'test-user',
      });

      expect(eventReceived).toBe(true);
      expect(previousMode).toBe(DaemonBoundaryMode.RESTRICTED);
      expect(newMode).toBe(DaemonBoundaryMode.AIRGAP);
    });
  });

  describe('AgentOSKernelHooks', () => {
    let kernelClient: MockAgentOSKernelClient;
    let kernelHooks: AgentOSKernelHooks;

    beforeEach(async () => {
      kernelClient = new MockAgentOSKernelClient();
      kernelHooks = new AgentOSKernelHooks(kernelClient, lcs);
      await kernelHooks.initialize();

      // Create a test contract
      const contract = lcs.createEpisodicContract('test-user', { domains: ['coding'] });
      lcs.submitForReview(contract.contract_id, 'test-user');
      lcs.activateContract(contract.contract_id, 'test-user');
    });

    it('should register hooks on initialization', async () => {
      expect(kernelHooks.isConnected()).toBe(true);

      const hooks = kernelHooks.getRegisteredHooks();
      expect(hooks.length).toBeGreaterThan(0);
    });

    it('should handle memory write events', async () => {
      // Emit a memory write event
      kernelClient.emitEvent({
        event_id: 'test-event-1',
        event_type: KernelEventType.MEMORY_WRITE,
        timestamp: new Date(),
        agent: AgentOSAgentType.SAGE,
        payload: {
          memory_class: AgentOSMemoryClass.WORKING,
          domain: 'coding',
          content_type: 'code-snippet',
        },
        authority_tier: AuthorityTier.ROLE,
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const results = kernelClient.getHookResults();
      expect(results.length).toBe(1);
      expect(results[0].allowed).toBe(true);
    });

    it('should deny memory operations without contract', async () => {
      // Emit a memory write event for a domain without contract
      kernelClient.emitEvent({
        event_id: 'test-event-2',
        event_type: KernelEventType.MEMORY_WRITE,
        timestamp: new Date(),
        agent: AgentOSAgentType.SAGE,
        payload: {
          memory_class: AgentOSMemoryClass.LONG_TERM,
          domain: 'medical', // No contract for this domain
          content_type: 'patient-data',
        },
        authority_tier: AuthorityTier.ROLE,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const results = kernelClient.getHookResults();
      const lastResult = results[results.length - 1];
      expect(lastResult.allowed).toBe(false);
    });

    it('should always allow memory deletion', async () => {
      kernelClient.emitEvent({
        event_id: 'test-event-3',
        event_type: KernelEventType.MEMORY_DELETE,
        timestamp: new Date(),
        agent: AgentOSAgentType.SESHAT,
        payload: {
          memory_id: 'test-memory',
          reason: 'User requested',
        },
        authority_tier: AuthorityTier.HUMAN_STEWARD,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const results = kernelClient.getHookResults();
      const lastResult = results[results.length - 1];
      expect(lastResult.allowed).toBe(true);
    });

    it('should exempt security agent from enforcement', async () => {
      kernelClient.emitEvent({
        event_id: 'test-event-4',
        event_type: KernelEventType.MEMORY_ACCESS,
        timestamp: new Date(),
        agent: AgentOSAgentType.SMITH, // Exempt agent
        payload: {
          memory_id: 'test-memory',
          memory_class: AgentOSMemoryClass.LONG_TERM,
        },
        authority_tier: AuthorityTier.SYSTEM,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const results = kernelClient.getHookResults();
      const lastResult = results[results.length - 1];
      expect(lastResult.allowed).toBe(true);
      expect(lastResult.reason).toContain('exempt');
    });

    it('should shutdown cleanly', async () => {
      await kernelHooks.shutdown();
      expect(kernelHooks.isConnected()).toBe(false);
    });
  });

  describe('AgentOSConsentBridge', () => {
    let consentBridge: AgentOSConsentBridge;

    beforeEach(() => {
      consentBridge = new AgentOSConsentBridge(lcs, {
        auto_create_contracts: true,
        default_retention_duration: 86400000,
      });
    });

    it('should process consent requests', async () => {
      const response = await consentBridge.processConsentRequest({
        request_id: 'req-1',
        memory_class: AgentOSMemoryClass.WORKING,
        agent: AgentOSAgentType.SAGE,
        purpose: 'Store coding preferences',
        data_type: 'preferences',
        user_id: 'test-user',
        timestamp: new Date(),
      });

      expect(response.granted).toBe(true);
      expect(response.contract_id).toBeDefined();
    });

    it('should reuse existing contracts for matching consent', async () => {
      // Create a contract first
      const contract = lcs.createEpisodicContract('test-user', { domains: ['preferences'] });
      lcs.submitForReview(contract.contract_id, 'test-user');
      lcs.activateContract(contract.contract_id, 'test-user');

      const response = await consentBridge.processConsentRequest({
        request_id: 'req-2',
        memory_class: AgentOSMemoryClass.WORKING,
        agent: AgentOSAgentType.SAGE,
        purpose: 'Store more preferences',
        data_type: 'preferences',
        user_id: 'test-user',
        timestamp: new Date(),
      });

      expect(response.granted).toBe(true);
      expect(response.contract_id).toBe(contract.contract_id);
    });

    it('should revoke consent and contract', async () => {
      const response = await consentBridge.processConsentRequest({
        request_id: 'req-3',
        memory_class: AgentOSMemoryClass.LONG_TERM,
        agent: AgentOSAgentType.SESHAT,
        purpose: 'Store session data',
        data_type: 'session',
        user_id: 'test-user',
        timestamp: new Date(),
      });

      expect(response.granted).toBe(true);

      // Get consent ID from records
      const record = consentBridge.getConsentByContractId(response.contract_id!);
      expect(record).toBeDefined();

      // Revoke
      const revoked = await consentBridge.revokeConsent(
        record!.aos_consent_id,
        'User requested',
        'test-user'
      );

      expect(revoked).toBe(true);

      // Check alignment - should be misaligned because contract is revoked but consent record shows active was set to false
      const alignment = await consentBridge.checkAlignment(response.contract_id);
      // After revocation, both contract and consent are inactive/revoked, so they are aligned
      expect(alignment.aligned).toBe(true);
      expect(alignment.lc_contract_id).toBe(response.contract_id);
    });

    it('should check consent alignment', async () => {
      const response = await consentBridge.processConsentRequest({
        request_id: 'req-4',
        memory_class: AgentOSMemoryClass.WORKING,
        agent: AgentOSAgentType.QUILL,
        purpose: 'Document storage',
        data_type: 'documents',
        user_id: 'test-user',
        timestamp: new Date(),
      });

      const alignment = await consentBridge.checkAlignment(response.contract_id);
      expect(alignment.aligned).toBe(true);
      expect(alignment.lc_contract_id).toBe(response.contract_id);
      expect(alignment.aos_consent_id).toBeDefined();
    });

    it('should sync all consents', async () => {
      // Create some consents
      await consentBridge.processConsentRequest({
        request_id: 'req-5',
        memory_class: AgentOSMemoryClass.EPHEMERAL,
        agent: AgentOSAgentType.MUSE,
        purpose: 'Creative ideas',
        data_type: 'ideas',
        user_id: 'test-user',
        timestamp: new Date(),
      });

      const result = await consentBridge.syncAll();
      expect(result.synced).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });

    it('should get active consents', async () => {
      await consentBridge.processConsentRequest({
        request_id: 'req-6',
        memory_class: AgentOSMemoryClass.WORKING,
        agent: AgentOSAgentType.SAGE,
        purpose: 'Learning',
        data_type: 'learning',
        user_id: 'test-user',
        timestamp: new Date(),
      });

      const activeConsents = consentBridge.getActiveConsents();
      expect(activeConsents.length).toBeGreaterThan(0);
      expect(activeConsents[0].active).toBe(true);
    });

    it('should get statistics', async () => {
      await consentBridge.processConsentRequest({
        request_id: 'req-7',
        memory_class: AgentOSMemoryClass.LONG_TERM,
        agent: AgentOSAgentType.SESHAT,
        purpose: 'Long term storage',
        data_type: 'data',
        user_id: 'test-user',
        timestamp: new Date(),
      });

      const stats = consentBridge.getStats();
      expect(stats.total_consents).toBeGreaterThan(0);
      expect(stats.active_consents).toBeGreaterThan(0);
      expect(stats.by_memory_class[AgentOSMemoryClass.LONG_TERM]).toBeGreaterThan(0);
    });
  });

  describe('AgentOSPythonClient', () => {
    let transport: MockInteropTransport;
    let client: AgentOSPythonClient;

    beforeEach(async () => {
      transport = new MockInteropTransport();
      client = new AgentOSPythonClient(transport);
      await client.connect();
    });

    it('should connect via transport', async () => {
      expect(client.isConnected()).toBe(true);
    });

    it('should call methods on Agent-OS', async () => {
      transport.setMockResponse('memory.store', () => ({
        memory_key: 'aos_mem_123',
      }));

      const result = await client.storeMemory({
        memory_class: 'working',
        content: btoa('Test content'),
      });

      expect(result.memory_key).toBe('aos_mem_123');
    });

    it('should get integration status', async () => {
      transport.setMockResponse('status.get', () => ({
        kernel: true,
        memory: true,
        boundary: true,
        hooks: 5,
        mappings: 10,
      }));

      const status = await client.getStatus();
      expect(status.connected).toBe(true);
      expect(status.kernel_connected).toBe(true);
      expect(status.memory_connected).toBe(true);
      expect(status.hooks_registered).toBe(5);
    });

    it('should handle request consent', async () => {
      transport.setMockResponse('memory.request_consent', () => ({
        granted: true,
        consent_id: 'aos_consent_123',
      }));

      const result = await client.requestMemoryConsent({
        memory_class: 'long_term',
        purpose: 'Testing',
        data_type: 'test',
        user_id: 'test-user',
      });

      expect(result.granted).toBe(true);
      expect(result.consent_id).toBe('aos_consent_123');
    });

    it('should handle security status', async () => {
      transport.setMockResponse('boundary.status', () => ({
        mode: 'standard',
        network_available: true,
        in_lockdown: false,
      }));

      const status = await client.getSecurityStatus();
      expect(status.mode).toBe('standard');
      expect(status.network_available).toBe(true);
      expect(status.in_lockdown).toBe(false);
    });

    it('should handle disconnected state', async () => {
      await client.disconnect();

      const status = await client.getStatus();
      expect(status.connected).toBe(false);
      expect(status.errors).toContain('Not connected to Agent-OS');
    });

    it('should subscribe to events', async () => {
      let eventReceived = false;
      let receivedData: Record<string, unknown> = {};

      client.onEvent((event) => {
        eventReceived = true;
        receivedData = event;
      });

      transport.emitEvent({
        message_id: 'event-1',
        message_type: 'event',
        source: 'agent_os',
        timestamp: new Date(),
        payload: { type: 'mode_change', new_mode: 'elevated' },
      });

      expect(eventReceived).toBe(true);
      expect(receivedData.type).toBe('mode_change');
    });
  });

  describe('Python Code Generation', () => {
    it('should generate valid Python client code', () => {
      const code = generatePythonClientCode();

      expect(code).toContain('class LearningContractsClient');
      expect(code).toContain('def check_memory_creation');
    });

    it('should generate valid Agent-OS integration module', () => {
      const code = generateAgentOSIntegrationModule();

      expect(code).toContain('class LearningContractsIntegration');
      expect(code).toContain('def initialize');
    });
  });

  describe('Kernel Rules and Policies', () => {
    it('should generate kernel rules', () => {
      const rules = createKernelRules();

      expect(rules.length).toBeGreaterThan(0);
      expect((rules[0] as { rule_id: string }).rule_id).toBe('lc_memory_consent');
      expect(rules.some((r: Record<string, unknown>) => r.rule_id === 'lc_abstraction_limit')).toBe(true);
      expect(rules.some((r: Record<string, unknown>) => r.rule_id === 'lc_boundary_alignment')).toBe(true);
    });

    it('should generate kernel policies', () => {
      const policies = createKernelPolicies();

      expect(policies.length).toBeGreaterThan(0);
      expect((policies[0] as { policy_id: string }).policy_id).toBe('lc_nothing_learned_by_default');
      expect(policies.some((p: Record<string, unknown>) => p.policy_id === 'lc_explicit_consent')).toBe(true);
      expect(policies.some((p: Record<string, unknown>) => p.policy_id === 'lc_human_supremacy')).toBe(true);
    });
  });

  describe('Full Integration Flow', () => {
    it('should complete full consent -> storage -> recall flow', async () => {
      // Setup all components
      const memoryClient = new MockAgentOSMemoryClient();
      const memoryAdapter = new AgentOSMemoryAdapter(memoryClient);
      const consentBridge = new AgentOSConsentBridge(lcs, {
        auto_create_contracts: true,
      });

      await memoryAdapter.checkConnection();

      // Step 1: Request consent via bridge
      const consentResponse = await consentBridge.processConsentRequest({
        request_id: 'flow-test-1',
        memory_class: AgentOSMemoryClass.WORKING,
        agent: AgentOSAgentType.SAGE,
        purpose: 'Store code patterns',
        data_type: 'code_patterns',
        user_id: 'test-user',
        timestamp: new Date(),
      });

      expect(consentResponse.granted).toBe(true);
      const contractId = consentResponse.contract_id!;

      // Step 2: Store memory via adapter
      const storeResult = await memoryAdapter.storeMemory({
        content: 'function example() { return true; }',
        classification: 1,
        created_by: 'test-user',
        metadata: {
          contract_id: contractId,
          domain: 'code_patterns',
        },
      });

      expect(storeResult.success).toBe(true);
      const memoryId = storeResult.memory_id!;

      // Step 3: Recall memory
      const recallResult = await memoryAdapter.recallMemory({
        memory_id: memoryId,
        requester: 'test-user',
        justification: 'Code review',
      });

      expect(recallResult.success).toBe(true);
      expect(recallResult.content).toBeDefined();

      // Step 4: Revoke consent
      const record = consentBridge.getConsentByContractId(contractId);
      const revoked = await consentBridge.revokeConsent(
        record!.aos_consent_id,
        'Session ended',
        'test-user'
      );

      expect(revoked).toBe(true);

      // Step 5: Verify contract is revoked
      const contract = lcs.getContract(contractId);
      expect(contract?.state).toBe('revoked');

      // Step 6: Verify alignment - after revoking both, they should be aligned (both inactive)
      const alignment = await consentBridge.checkAlignment(contractId);
      expect(alignment.aligned).toBe(true);
      expect(alignment.lc_contract_id).toBe(contractId);
    });

    it('should enforce boundary mode on memory operations', async () => {
      const boundaryClient = new MockAgentOSBoundaryClient();
      const boundaryAdapter = new AgentOSBoundaryAdapter(boundaryClient);

      await boundaryAdapter.checkConnection();

      // Set to restrictive mode
      await boundaryAdapter.requestModeTransition({
        target_mode: DaemonBoundaryMode.AIRGAP,
        reason: 'Security upgrade',
        requester: 'admin',
      });

      // High classification should be allowed in AIRGAP
      const allowed = await boundaryAdapter.checkRecall({
        memory_id: 'test',
        memory_class: 4,
        requester: 'user',
      });
      expect(allowed.allowed).toBe(true);

      // Trigger lockdown
      await boundaryAdapter.triggerLockdown('Emergency', 'admin');

      // All recalls should be blocked in lockdown
      const blocked = await boundaryAdapter.checkRecall({
        memory_id: 'test',
        memory_class: 0, // Even lowest class
        requester: 'user',
      });
      expect(blocked.allowed).toBe(false);
    });
  });
});
