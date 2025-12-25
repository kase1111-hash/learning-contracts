/**
 * Agent-OS Integration Types
 *
 * Type definitions for integrating Learning Contracts with Agent-OS,
 * the constitutional operating system for AI agents.
 *
 * @see https://github.com/kase1111-hash/Agent-OS
 */

import { ContractType, ContractState } from '../types';
import { ClassificationLevel } from '../vault-integration';
import { DaemonBoundaryMode } from '../boundary-integration';

/**
 * Agent-OS Authority Hierarchy
 * Maps to Agent-OS constitutional authority tiers
 */
export enum AuthorityTier {
  /** Ultimate control - cannot be overridden */
  HUMAN_STEWARD = 0,
  /** Delegated administrative authority */
  ADMINISTRATOR = 1,
  /** Constitutional law level */
  CONSTITUTIONAL = 2,
  /** System-level instructions */
  SYSTEM = 3,
  /** Role-specific instructions */
  ROLE = 4,
  /** Task-level prompts */
  TASK = 5,
}

/**
 * Agent-OS Agent Types
 * Core agents defined in Agent-OS constitution
 */
export enum AgentOSAgentType {
  /** Request routing and orchestration */
  WHISPER = 'whisper',
  /** Security enforcement and boundary auditing */
  SMITH = 'smith',
  /** Educational guidance and problem-solving */
  SAGE = 'sage',
  /** Memory management with consent protocols */
  SESHAT = 'seshat',
  /** Document creation and editing */
  QUILL = 'quill',
  /** Creative ideation and brainstorming */
  MUSE = 'muse',
}

/**
 * Agent-OS Memory Class (consent-based)
 * Aligns with Agent-OS three-tier memory consent model
 */
export enum AgentOSMemoryClass {
  /** Disappears after conversation ends */
  EPHEMERAL = 'ephemeral',
  /** Persists during session, cleared on close */
  WORKING = 'working',
  /** Persists across sessions with explicit consent */
  LONG_TERM = 'long_term',
}

/**
 * Mapping from Agent-OS memory class to Learning Contracts classification
 */
export const MEMORY_CLASS_TO_CLASSIFICATION: Record<AgentOSMemoryClass, ClassificationLevel> = {
  [AgentOSMemoryClass.EPHEMERAL]: 0,
  [AgentOSMemoryClass.WORKING]: 1,
  [AgentOSMemoryClass.LONG_TERM]: 3,
};

/**
 * Mapping from Agent-OS memory class to Learning Contract type
 */
export const MEMORY_CLASS_TO_CONTRACT_TYPE: Record<AgentOSMemoryClass, ContractType> = {
  [AgentOSMemoryClass.EPHEMERAL]: ContractType.OBSERVATION,
  [AgentOSMemoryClass.WORKING]: ContractType.EPISODIC,
  [AgentOSMemoryClass.LONG_TERM]: ContractType.PROCEDURAL,
};

/**
 * Agent-OS Kernel Event Types
 * Events from the Agent-OS kernel that Learning Contracts can hook into
 */
export enum KernelEventType {
  /** Agent started processing */
  AGENT_START = 'agent_start',
  /** Agent completed processing */
  AGENT_END = 'agent_end',
  /** Memory access requested */
  MEMORY_ACCESS = 'memory_access',
  /** Memory write requested */
  MEMORY_WRITE = 'memory_write',
  /** Memory deletion requested */
  MEMORY_DELETE = 'memory_delete',
  /** Context switch between agents */
  CONTEXT_SWITCH = 'context_switch',
  /** Policy check requested */
  POLICY_CHECK = 'policy_check',
  /** Rule evaluation triggered */
  RULE_EVAL = 'rule_eval',
  /** Security boundary check */
  BOUNDARY_CHECK = 'boundary_check',
}

/**
 * Agent-OS Kernel Event
 */
export interface KernelEvent {
  event_id: string;
  event_type: KernelEventType;
  timestamp: Date;
  agent: AgentOSAgentType | string;
  payload: Record<string, unknown>;
  authority_tier: AuthorityTier;
}

/**
 * Agent-OS Consent Request
 * Represents a consent request from Agent-OS memory system
 */
export interface AgentOSConsentRequest {
  request_id: string;
  memory_class: AgentOSMemoryClass;
  agent: AgentOSAgentType | string;
  purpose: string;
  data_type: string;
  retention_requested?: string;
  user_id: string;
  timestamp: Date;
}

/**
 * Agent-OS Consent Response
 */
export interface AgentOSConsentResponse {
  request_id: string;
  granted: boolean;
  contract_id?: string;
  denial_reason?: string;
  expiry?: Date;
  conditions?: string[];
}

/**
 * Agent-OS Memory Operation
 * Represents a memory operation from Agent-OS
 */
