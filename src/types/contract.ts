/**
 * Learning Contract Types
 *
 * Defines explicit, enforceable agreements governing what a learning
 * co-worker/assistant is allowed to learn, how it may generalize that
 * learning, how long it may retain it, and under what conditions it
 * may be recalled or revoked.
 */

/**
 * Contract Types
 */
export enum ContractType {
  /** May observe signals, may NOT store memory, may NOT generalize */
  OBSERVATION = 'observation',
  /** May store specific episodes, no cross-context generalization */
  EPISODIC = 'episodic',
  /** May derive reusable heuristics, scope-limited */
  PROCEDURAL = 'procedural',
  /** May infer long-term strategies, requires high-trust boundary mode */
  STRATEGIC = 'strategic',
  /** Explicitly forbids learning, overrides all other contracts */
  PROHIBITED = 'prohibited',
}

/**
 * Contract Lifecycle States
 */
export enum ContractState {
  DRAFT = 'draft',
  REVIEW = 'review',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  AMENDED = 'amended',
}

/**
 * Abstraction levels for learning
 */
export enum AbstractionLevel {
  RAW = 'raw',
  PATTERN = 'pattern',
  HEURISTIC = 'heuristic',
  STRATEGY = 'strategy',
}

/**
 * Memory retention duration
 */
export enum RetentionDuration {
  SESSION = 'session',
  TIMEBOUND = 'timebound',
  PERMANENT = 'permanent',
}

/**
 * Boundary modes for integration with Boundary Daemon
 */
export enum BoundaryMode {
  RESTRICTED = 'restricted',
  NORMAL = 'normal',
  TRUSTED = 'trusted',
  PRIVILEGED = 'privileged',
}

/**
 * Learning scope dimensions
 */
export interface LearningScope {
  /** Domain areas (e.g., finance, design, personal) */
  domains: string[];
  /** Context identifiers (e.g., project, toolchain) */
  contexts: string[];
  /** Specific tools or capabilities */
  tools: string[];
  /** Maximum abstraction level allowed */
  max_abstraction: AbstractionLevel;
  /** Whether learning can be transferred to other systems */
  transferable: boolean;
}

/**
 * Memory storage permissions
 */
export interface MemoryPermissions {
  /** Whether memory storage is allowed */
  may_store: boolean;
  /** Maximum classification level (0-5, aligned with Memory Vault) */
  classification_cap: number;
  /** How long memory may be retained */
  retention: RetentionDuration;
  /** Custom retention timestamp for timebound retention */
  retention_until?: Date;
}

/**
 * Generalization rules
 */
export interface GeneralizationRules {
  /** Whether generalization is allowed */
  allowed: boolean;
  /** Conditions under which generalization may occur */
  conditions: string[];
}

/**
 * Recall rules
 */
export interface RecallRules {
  /** Whether owner presence is required for recall */
  requires_owner: boolean;
  /** Minimum boundary mode required for recall */
  boundary_mode_min: BoundaryMode;
}

/**
 * Complete Learning Contract
 */
export interface LearningContract {
  /** Unique contract identifier */
  contract_id: string;
  /** Creation timestamp */
  created_at: Date;
  /** Human who created the contract */
  created_by: string;
  /** Current state in lifecycle */
  state: ContractState;
  /** Type of learning contract */
  contract_type: ContractType;
  /** Learning scope definition */
  scope: LearningScope;
  /** Memory storage permissions */
  memory_permissions: MemoryPermissions;
  /** Generalization rules */
  generalization_rules: GeneralizationRules;
  /** Recall rules */
  recall_rules: RecallRules;
  /** Contract expiration timestamp (null for no expiration) */
  expiration: Date | null;
  /** Whether contract can be revoked */
  revocable: boolean;
  /** Metadata for amendments and transitions */
  metadata?: {
    amended_from?: string;
    amendment_reason?: string;
    [key: string]: any;
  };
}

/**
 * Contract validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Enforcement check context
 */
export interface EnforcementContext {
  /** Contract being checked */
  contract: LearningContract;
  /** Current boundary mode */
  boundary_mode: BoundaryMode;
  /** Domain of the operation */
  domain?: string;
  /** Context of the operation */
  context?: string;
  /** Tool being used */
  tool?: string;
  /** Abstraction level of the operation */
  abstraction_level?: AbstractionLevel;
  /** Whether this is a transfer operation */
  is_transfer?: boolean;
  /** Identity of the requester (for owner presence validation) */
  requester?: string;
}

/**
 * Enforcement result
 */
export interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  contract_id: string;
}
