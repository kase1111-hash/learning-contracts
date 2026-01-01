/**
 * Error Handler for Learning Contracts
 *
 * Centralized error handling with SIEM reporting,
 * recovery strategies, and error aggregation.
 */

import {
  LearningContractsError,
  ErrorHandler,
  ErrorSeverity,
  ErrorCategory,
  ErrorCode,
  RecoveryStrategy,
  ErrorEvent,
  SecurityError,
} from './types';

/** Error handler configuration */
export interface ErrorHandlerConfig {
  /** Whether to log errors to console */
  console_logging: boolean;
  /** Minimum severity to log */
  min_log_severity: ErrorSeverity;
  /** Whether to report to SIEM */
  siem_reporting: boolean;
  /** Maximum errors to buffer before forced flush */
  buffer_size: number;
  /** Buffer flush interval in ms */
  flush_interval_ms: number;
  /** Whether to trigger lockdown on critical security errors */
  lockdown_on_critical: boolean;
  /** Custom error handlers by category */
  category_handlers?: Partial<Record<ErrorCategory, ErrorHandler>>;
}

/** Error statistics */
export interface ErrorStats {
  total_errors: number;
  errors_by_severity: Record<ErrorSeverity, number>;
  errors_by_category: Record<ErrorCategory, number>;
  last_error_at?: Date;
  critical_errors_count: number;
  security_errors_count: number;
}

/** Default recovery strategies by error category */
const DEFAULT_RECOVERY_STRATEGIES: Partial<Record<ErrorCategory, RecoveryStrategy>> = {
  [ErrorCategory.NETWORK]: {
    max_retries: 3,
    base_delay_ms: 1000,
    exponential_backoff: true,
    max_delay_ms: 30000,
  },
  [ErrorCategory.INTEGRATION]: {
    max_retries: 3,
    base_delay_ms: 2000,
    exponential_backoff: true,
    max_delay_ms: 60000,
  },
  [ErrorCategory.STORAGE]: {
    max_retries: 2,
    base_delay_ms: 500,
    exponential_backoff: false,
    max_delay_ms: 5000,
  },
};

/**
 * Centralized Error Handler
 */
