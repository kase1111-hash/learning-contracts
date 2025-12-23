/**
 * Timebound Expiry Types
 *
 * Types for managing automatic expiry of timebound retention contracts.
 */

import { LearningContract } from '../types';
import { MemoryReference, ForgettingResult } from '../memory/forgetting';

/**
 * Expiry check result for a single contract
 */
export interface ExpiryCheckResult {
  contract_id: string;
  expired: boolean;
  retention_until?: Date;
  memories_frozen: string[];
  error?: string;
}

/**
 * Result of an expiry check cycle
 */
export interface ExpiryCycleResult {
  cycle_id: string;
  started_at: Date;
  completed_at: Date;
  contracts_checked: number;
  contracts_expired: number;
  memories_affected: number;
  results: ExpiryCheckResult[];
  errors: string[];
}

/**
 * Listener for expiry events
 */
export type ExpiryListener = (contract: LearningContract, result: ExpiryCheckResult) => void;

/**
 * Listener for cycle completion
 */
export type CycleCompletionListener = (result: ExpiryCycleResult) => void;

/**
 * Function to resolve contracts by ID
 */
export type ExpiryContractResolver = (contractId: string) => LearningContract | null;

/**
 * Function to expire a contract
 */
export type ExpiryContractExpirer = (contractId: string, actor: string) => LearningContract;

/**
 * Function to get contracts with expired timebound retention
 */
export type TimeboundExpiredFinder = () => LearningContract[];

/**
 * Function to freeze memories for an expired contract
 */
export type ExpiryMemoryFreezer = (
  contractId: string,
  memories: MemoryReference[]
) => ForgettingResult;

/**
 * Function to get memories for a contract
 */
export type ContractMemoryProvider = (contractId: string) => MemoryReference[];

/**
 * Expiry manager configuration
 */
export interface TimeboundExpiryManagerConfig {
  /** Function to find contracts with expired timebound retention */
  findTimeboundExpired: TimeboundExpiredFinder;
  /** Function to resolve contracts by ID */
  contractResolver: ExpiryContractResolver;
  /** Function to expire a contract */
  contractExpirer: ExpiryContractExpirer;
  /** Function to freeze memories */
  memoryFreezer: ExpiryMemoryFreezer;
  /** Function to get memories for a contract */
  memoryProvider?: ContractMemoryProvider;
  /** Interval between expiry checks in milliseconds (default: 60000 = 1 minute) */
  checkIntervalMs?: number;
  /** Actor identifier for audit logs */
  actor?: string;
}

/**
 * Expiry manager statistics
 */
export interface ExpiryManagerStats {
  isRunning: boolean;
  lastCheckAt: Date | null;
  nextCheckAt: Date | null;
  cyclesCompleted: number;
  totalContractsExpired: number;
  totalMemoriesAffected: number;
  totalErrors: number;
}
