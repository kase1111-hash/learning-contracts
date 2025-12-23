/**
 * Emergency Override Types
 *
 * Types for the emergency override system that provides
 * a "pause all learning" capability for human supremacy.
 */

/**
 * Event triggered when emergency override is activated
 */
export interface OverrideTriggerEvent {
  event_id: string;
  timestamp: Date;
  triggered_by: string;
  reason: string;
  active_contracts_blocked: number;
  details?: Record<string, unknown>;
}

/**
 * Event triggered when emergency override is deactivated
 */
export interface OverrideDisableEvent {
  event_id: string;
  timestamp: Date;
  disabled_by: string;
  reason?: string;
  duration_ms: number;
  operations_blocked_during: number;
}

/**
 * Current status of the emergency override
 */
export interface EmergencyOverrideStatus {
  active: boolean;
  reason?: string;
  triggered_at?: Date;
  triggered_by?: string;
  operations_blocked: number;
}

/**
 * Result of triggering an emergency override
 */
export interface OverrideTriggerResult {
  success: boolean;
  event_id: string;
  timestamp: Date;
  active_contracts_blocked: number;
  error?: string;
}

/**
 * Result of disabling an emergency override
 */
export interface OverrideDisableResult {
  success: boolean;
  event_id: string;
  timestamp: Date;
  duration_ms: number;
  operations_blocked_during: number;
  error?: string;
}

/**
 * Listener for override trigger events
 */
export type OverrideTriggerListener = (event: OverrideTriggerEvent) => void;

/**
 * Listener for override disable events
 */
export type OverrideDisableListener = (event: OverrideDisableEvent) => void;

/**
 * Listener for blocked operation events
 */
export type BlockedOperationListener = (
  operation: 'memory_creation' | 'abstraction' | 'recall' | 'export',
  contractId: string,
  reason: string
) => void;

/**
 * Configuration for the EmergencyOverrideManager
 */
export interface EmergencyOverrideConfig {
  /**
   * Whether to require a confirmation token for disabling the override
   */
  requireConfirmationToDisable?: boolean;

  /**
   * Maximum duration in milliseconds before auto-disable (0 = no limit)
   */
  maxDurationMs?: number;
}
