/**
 * Agent-OS Python Interoperability
 *
 * Provides TypeScript-Python interoperability for Learning Contracts
 * to communicate with Agent-OS (which is Python-based).
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentOSInteropMessage,
  AgentOSInteropRequest,
  AgentOSInteropResponse,
  AgentOSIntegrationStatus,
  KernelEventType,
} from './types';

export interface InteropTransport {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  send(message: AgentOSInteropRequest): Promise<AgentOSInteropResponse>;
  onEvent(callback: (message: AgentOSInteropMessage) => void): () => void;
  isConnected(): boolean;
}

export class MockInteropTransport implements InteropTransport {
  private _connected = false;
  private eventListeners: ((message: AgentOSInteropMessage) => void)[] = [];
  private mockResponses: Map<string, (params: Record<string, unknown>) => unknown> = new Map();

  async connect(): Promise<boolean> { this._connected = true; return true; }
  async disconnect(): Promise<void> { this._connected = false; }

  async send(message: AgentOSInteropRequest): Promise<AgentOSInteropResponse> {
    if (!this._connected) {
      return { message_id: uuidv4(), message_type: 'response', source: 'agent_os', timestamp: new Date(), payload: {}, correlation_id: message.message_id, success: false, error: { code: 'NOT_CONNECTED', message: 'Not connected to Agent-OS' } };
    }
    const handler = this.mockResponses.get(message.method);
    if (handler) {
      try {
        const result = handler(message.params);
        return { message_id: uuidv4(), message_type: 'response', source: 'agent_os', timestamp: new Date(), payload: {}, correlation_id: message.message_id, success: true, result };
      } catch (error) {
        return { message_id: uuidv4(), message_type: 'response', source: 'agent_os', timestamp: new Date(), payload: {}, correlation_id: message.message_id, success: false, error: { code: 'HANDLER_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } };
      }
    }
    return { message_id: uuidv4(), message_type: 'response', source: 'agent_os', timestamp: new Date(), payload: {}, correlation_id: message.message_id, success: true, result: { ok: true } };
  }

  onEvent(callback: (message: AgentOSInteropMessage) => void): () => void {
    this.eventListeners.push(callback);
    return () => { const i = this.eventListeners.indexOf(callback); if (i > -1) this.eventListeners.splice(i, 1); };
  }

  isConnected(): boolean { return this._connected; }

  emitEvent(message: AgentOSInteropMessage): void {
    for (const listener of this.eventListeners) { try { listener(message); } catch { /* ignore */ } }
  }

  setMockResponse(method: string, handler: (params: Record<string, unknown>) => unknown): void { this.mockResponses.set(method, handler); }
  clearMockResponses(): void { this.mockResponses.clear(); }
}

export class HttpInteropTransport implements InteropTransport {
  private baseUrl: string;
  private _connected = false;
  private eventListeners: ((message: AgentOSInteropMessage) => void)[] = [];
  private pollingInterval?: ReturnType<typeof setInterval>;

