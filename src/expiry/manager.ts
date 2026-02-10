/**
 * Timebound Expiry Manager
 *
 * Automatically monitors and expires contracts with timebound retention
 * when their retention_until timestamp has passed.
 */

import { v4 as uuidv4 } from 'uuid';
import { LearningContract, ContractState, RetentionDuration } from '../types';
import {
  TimeboundExpiryManagerConfig,
  ExpiryCheckResult,
  ExpiryCycleResult,
  ExpiryListener,
  CycleCompletionListener,
  ExpiryManagerStats,
} from './types';

/**
 * Timebound Expiry Manager
 *
 * Provides automatic expiry of contracts with timebound retention.
 * Can run periodic checks or be triggered manually.
 */
export class TimeboundExpiryManager {
  private config: Required<Omit<TimeboundExpiryManagerConfig, 'memoryProvider'>> & {
    memoryProvider?: TimeboundExpiryManagerConfig['memoryProvider'];
  };
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private expiryListeners: ExpiryListener[] = [];
  private cycleListeners: CycleCompletionListener[] = [];
  private lastCheckAt: Date | null = null;
  private cyclesCompleted: number = 0;
  private totalContractsExpired: number = 0;
  private totalMemoriesAffected: number = 0;
  private totalErrors: number = 0;

  constructor(config: TimeboundExpiryManagerConfig) {
    this.config = {
      findTimeboundExpired: config.findTimeboundExpired,
      contractResolver: config.contractResolver,
      contractExpirer: config.contractExpirer,
      memoryFreezer: config.memoryFreezer,
      memoryProvider: config.memoryProvider,
      checkIntervalMs: config.checkIntervalMs ?? 60000, // Default: 1 minute
      actor: config.actor ?? 'timebound-expiry-manager',
    };
  }