export interface AgentOSMemoryOperation {
  operation_id: string;
  operation_type: 'store' | 'recall' | 'delete' | 'index' | 'query';
  memory_class: AgentOSMemoryClass;
  agent: AgentOSAgentType | string;
  memory_key?: string;
  content_hash?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Agent-OS Boundary Status
 * Maps Agent-OS boundary modes to Learning Contracts boundary modes
 */
export interface AgentOSBoundaryStatus {
  /** Current Agent-OS boundary mode name */
  mode_name: string;
  /** Mapped Learning Contracts boundary mode */
  lc_mode: DaemonBoundaryMode;
  /** Whether network is available */
  network_available: boolean;
  /** Maximum classification allowed */
  max_classification: ClassificationLevel;
  /** Whether in lockdown state */
  in_lockdown: boolean;
}

/**
 * Agent-OS Integration Configuration
 */
export interface AgentOSIntegrationConfig {
  /** Agent-OS kernel IPC endpoint (unix socket or HTTP) */
  kernel_endpoint?: string;
  /** Agent-OS memory service endpoint */
  memory_endpoint?: string;
  /** Agent-OS boundary service endpoint */
  boundary_endpoint?: string;
  /** Whether to auto-create contracts for consent requests */
  auto_create_contracts: boolean;
  /** Default contract type for auto-creation */
  default_contract_type: ContractType;
  /** Default retention duration for auto-created contracts (ms) */
  default_retention_duration?: number;
  /** Whether to enforce boundary mode alignment */
  enforce_boundary_alignment: boolean;
  /** Authority tier for Learning Contracts system */
  authority_tier: AuthorityTier;
  /** Agents that are exempt from enforcement (for bootstrapping) */
  exempt_agents?: AgentOSAgentType[];
}

/**
 * Default configuration
 */
export const DEFAULT_AGENT_OS_CONFIG: AgentOSIntegrationConfig = {
  auto_create_contracts: false,
  default_contract_type: ContractType.EPISODIC,
  enforce_boundary_alignment: true,
  authority_tier: AuthorityTier.SYSTEM,
  exempt_agents: [AgentOSAgentType.SMITH], // Security agent needs access during bootstrap
};

/**
 * Agent-OS Hook Registration
 */
export interface AgentOSHookRegistration {
  hook_id: string;
  event_types: KernelEventType[];
  priority: number;
  handler_name: string;
  registered_at: Date;
}

/**
 * Agent-OS Hook Result
 */
export interface AgentOSHookResult {
  hook_id: string;
  event_id: string;
  allowed: boolean;
  reason?: string;
  modifications?: Record<string, unknown>;
  audit_logged: boolean;
}

/**
 * Learning Contract to Agent-OS Mapping
 * Maps Learning Contracts concepts to Agent-OS equivalents
 */
export interface ContractAgentOSMapping {
  contract_id: string;
  contract_type: ContractType;
  contract_state: ContractState;
  /** Corresponding Agent-OS memory class */
  aos_memory_class: AgentOSMemoryClass;
  /** Allowed agents */
  aos_allowed_agents: (AgentOSAgentType | string)[];
  /** Required authority tier */
  aos_min_authority: AuthorityTier;
  /** Agent-OS consent ID if consent was captured */
  aos_consent_id?: string;
}

/**
 * Agent-OS Interop Message
 * Standard message format for TypeScript-Python interop
 */
export interface AgentOSInteropMessage {
  message_id: string;
  message_type: 'request' | 'response' | 'event' | 'error';
  source: 'learning_contracts' | 'agent_os';
  timestamp: Date;
  payload: Record<string, unknown>;
  correlation_id?: string;
}

/**
 * Agent-OS Interop Request
 */
export interface AgentOSInteropRequest extends AgentOSInteropMessage {
  message_type: 'request';
  method: string;
  params: Record<string, unknown>;
  timeout_ms?: number;
}

/**
 * Agent-OS Interop Response
 */
export interface AgentOSInteropResponse extends AgentOSInteropMessage {
  message_type: 'response';
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Consent alignment result between Learning Contracts and Agent-OS
 */
export interface ConsentAlignmentResult {
  aligned: boolean;
  lc_contract_id?: string;
  aos_consent_id?: string;
  discrepancies?: string[];
  recommended_action?: 'create_contract' | 'update_contract' | 'revoke_consent' | 'none';
}

/**
 * Agent-OS Integration Status
 */
export interface AgentOSIntegrationStatus {
  connected: boolean;
  kernel_connected: boolean;
  memory_connected: boolean;
  boundary_connected: boolean;
  hooks_registered: number;
  active_mappings: number;
  last_sync: Date;
  errors?: string[];
}