  constructor(baseUrl: string = 'http://localhost:8765') { this.baseUrl = baseUrl; }

  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (response.ok) { this._connected = true; this.startEventPolling(); return true; }
      return false;
    } catch { return false; }
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  async send(message: AgentOSInteropRequest): Promise<AgentOSInteropResponse> {
    if (!this._connected) {
      return { message_id: uuidv4(), message_type: 'response', source: 'agent_os', timestamp: new Date(), payload: {}, correlation_id: message.message_id, success: false, error: { code: 'NOT_CONNECTED', message: 'Not connected to Agent-OS' } };
    }
    try {
      const response = await fetch(`${this.baseUrl}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: message.method, params: message.params, id: message.message_id }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { message_id: uuidv4(), message_type: 'response', source: 'agent_os', timestamp: new Date(), payload: {}, correlation_id: message.message_id, success: !data.error, result: data.result, error: data.error ? { code: String(data.error.code ?? 'UNKNOWN'), message: data.error.message ?? 'Unknown error' } : undefined };
    } catch (error) {
      return { message_id: uuidv4(), message_type: 'response', source: 'agent_os', timestamp: new Date(), payload: {}, correlation_id: message.message_id, success: false, error: { code: 'TRANSPORT_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } };
    }
  }

  onEvent(callback: (message: AgentOSInteropMessage) => void): () => void {
    this.eventListeners.push(callback);
    return () => { const i = this.eventListeners.indexOf(callback); if (i > -1) this.eventListeners.splice(i, 1); };
  }

  isConnected(): boolean { return this._connected; }

  private startEventPolling(): void {
    this.pollingInterval = setInterval(async () => {
      if (!this._connected) return;
      try {
        const response = await fetch(`${this.baseUrl}/events`);
        if (response.ok) {
          const events = await response.json();
          for (const event of events) {
            const message: AgentOSInteropMessage = { message_id: event.id ?? uuidv4(), message_type: 'event', source: 'agent_os', timestamp: new Date(event.timestamp ?? Date.now()), payload: event.data ?? event };
            for (const listener of this.eventListeners) { try { listener(message); } catch { /* ignore */ } }
          }
        }
      } catch { /* ignore polling errors */ }
    }, 100);
  }
}

export class AgentOSPythonClient {
  private transport: InteropTransport;
  private requestTimeout: number;

  constructor(transport: InteropTransport, requestTimeout: number = 30000) {
    this.transport = transport;
    this.requestTimeout = requestTimeout;
  }

  async connect(): Promise<boolean> { return this.transport.connect(); }
  async disconnect(): Promise<void> { return this.transport.disconnect(); }
  isConnected(): boolean { return this.transport.isConnected(); }

  async call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const request: AgentOSInteropRequest = { message_id: uuidv4(), message_type: 'request', source: 'learning_contracts', timestamp: new Date(), payload: {}, method, params, timeout_ms: this.requestTimeout };
    const response = await this.transport.send(request);
    if (!response.success) throw new Error(response.error?.message ?? 'Request failed');
    return response.result as T;
  }

  onEvent(callback: (event: Record<string, unknown>) => void): () => void {
    return this.transport.onEvent((message) => { if (message.message_type === 'event') callback(message.payload); });
  }

  async getStatus(): Promise<AgentOSIntegrationStatus> {
    if (!this.transport.isConnected()) {
      return { connected: false, kernel_connected: false, memory_connected: false, boundary_connected: false, hooks_registered: 0, active_mappings: 0, last_sync: new Date(), errors: ['Not connected to Agent-OS'] };
    }
    try {
      const status = await this.call<{ kernel: boolean; memory: boolean; boundary: boolean; hooks: number; mappings: number }>('status.get');
      return { connected: true, kernel_connected: status.kernel, memory_connected: status.memory, boundary_connected: status.boundary, hooks_registered: status.hooks, active_mappings: status.mappings, last_sync: new Date() };
    } catch (error) {
      return { connected: false, kernel_connected: false, memory_connected: false, boundary_connected: false, hooks_registered: 0, active_mappings: 0, last_sync: new Date(), errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  }

  async requestMemoryConsent(params: { memory_class: string; purpose: string; data_type: string; user_id: string }): Promise<{ granted: boolean; consent_id?: string; reason?: string }> { return this.call('memory.request_consent', params); }
  async storeMemory(params: { memory_class: string; content: string; metadata?: Record<string, unknown> }): Promise<{ memory_key: string }> { return this.call('memory.store', params); }
  async recallMemory(params: { memory_key: string; requester: string }): Promise<{ content: string; metadata: Record<string, unknown> } | null> { return this.call('memory.recall', params); }
  async deleteMemory(params: { memory_key: string; reason: string }): Promise<{ deleted: boolean }> { return this.call('memory.delete', params); }
  async getSecurityStatus(): Promise<{ mode: string; network_available: boolean; in_lockdown: boolean }> { return this.call('boundary.status'); }
  async requestModeChange(params: { target_mode: string; reason: string; requester: string }): Promise<{ success: boolean; new_mode?: string; error?: string }> { return this.call('boundary.change_mode', params); }
  async triggerLockdown(params: { reason: string; actor: string }): Promise<{ success: boolean }> { return this.call('boundary.lockdown', params); }
  async registerKernelHook(params: { event_types: KernelEventType[]; priority: number; callback_url: string }): Promise<{ hook_id: string }> { return this.call('kernel.register_hook', params); }
  async unregisterKernelHook(params: { hook_id: string }): Promise<{ success: boolean }> { return this.call('kernel.unregister_hook', params); }
  async reportHookResult(params: { hook_id: string; event_id: string; allowed: boolean; reason?: string }): Promise<{ acknowledged: boolean }> { return this.call('kernel.hook_result', params); }
  async syncConsent(params: { contract_id: string; aos_consent_id?: string }): Promise<{ aligned: boolean; discrepancies?: string[] }> { return this.call('consent.sync', params); }
  async revokeConsent(params: { aos_consent_id: string; reason: string; revoked_by: string }): Promise<{ revoked: boolean }> { return this.call('consent.revoke', params); }
}

export function generatePythonClientCode(): string {
  return `"""Learning Contracts Client for Agent-OS"""
class LearningContractsClient:
    def __init__(self, base_url: str = "http://localhost:8766"):
        self.base_url = base_url
    def check_memory_creation(self, classification: int, domain: str = None) -> dict:
        pass  # Implementation omitted for brevity
`;
}

export function generateAgentOSIntegrationModule(): string {
  return `"""Learning Contracts Integration for Agent-OS"""
class LearningContractsIntegration:
    def __init__(self):
        pass
    def initialize(self):
        pass  # Implementation omitted for brevity
`;
}
