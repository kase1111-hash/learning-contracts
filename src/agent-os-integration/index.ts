/**
 * Agent-OS Integration Module
 *
 * Integrates Learning Contracts with Agent-OS, the constitutional
 * operating system for AI agents.
 *
 * @see https://github.com/kase1111-hash/Agent-OS
 *
 * This module provides:
 * - Memory adapter: Bridges Learning Contracts with Agent-OS memory (Seshat)
 * - Boundary adapter: Bridges Learning Contracts with Agent-OS security (Smith)
 * - Kernel hooks: Enforces contracts at the kernel level
 * - Consent bridge: Aligns consent models between both systems
 * - Python interop: Communication layer for Python-based Agent-OS
 *
 * @example
 * ```typescript
 * import {
 *   AgentOSMemoryAdapter,
 *   AgentOSBoundaryAdapter,
 *   AgentOSKernelHooks,
 *   AgentOSConsentBridge,
 *   MockAgentOSMemoryClient,
 *   MockAgentOSBoundaryClient,
 *   MockAgentOSKernelClient,
 * } from './agent-os-integration';
 *
 * // Create mock clients for development/testing
 * const memoryClient = new MockAgentOSMemoryClient();
 * const boundaryClient = new MockAgentOSBoundaryClient();
 * const kernelClient = new MockAgentOSKernelClient();
 *
 * // Create adapters
 * const memoryAdapter = new AgentOSMemoryAdapter(memoryClient);
 * const boundaryAdapter = new AgentOSBoundaryAdapter(boundaryClient);
 *
 * // Create kernel hooks
 * const kernelHooks = new AgentOSKernelHooks(kernelClient, lcs);
 * await kernelHooks.initialize();
 *
 * // Create consent bridge
 * const consentBridge = new AgentOSConsentBridge(lcs);
 * ```
 *
 * @packageDocumentation
 */

// Types
export * from './types';

// Memory Adapter
export {
  AgentOSMemoryAdapter,
  AgentOSMemoryClient,
  MockAgentOSMemoryClient,
} from './memory-adapter';

// Boundary Adapter
export {
  AgentOSBoundaryAdapter,
  AgentOSBoundaryClient,
  MockAgentOSBoundaryClient,
} from './boundary-adapter';

// Kernel Hooks
export {
  AgentOSKernelHooks,
  AgentOSKernelClient,
  MockAgentOSKernelClient,
  KernelHookHandler,
  createKernelRules,
  createKernelPolicies,
} from './kernel-hooks';

// Consent Bridge
export {
  AgentOSConsentBridge,
  ConsentBridgeConfig,
  ConsentRecord,
} from './consent-bridge';

// Python Interop
export {
  InteropTransport,
  MockInteropTransport,
  HttpInteropTransport,
  AgentOSPythonClient,
  generatePythonClientCode,
  generateAgentOSIntegrationModule,
} from './python-interop';