export class CentralErrorHandler {
  private config: ErrorHandlerConfig;
  private errorBuffer: LearningContractsError[] = [];
  private stats: ErrorStats;
  private flushTimer?: ReturnType<typeof setInterval>;
  private globalHandlers: ErrorHandler[] = [];
  private siemReporter?: (events: ErrorEvent[]) => Promise<void>;
  private lockdownCallback?: (reason: string) => Promise<void>;
  private isLockdownTriggered = false;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      console_logging: true,
      min_log_severity: ErrorSeverity.LOW,
      siem_reporting: true,
      buffer_size: 100,
      flush_interval_ms: 5000,
      lockdown_on_critical: true,
      ...config,
    };

    this.stats = {
      total_errors: 0,
      errors_by_severity: {
        [ErrorSeverity.INFO]: 0,
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0,
      },
      errors_by_category: {} as Record<ErrorCategory, number>,
      critical_errors_count: 0,
      security_errors_count: 0,
    };

    // Initialize category counts
    Object.values(ErrorCategory).forEach((cat) => {
      this.stats.errors_by_category[cat] = 0;
    });

    this.startFlushTimer();
  }

  /** Set the SIEM reporter function */
  setSiemReporter(reporter: (events: ErrorEvent[]) => Promise<void>): void {
    this.siemReporter = reporter;
  }

  /** Set lockdown callback for critical security events */
  setLockdownCallback(callback: (reason: string) => Promise<void>): void {
    this.lockdownCallback = callback;
  }

  /** Register a global error handler */
  addGlobalHandler(handler: ErrorHandler): void {
    this.globalHandlers.push(handler);
  }

  /** Handle an error */
  async handleError(error: LearningContractsError | Error): Promise<void> {
    // Wrap plain errors
    const lcError =
      error instanceof LearningContractsError
        ? error
        : new LearningContractsError(
            error.message,
            ErrorCode.SYSTEM_INTERNAL_ERROR,
            ErrorCategory.SYSTEM,
            ErrorSeverity.HIGH,
            { stack: error.stack },
            { cause: error }
          );

    // Update stats
    this.updateStats(lcError);

    // Log to console if enabled
    if (this.config.console_logging && lcError.severity >= this.config.min_log_severity) {
      this.logToConsole(lcError);
    }

    // Buffer for SIEM
    if (this.config.siem_reporting) {
      this.bufferError(lcError);
    }

    // Run category-specific handler
    const categoryHandler = this.config.category_handlers?.[lcError.category];
    if (categoryHandler) {
      await categoryHandler(lcError);
    }

    // Run global handlers
    for (const handler of this.globalHandlers) {
      try {
        await handler(lcError);
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    }

    // Check for lockdown trigger
    if (this.shouldTriggerLockdown(lcError)) {
      await this.triggerLockdown(lcError);
    }
  }

  /** Handle error with retry using recovery strategy */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    category: ErrorCategory,
    context?: { operation?: string; metadata?: Record<string, unknown> }
  ): Promise<T> {
    const strategy = DEFAULT_RECOVERY_STRATEGIES[category] || {
      max_retries: 1,
      base_delay_ms: 1000,
      exponential_backoff: false,
      max_delay_ms: 5000,
    };

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= strategy.max_retries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt > strategy.max_retries) {
          break;
        }

        // Calculate delay
        let delay = strategy.base_delay_ms;
        if (strategy.exponential_backoff) {
          delay = Math.min(strategy.base_delay_ms * Math.pow(2, attempt - 1), strategy.max_delay_ms);
        }

        // Log retry attempt
        const retryError = new LearningContractsError(
          `Retry attempt ${attempt}/${strategy.max_retries}: ${lastError.message}`,
          ErrorCode.SYSTEM_INTERNAL_ERROR,
          category,
          ErrorSeverity.LOW,
          { operation: context?.operation, metadata: { ...context?.metadata, attempt, delay } },
          { recoverable: true, cause: lastError }
        );

        await this.handleError(retryError);
        await this.delay(delay);
      }
    }

    // All retries failed
    const finalError = new LearningContractsError(
      `Operation failed after ${strategy.max_retries} retries: ${lastError?.message}`,
      ErrorCode.SYSTEM_INTERNAL_ERROR,
      category,
      ErrorSeverity.HIGH,
      { operation: context?.operation, metadata: context?.metadata },
      { recoverable: false, cause: lastError }
    );

    await this.handleError(finalError);

    // Run fallback if available
    if (strategy.fallback_action) {
      await strategy.fallback_action();
    }

    throw finalError;
  }

  /** Get error statistics */
  getStats(): ErrorStats {
    return { ...this.stats };
  }

  /** Reset error statistics */
  resetStats(): void {
    this.stats = {
      total_errors: 0,
      errors_by_severity: {
        [ErrorSeverity.INFO]: 0,
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0,
      },
      errors_by_category: {} as Record<ErrorCategory, number>,
      critical_errors_count: 0,
      security_errors_count: 0,
    };

    Object.values(ErrorCategory).forEach((cat) => {
      this.stats.errors_by_category[cat] = 0;
    });
  }

  /** Flush buffered errors to SIEM */
  async flush(): Promise<void> {
    if (this.errorBuffer.length === 0 || !this.siemReporter) {
      return;
    }

    const events = this.errorBuffer.map((e) => e.toErrorEvent());
    this.errorBuffer = [];

    try {
      await this.siemReporter(events);
    } catch (error) {
      // Log SIEM reporting failure but don't recurse
      console.error('Failed to report errors to SIEM:', error);
    }
  }

  /** Stop the error handler */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Final flush
    await this.flush();
  }

  /** Check if lockdown is currently triggered */
  isInLockdown(): boolean {
    return this.isLockdownTriggered;
  }

  /** Clear lockdown state */
  clearLockdown(): void {
    this.isLockdownTriggered = false;
  }

  private updateStats(error: LearningContractsError): void {
    this.stats.total_errors++;
    this.stats.errors_by_severity[error.severity]++;
    this.stats.errors_by_category[error.category]++;
    this.stats.last_error_at = new Date();

    if (error.severity === ErrorSeverity.CRITICAL) {
      this.stats.critical_errors_count++;
    }

    if (error.category === ErrorCategory.SECURITY) {
      this.stats.security_errors_count++;
    }
  }

  private logToConsole(error: LearningContractsError): void {
    const prefix = `[${ErrorSeverity[error.severity]}] [${error.category}]`;
    const message = `${prefix} ${error.message} (${error.code})`;

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        console.error(message, error.context);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(message, error.context);
        break;
      default:
        // For INFO and LOW, we don't log to console by default to reduce noise
        break;
    }
  }

  private bufferError(error: LearningContractsError): void {
    this.errorBuffer.push(error);

    // Force flush if buffer is full
    if (this.errorBuffer.length >= this.config.buffer_size) {
      void this.flush();
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.config.flush_interval_ms);
  }

  private shouldTriggerLockdown(error: LearningContractsError): boolean {
    if (!this.config.lockdown_on_critical || this.isLockdownTriggered) {
      return false;
    }

    // Trigger lockdown on critical security errors
    if (error instanceof SecurityError && error.severity === ErrorSeverity.CRITICAL) {
      return true;
    }

    // Trigger on specific error codes
    const lockdownTriggers = [
      ErrorCode.SECURITY_TAMPERING_DETECTED,
      ErrorCode.SECURITY_INJECTION_ATTEMPT,
      ErrorCode.SECURITY_REPLAY_ATTACK,
      ErrorCode.SECURITY_TRIPWIRE_ACTIVATED,
    ];

    return lockdownTriggers.includes(error.code);
  }

  private async triggerLockdown(error: LearningContractsError): Promise<void> {
    this.isLockdownTriggered = true;

    console.error('🚨 LOCKDOWN TRIGGERED 🚨');
    console.error(`Reason: ${error.message}`);
    console.error(`Error Code: ${error.code}`);

    if (this.lockdownCallback) {
      try {
        await this.lockdownCallback(error.message);
      } catch (callbackError) {
        console.error('Lockdown callback failed:', callbackError);
      }
    }

    // Immediate flush to SIEM
    await this.flush();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance for convenience
let defaultHandler: CentralErrorHandler | undefined;

export function getDefaultErrorHandler(): CentralErrorHandler {
  if (!defaultHandler) {
    defaultHandler = new CentralErrorHandler();
  }
  return defaultHandler;
}

export function setDefaultErrorHandler(handler: CentralErrorHandler): void {
  defaultHandler = handler;
}
