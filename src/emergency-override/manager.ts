/**
 * Emergency Override Manager
 *
 * Provides a "pause all learning" capability that immediately blocks
 * all learning operations system-wide. This implements the human
 * supremacy principle - humans can override any system at any time.
 *
 * When active:
 * - All memory creation is blocked
 * - All abstraction/generalization is blocked
 * - All recall operations are blocked
 * - All export operations are blocked
 * - All blocked operations are logged to the audit trail
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EmergencyOverrideConfig,
  EmergencyOverrideStatus,
  OverrideTriggerEvent,
  OverrideDisableEvent,
  OverrideTriggerResult,
  OverrideDisableResult,
  OverrideTriggerListener,
  OverrideDisableListener,
  BlockedOperationListener,
} from './types';
import { AuditLogger } from '../audit/logger';

export class EmergencyOverrideManager {
  private active = false;
  private reason?: string;
  private triggeredAt?: Date;
  private triggeredBy?: string;
  private operationsBlocked = 0;
  private autoDisableTimeout?: ReturnType<typeof setTimeout>;

  private triggerListeners: OverrideTriggerListener[] = [];
  private disableListeners: OverrideDisableListener[] = [];
  private blockedOperationListeners: BlockedOperationListener[] = [];

  constructor(
    private auditLogger: AuditLogger,
    private config: EmergencyOverrideConfig = {}
  ) {}

  /**
   * Triggers the emergency override, blocking all learning operations
   */
  triggerOverride(
    triggeredBy: string,
    reason: string,
    activeContractCount: number = 0
  ): OverrideTriggerResult {
    if (this.active) {
      return {
        success: false,
        event_id: '',
        timestamp: new Date(),
        active_contracts_blocked: 0,
        error: 'Emergency override is already active',
      };
    }

    const eventId = uuidv4();
    const timestamp = new Date();

    this.active = true;
    this.reason = reason;
    this.triggeredAt = timestamp;
    this.triggeredBy = triggeredBy;
    this.operationsBlocked = 0;

    // Set up auto-disable if configured
    if (this.config.maxDurationMs && this.config.maxDurationMs > 0) {
      this.autoDisableTimeout = setTimeout(() => {
        this.disableOverride(
          'system',
          'Auto-disabled after maximum duration exceeded'
        );
      }, this.config.maxDurationMs);
    }

    const event: OverrideTriggerEvent = {
      event_id: eventId,
      timestamp,
      triggered_by: triggeredBy,
      reason,
      active_contracts_blocked: activeContractCount,
    };

    // Log to audit trail
    this.auditLogger.logCustomEvent(
      'emergency_override_triggered',
      {
        reason,
        active_contracts_blocked: activeContractCount,
      },
      triggeredBy
    );

    // Notify listeners
    for (const listener of this.triggerListeners) {
      try {
        listener(event);
      } catch {
        // Don't let listener errors affect the override
      }
    }

    return {
      success: true,
      event_id: eventId,
      timestamp,
      active_contracts_blocked: activeContractCount,
    };
  }

  /**
   * Disables the emergency override, resuming normal operation
   */
  disableOverride(
    disabledBy: string,
    reason?: string,
    confirmationToken?: string
  ): OverrideDisableResult {
    if (!this.active) {
      return {
        success: false,
        event_id: '',
        timestamp: new Date(),
        duration_ms: 0,
        operations_blocked_during: 0,
        error: 'Emergency override is not active',
      };
    }

    // Check confirmation requirement
    if (this.config.requireConfirmationToDisable && !confirmationToken) {
      return {
        success: false,
        event_id: '',
        timestamp: new Date(),
        duration_ms: 0,
        operations_blocked_during: 0,
        error: 'Confirmation token required to disable emergency override',
      };
    }

    // Clear auto-disable timeout
    if (this.autoDisableTimeout) {
      clearTimeout(this.autoDisableTimeout);
      this.autoDisableTimeout = undefined;
    }

    const eventId = uuidv4();
    const timestamp = new Date();
    const durationMs = this.triggeredAt
      ? timestamp.getTime() - this.triggeredAt.getTime()
      : 0;
    const operationsBlockedDuring = this.operationsBlocked;

    const event: OverrideDisableEvent = {
      event_id: eventId,
      timestamp,
      disabled_by: disabledBy,
      reason,
      duration_ms: durationMs,
      operations_blocked_during: operationsBlockedDuring,
    };

    // Log to audit trail
    this.auditLogger.logCustomEvent(
      'emergency_override_disabled',
      {
        reason,
        duration_ms: durationMs,
        operations_blocked_during: operationsBlockedDuring,
      },
      disabledBy
    );

    // Reset state
    this.active = false;
    this.reason = undefined;
    this.triggeredAt = undefined;
    this.triggeredBy = undefined;
    this.operationsBlocked = 0;

    // Notify listeners
    for (const listener of this.disableListeners) {
      try {
        listener(event);
      } catch {
        // Don't let listener errors affect the disable
      }
    }

    return {
      success: true,
      event_id: eventId,
      timestamp,
      duration_ms: durationMs,
      operations_blocked_during: operationsBlockedDuring,
    };
  }

  /**
   * Checks if an operation should be blocked due to emergency override
   * Returns the block reason if blocked, undefined if allowed
   */
  checkOperation(
    operation: 'memory_creation' | 'abstraction' | 'recall' | 'export',
    contractId: string
  ): string | undefined {
    if (!this.active) {
      return undefined;
    }

    this.operationsBlocked++;

    const blockReason = `Emergency override active: ${this.reason ?? 'All learning paused'}`;

    // Log to audit trail
    this.auditLogger.logCustomEvent(
      'emergency_override_blocked_operation',
      {
        operation,
        override_reason: this.reason,
        triggered_by: this.triggeredBy,
        triggered_at: this.triggeredAt?.toISOString(),
      },
      'system',
      contractId
    );

    // Notify listeners
    for (const listener of this.blockedOperationListeners) {
      try {
        listener(operation, contractId, blockReason);
      } catch {
        // Don't let listener errors affect the check
      }
    }

    return blockReason;
  }

  /**
   * Gets the current status of the emergency override
   */
  getStatus(): EmergencyOverrideStatus {
    return {
      active: this.active,
      reason: this.reason,
      triggered_at: this.triggeredAt,
      triggered_by: this.triggeredBy,
      operations_blocked: this.operationsBlocked,
    };
  }

  /**
   * Checks if emergency override is currently active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Registers a listener for override trigger events
   * Returns an unsubscribe function
   */
  onTrigger(listener: OverrideTriggerListener): () => void {
    this.triggerListeners.push(listener);
    return () => {
      const index = this.triggerListeners.indexOf(listener);
      if (index > -1) {
        this.triggerListeners.splice(index, 1);
      }
    };
  }

  /**
   * Registers a listener for override disable events
   * Returns an unsubscribe function
   */
  onDisable(listener: OverrideDisableListener): () => void {
    this.disableListeners.push(listener);
    return () => {
      const index = this.disableListeners.indexOf(listener);
      if (index > -1) {
        this.disableListeners.splice(index, 1);
      }
    };
  }

  /**
   * Registers a listener for blocked operation events
   * Returns an unsubscribe function
   */
  onBlockedOperation(listener: BlockedOperationListener): () => void {
    this.blockedOperationListeners.push(listener);
    return () => {
      const index = this.blockedOperationListeners.indexOf(listener);
      if (index > -1) {
        this.blockedOperationListeners.splice(index, 1);
      }
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.autoDisableTimeout) {
      clearTimeout(this.autoDisableTimeout);
      this.autoDisableTimeout = undefined;
    }
    this.triggerListeners = [];
    this.disableListeners = [];
    this.blockedOperationListeners = [];
  }
}
