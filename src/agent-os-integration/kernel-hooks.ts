/**
 * Agent-OS Kernel Integration Hooks
 *
 * Provides hooks into the Agent-OS kernel for enforcing Learning Contracts.
 */

import { v4 as uuidv4 } from 'uuid';
import { LearningContractsSystem } from '../system';
import { LearningContract } from '../types';
import { DaemonBoundaryMode, BOUNDARY_CLASSIFICATION_CAPS } from '../boundary-integration';
import {
  KernelEventType,
  KernelEvent,
  AgentOSAgentType,
  AgentOSMemoryClass,
  AgentOSHookRegistration,
  AgentOSHookResult,
  AgentOSIntegrationConfig,
  MEMORY_CLASS_TO_CLASSIFICATION,
  DEFAULT_AGENT_OS_CONFIG,
} from './types';

export type KernelHookHandler = (event: KernelEvent, lcs: LearningContractsSystem) => Promise<AgentOSHookResult>;

export interface AgentOSKernelClient {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  registerHook(eventTypes: KernelEventType[], priority: number, handlerName: string): Promise<string>;
  unregisterHook(hookId: string): Promise<boolean>;
  onKernelEvent(callback: (event: KernelEvent) => void): () => void;
  reportHookResult(result: AgentOSHookResult): Promise<void>;
  getVersion(): Promise<string>;
  getRegisteredHooks(): Promise<AgentOSHookRegistration[]>;
}

export class MockAgentOSKernelClient implements AgentOSKernelClient {
  private hooks: Map<string, AgentOSHookRegistration> = new Map();
  private eventListeners: ((event: KernelEvent) => void)[] = [];
  private hookResults: AgentOSHookResult[] = [];

  async connect(): Promise<boolean> { return true; }
  async disconnect(): Promise<void> { }

  async registerHook(eventTypes: KernelEventType[], priority: number, handlerName: string): Promise<string> {
    const hookId = `hook_${uuidv4()}`;
    this.hooks.set(hookId, { hook_id: hookId, event_types: eventTypes, priority, handler_name: handlerName, registered_at: new Date() });
    return hookId;
  }

  async unregisterHook(hookId: string): Promise<boolean> { return this.hooks.delete(hookId); }

  onKernelEvent(callback: (event: KernelEvent) => void): () => void {
    this.eventListeners.push(callback);
    return () => { const i = this.eventListeners.indexOf(callback); if (i > -1) this.eventListeners.splice(i, 1); };
  }

  async reportHookResult(result: AgentOSHookResult): Promise<void> { this.hookResults.push(result); }
  async getVersion(): Promise<string> { return '1.0.0-mock'; }
  async getRegisteredHooks(): Promise<AgentOSHookRegistration[]> { return Array.from(this.hooks.values()); }

  emitEvent(event: KernelEvent): void {
    for (const listener of this.eventListeners) { try { listener(event); } catch { /* ignore */ } }
  }

  getHookResults(): AgentOSHookResult[] { return [...this.hookResults]; }
  clearResults(): void { this.hookResults = []; }
  reset(): void { this.hooks.clear(); this.eventListeners = []; this.hookResults = []; }
}

export class AgentOSKernelHooks {
  private client: AgentOSKernelClient;
  private lcs: LearningContractsSystem;
  private registeredHooks: Map<string, AgentOSHookRegistration> = new Map();
  private unsubscribeKernelEvents?: () => void;
  private handlers: Map<KernelEventType, KernelHookHandler> = new Map();
  private config: AgentOSIntegrationConfig;

  constructor(client: AgentOSKernelClient, lcs: LearningContractsSystem, config: Partial<AgentOSIntegrationConfig> = {}) {
    this.client = client;
    this.lcs = lcs;
    this.config = { ...DEFAULT_AGENT_OS_CONFIG, ...config };
    this.registerDefaultHandlers();
  }