  /**
   * Start automatic expiry checking
   */
  start(): void {
    if (this.intervalId !== null) {
      return; // Already running
    }

    // Run an initial check immediately
    this.runExpiryCycle();

    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.runExpiryCycle();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop automatic expiry checking
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check if the manager is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Run a single expiry check cycle
   * Can be called manually even when automatic checking is not running
   */
  runExpiryCycle(): ExpiryCycleResult {
    const cycleId = uuidv4();
    const startedAt = new Date();
    const results: ExpiryCheckResult[] = [];
    const errors: string[] = [];
    let contractsExpired = 0;
    let memoriesAffected = 0;

    try {
      // Find all contracts with expired timebound retention
      const expiredContracts = this.config.findTimeboundExpired();

      for (const contract of expiredContracts) {
        try {
          const result = this.expireContract(contract);
          results.push(result);

          if (result.expired) {
            contractsExpired++;
            memoriesAffected += result.memories_frozen.length;
          }

          if (result.error) {
            errors.push(result.error);
          }
        } catch (error) {
          const errorMessage = `Failed to expire contract ${contract.contract_id}: ${
            error instanceof Error ? error.message : String(error)
          }`;
          errors.push(errorMessage);
          results.push({
            contract_id: contract.contract_id,
            expired: false,
            retention_until: contract.memory_permissions.retention_until,
            memories_frozen: [],
            error: errorMessage,
          });
        }
      }
    } catch (error) {
      errors.push(
        `Expiry cycle failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const completedAt = new Date();
    this.lastCheckAt = completedAt;
    this.cyclesCompleted++;
    this.totalContractsExpired += contractsExpired;
    this.totalMemoriesAffected += memoriesAffected;
    this.totalErrors += errors.length;

    const cycleResult: ExpiryCycleResult = {
      cycle_id: cycleId,
      started_at: startedAt,
      completed_at: completedAt,
      contracts_checked: results.length,
      contracts_expired: contractsExpired,
      memories_affected: memoriesAffected,
      results,
      errors,
    };

    // Notify cycle listeners
    for (const listener of this.cycleListeners) {
      try {
        listener(cycleResult);
      } catch (error) {
        console.error('Cycle listener error:', error);
      }
    }

    return cycleResult;
  }

  /**
   * Expire a single contract and freeze its memories
   */
  private expireContract(contract: LearningContract): ExpiryCheckResult {
    const result: ExpiryCheckResult = {
      contract_id: contract.contract_id,
      expired: false,
      retention_until: contract.memory_permissions.retention_until,
      memories_frozen: [],
    };

    // Verify contract is still active
    const currentContract = this.config.contractResolver(contract.contract_id);
    if (!currentContract || currentContract.state !== ContractState.ACTIVE) {
      result.error = 'Contract is no longer active';
      return result;
    }

    // Expire the contract
    try {
      this.config.contractExpirer(contract.contract_id, this.config.actor);
      result.expired = true;
    } catch (error) {
      result.error = `Failed to expire: ${error instanceof Error ? error.message : String(error)}`;
      return result;
    }

    // Freeze associated memories if memory provider is configured
    if (this.config.memoryProvider) {
      try {
        const memories = this.config.memoryProvider(contract.contract_id);
        if (memories.length > 0) {
          const freezeResult = this.config.memoryFreezer(contract.contract_id, memories);
          result.memories_frozen = freezeResult.affected_memories;
        }
      } catch (error) {
        // Don't fail the expiry if memory freezing fails
        result.error = `Contract expired but memory freeze failed: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }

    // Notify expiry listeners
    const updatedContract = this.config.contractResolver(contract.contract_id);
    if (updatedContract) {
      for (const listener of this.expiryListeners) {
        try {
          listener(updatedContract, result);
        } catch (error) {
          console.error('Expiry listener error:', error);
        }
      }
    }

    return result;
  }

  /**
   * Register a listener for individual contract expiry events
   */
  onExpiry(listener: ExpiryListener): () => void {
    this.expiryListeners.push(listener);
    return () => {
      const index = this.expiryListeners.indexOf(listener);
      if (index > -1) {
        this.expiryListeners.splice(index, 1);
      }
    };
  }

  /**
   * Register a listener for cycle completion events
   */
  onCycleComplete(listener: CycleCompletionListener): () => void {
    this.cycleListeners.push(listener);
    return () => {
      const index = this.cycleListeners.indexOf(listener);
      if (index > -1) {
        this.cycleListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get the check interval in milliseconds
   */
  getCheckInterval(): number {
    return this.config.checkIntervalMs;
  }

  /**
   * Set a new check interval (requires restart to take effect)
   */
  setCheckInterval(intervalMs: number): void {
    this.config.checkIntervalMs = intervalMs;

    // If running, restart with new interval
    if (this.isRunning()) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get manager statistics
   */
  getStats(): ExpiryManagerStats {
    const nextCheckAt = this.isRunning() && this.lastCheckAt
      ? new Date(this.lastCheckAt.getTime() + this.config.checkIntervalMs)
      : null;

    return {
      isRunning: this.isRunning(),
      lastCheckAt: this.lastCheckAt,
      nextCheckAt,
      cyclesCompleted: this.cyclesCompleted,
      totalContractsExpired: this.totalContractsExpired,
      totalMemoriesAffected: this.totalMemoriesAffected,
      totalErrors: this.totalErrors,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.cyclesCompleted = 0;
    this.totalContractsExpired = 0;
    this.totalMemoriesAffected = 0;
    this.totalErrors = 0;
  }

  /**
   * Check a specific contract for timebound expiry
   * Returns the result without actually expiring (dry run)
   */
  checkContract(contractId: string): ExpiryCheckResult | null {
    const contract = this.config.contractResolver(contractId);
    if (!contract) {
      return null;
    }

    const retention = contract.memory_permissions.retention;
    const retentionUntil = contract.memory_permissions.retention_until;

    if (retention !== RetentionDuration.TIMEBOUND || !retentionUntil) {
      return {
        contract_id: contractId,
        expired: false,
        retention_until: retentionUntil,
        memories_frozen: [],
        error: 'Contract is not timebound or has no retention_until',
      };
    }

    const now = new Date();
    const isExpired = retentionUntil < now;

    return {
      contract_id: contractId,
      expired: isExpired,
      retention_until: retentionUntil,
      memories_frozen: [], // Dry run doesn't freeze memories
    };
  }

  /**
   * Force expire a specific contract immediately
   * Bypasses the scheduled check
   */
  forceExpire(contractId: string): ExpiryCheckResult {
    const contract = this.config.contractResolver(contractId);
    if (!contract) {
      return {
        contract_id: contractId,
        expired: false,
        memories_frozen: [],
        error: 'Contract not found',
      };
    }

    if (contract.state !== ContractState.ACTIVE) {
      return {
        contract_id: contractId,
        expired: false,
        retention_until: contract.memory_permissions.retention_until,
        memories_frozen: [],
        error: 'Contract is not active',
      };
    }

    return this.expireContract(contract);
  }
}