  async initialize(): Promise<boolean> {
    const connected = await this.client.connect();
    if (!connected) return false;
    this.unsubscribeKernelEvents = this.client.onKernelEvent((event) => { this.handleKernelEvent(event); });
    const eventTypes = Array.from(this.handlers.keys());
    const hookId = await this.client.registerHook(eventTypes, 100, 'learning_contracts_enforcement');
    this.registeredHooks.set(hookId, { hook_id: hookId, event_types: eventTypes, priority: 100, handler_name: 'learning_contracts_enforcement', registered_at: new Date() });
    return true;
  }

  async shutdown(): Promise<void> {
    for (const hookId of this.registeredHooks.keys()) await this.client.unregisterHook(hookId);
    this.registeredHooks.clear();
    if (this.unsubscribeKernelEvents) this.unsubscribeKernelEvents();
    await this.client.disconnect();
  }

  registerHandler(eventType: KernelEventType, handler: KernelHookHandler): void {
    this.handlers.set(eventType, handler);
  }

  private async handleKernelEvent(event: KernelEvent): Promise<void> {
    const handler = this.handlers.get(event.event_type);
    if (!handler) return;
    if (this.isAgentExempt(event.agent as AgentOSAgentType)) {
      await this.client.reportHookResult({ hook_id: 'exempt', event_id: event.event_id, allowed: true, reason: 'Agent is exempt from enforcement', audit_logged: false });
      return;
    }
    try {
      const result = await handler(event, this.lcs);
      await this.client.reportHookResult(result);
    } catch (error) {
      await this.client.reportHookResult({ hook_id: 'error', event_id: event.event_id, allowed: false, reason: error instanceof Error ? error.message : 'Hook execution failed', audit_logged: true });
    }
  }

  private isAgentExempt(agent: AgentOSAgentType): boolean {
    return this.config.exempt_agents?.includes(agent) ?? false;
  }

  private registerDefaultHandlers(): void {
    this.handlers.set(KernelEventType.MEMORY_ACCESS, async (event) => this.handleMemoryAccess(event));
    this.handlers.set(KernelEventType.MEMORY_WRITE, async (event) => this.handleMemoryWrite(event));
    this.handlers.set(KernelEventType.MEMORY_DELETE, async (event) => this.handleMemoryDelete(event));
    this.handlers.set(KernelEventType.POLICY_CHECK, async (event) => this.handlePolicyCheck(event));
    this.handlers.set(KernelEventType.BOUNDARY_CHECK, async (event) => this.handleBoundaryCheck(event));
  }

  private async handleMemoryAccess(event: KernelEvent): Promise<AgentOSHookResult> {
    const domain = event.payload.domain as string | undefined;
    const contracts = this.lcs.getActiveContracts();
    const applicable = contracts.find((c: LearningContract) => c.scope.domains.includes(domain ?? ''));
    if (!applicable) {
      return { hook_id: 'memory_access', event_id: event.event_id, allowed: false, reason: 'No active contract permits this access', audit_logged: true };
    }
    return { hook_id: 'memory_access', event_id: event.event_id, allowed: true, audit_logged: true };
  }

  private async handleMemoryWrite(event: KernelEvent): Promise<AgentOSHookResult> {
    const memoryClass = event.payload.memory_class as AgentOSMemoryClass;
    const domain = event.payload.domain as string | undefined;
    const classification = MEMORY_CLASS_TO_CLASSIFICATION[memoryClass] ?? 0;
    const contracts = this.lcs.getActiveContracts();
    const applicable = contracts.find((c: LearningContract) => c.scope.domains.includes(domain ?? '') && c.memory_permissions.classification_cap >= classification);
    if (!applicable) {
      return { hook_id: 'memory_write', event_id: event.event_id, allowed: false, reason: 'No active contract permits this memory operation', audit_logged: true };
    }
    return { hook_id: 'memory_write', event_id: event.event_id, allowed: true, modifications: { contract_id: applicable.contract_id }, audit_logged: true };
  }

  private async handleMemoryDelete(event: KernelEvent): Promise<AgentOSHookResult> {
    return { hook_id: 'memory_delete', event_id: event.event_id, allowed: true, reason: 'Memory deletion permitted', audit_logged: true };
  }

  private async handlePolicyCheck(event: KernelEvent): Promise<AgentOSHookResult> {
    const policyType = event.payload.policy_type as string;
    const domain = event.payload.domain as string | undefined;
    if (policyType === 'learning' || policyType === 'abstraction') {
      const contracts = this.lcs.getActiveContracts();
      const applicable = contracts.find((c: LearningContract) => c.scope.domains.includes(domain ?? ''));
      if (!applicable) {
        return { hook_id: 'policy_check', event_id: event.event_id, allowed: false, reason: 'No active contract permits this learning operation', audit_logged: true };
      }
    }
    return { hook_id: 'policy_check', event_id: event.event_id, allowed: true, reason: 'Policy check passed', audit_logged: true };
  }

  private async handleBoundaryCheck(event: KernelEvent): Promise<AgentOSHookResult> {
    const classification = event.payload.classification as number;
    const boundaryMode = event.payload.boundary_mode as string;
    const lcMode = this.mapBoundaryMode(boundaryMode);
    const maxClassification = BOUNDARY_CLASSIFICATION_CAPS[lcMode];
    if (classification > maxClassification) {
      return { hook_id: 'boundary_check', event_id: event.event_id, allowed: false, reason: `Classification ${classification} exceeds maximum ${maxClassification} for ${boundaryMode} mode`, audit_logged: true };
    }
    return { hook_id: 'boundary_check', event_id: event.event_id, allowed: true, reason: 'Boundary check passed', audit_logged: true };
  }

  private mapBoundaryMode(aosMode: string): DaemonBoundaryMode {
    const mapping: Record<string, DaemonBoundaryMode> = {
      open: DaemonBoundaryMode.OPEN,
      standard: DaemonBoundaryMode.RESTRICTED,
      elevated: DaemonBoundaryMode.TRUSTED,
      secure: DaemonBoundaryMode.AIRGAP,
      critical: DaemonBoundaryMode.COLDROOM,
      lockdown: DaemonBoundaryMode.LOCKDOWN,
    };
    return mapping[aosMode] ?? DaemonBoundaryMode.RESTRICTED;
  }

  getRegisteredHooks(): AgentOSHookRegistration[] { return Array.from(this.registeredHooks.values()); }
  isConnected(): boolean { return this.registeredHooks.size > 0; }
}

export function createKernelRules(): Record<string, unknown>[] {
  return [
    { rule_id: 'lc_memory_consent', name: 'Learning Contracts Memory Consent', event_types: [KernelEventType.MEMORY_ACCESS, KernelEventType.MEMORY_WRITE], priority: 100, action: 'enforce_contract', fail_action: 'deny' },
    { rule_id: 'lc_abstraction_limit', name: 'Learning Contracts Abstraction Limit', event_types: [KernelEventType.POLICY_CHECK], priority: 90, action: 'check_abstraction_level', fail_action: 'deny' },
    { rule_id: 'lc_boundary_alignment', name: 'Learning Contracts Boundary Alignment', event_types: [KernelEventType.BOUNDARY_CHECK], priority: 95, action: 'check_classification', fail_action: 'deny' },
  ];
}

export function createKernelPolicies(): Record<string, unknown>[] {
  return [
    { policy_id: 'lc_nothing_learned_by_default', name: 'Nothing Learned By Default', scope: 'global', default_action: 'deny' },
    { policy_id: 'lc_explicit_consent', name: 'Explicit Consent Required', scope: 'memory', enforcement: 'strict' },
    { policy_id: 'lc_human_supremacy', name: 'Human Supremacy', scope: 'global', override_level: 'HUMAN_STEWARD', no_exceptions: true },
  ];
}
