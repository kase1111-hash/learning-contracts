/**
 * Learning Contracts Error Types
 *
 * Structured error handling with severity levels, error codes,
 * and integration with Boundary-SIEM for security event reporting.
 */

/** Error severity levels aligned with SIEM standards */
export enum ErrorSeverity {
  /** Informational - normal operation events */
  INFO = 0,
  /** Low - minor issues that don't affect operation */
  LOW = 1,
  /** Medium - issues that may affect some functionality */
  MEDIUM = 2,
  /** High - significant issues affecting core functionality */
  HIGH = 3,
  /** Critical - system-threatening issues requiring immediate action */
  CRITICAL = 4,
}

/** Error categories for classification */
export enum ErrorCategory {
  /** Contract-related errors */
  CONTRACT = 'contract',
  /** Enforcement failures */
  ENFORCEMENT = 'enforcement',
  /** Storage/persistence errors */
  STORAGE = 'storage',
  /** Authentication/authorization errors */
  AUTH = 'auth',
  /** Network/connection errors */
  NETWORK = 'network',
  /** Security violations */
  SECURITY = 'security',
  /** Configuration errors */
  CONFIG = 'config',
  /** Integration errors (SIEM, daemon) */
  INTEGRATION = 'integration',
  /** Validation errors */
  VALIDATION = 'validation',
  /** System/internal errors */
  SYSTEM = 'system',
}

/** Error codes for specific error types */
export enum ErrorCode {
  // Contract errors (1000-1999)
  CONTRACT_NOT_FOUND = 1001,
  CONTRACT_INVALID_STATE = 1002,
  CONTRACT_EXPIRED = 1003,
  CONTRACT_REVOKED = 1004,
  CONTRACT_SCOPE_VIOLATION = 1005,
  CONTRACT_CREATION_FAILED = 1006,

  // Enforcement errors (2000-2999)
  ENFORCEMENT_DENIED = 2001,
  ENFORCEMENT_BOUNDARY_VIOLATION = 2002,
  ENFORCEMENT_CLASSIFICATION_EXCEEDED = 2003,
  ENFORCEMENT_ABSTRACTION_BLOCKED = 2004,
  ENFORCEMENT_EXPORT_BLOCKED = 2005,
  ENFORCEMENT_RECALL_BLOCKED = 2006,
  ENFORCEMENT_EMERGENCY_OVERRIDE = 2007,

  // Storage errors (3000-3999)
  STORAGE_READ_FAILED = 3001,
  STORAGE_WRITE_FAILED = 3002,
  STORAGE_INTEGRITY_VIOLATION = 3003,
  STORAGE_CORRUPTION = 3004,
  STORAGE_PERMISSION_DENIED = 3005,

  // Auth errors (4000-4999)
  AUTH_UNAUTHORIZED = 4001,
  AUTH_FORBIDDEN = 4002,
  AUTH_TOKEN_EXPIRED = 4003,
  AUTH_INVALID_CREDENTIALS = 4004,
  AUTH_SESSION_EXPIRED = 4005,
  AUTH_PERMISSION_DENIED = 4006,

  // Network errors (5000-5999)
  NETWORK_CONNECTION_FAILED = 5001,
  NETWORK_TIMEOUT = 5002,
  NETWORK_SSL_ERROR = 5003,
  NETWORK_DNS_FAILED = 5004,
  NETWORK_UNREACHABLE = 5005,

  // Security errors (6000-6999)
  SECURITY_TAMPERING_DETECTED = 6001,
  SECURITY_INJECTION_ATTEMPT = 6002,
  SECURITY_REPLAY_ATTACK = 6003,
  SECURITY_SIGNATURE_INVALID = 6004,
  SECURITY_HASH_MISMATCH = 6005,
  SECURITY_LOCKDOWN_TRIGGERED = 6006,
  SECURITY_TRIPWIRE_ACTIVATED = 6007,

  // Config errors (7000-7999)
  CONFIG_INVALID = 7001,
  CONFIG_MISSING = 7002,
  CONFIG_PARSE_ERROR = 7003,

  // Integration errors (8000-8999)
  INTEGRATION_SIEM_UNREACHABLE = 8001,
  INTEGRATION_SIEM_REJECTED = 8002,
  INTEGRATION_DAEMON_UNREACHABLE = 8003,
  INTEGRATION_DAEMON_REJECTED = 8004,
  INTEGRATION_SYNC_FAILED = 8005,

  // Validation errors (9000-9999)
  VALIDATION_FAILED = 9001,
  VALIDATION_SCHEMA_ERROR = 9002,
  VALIDATION_TYPE_ERROR = 9003,

  // System errors (10000+)
  SYSTEM_INTERNAL_ERROR = 10001,
  SYSTEM_OUT_OF_MEMORY = 10002,
  SYSTEM_RESOURCE_EXHAUSTED = 10003,
}

/** Context information for errors */
export interface ErrorContext {
  /** Contract ID if applicable */
  contract_id?: string;
  /** User ID if applicable */
  user_id?: string;
  /** Session ID if applicable */
  session_id?: string;
  /** Operation that failed */
  operation?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Stack trace */
  stack?: string;
  /** Timestamp */
  timestamp: Date;
  /** Correlation ID for tracing */
  correlation_id?: string;
  /** Source component */
  source_component?: string;
  /** Boundary mode at time of error */
  boundary_mode?: string;
}

/** Error event for SIEM reporting */
export interface ErrorEvent {
  /** Unique event ID */
  event_id: string;
  /** Error code */
  code: ErrorCode;
  /** Error category */
  category: ErrorCategory;
  /** Severity level */
  severity: ErrorSeverity;
  /** Human-readable message */
  message: string;
  /** Error context */
  context: ErrorContext;
  /** Whether this error is recoverable */
  recoverable: boolean;
  /** Suggested remediation action */
  remediation?: string;
  /** Related MITRE ATT&CK technique if applicable */
  mitre_technique?: string;
}

/** Error handler callback type */
export type ErrorHandler = (error: LearningContractsError) => void | Promise<void>;

/** Error recovery strategy */
export interface RecoveryStrategy {
  /** Maximum retry attempts */
  max_retries: number;
  /** Base delay between retries in ms */
  base_delay_ms: number;
  /** Whether to use exponential backoff */
  exponential_backoff: boolean;
  /** Maximum delay cap in ms */
  max_delay_ms: number;
  /** Fallback action if recovery fails */
  fallback_action?: () => void | Promise<void>;
}

/**
 * Base error class for Learning Contracts
 */
export class LearningContractsError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly context: ErrorContext;
  readonly recoverable: boolean;
  readonly event_id: string;
  readonly remediation?: string;
  readonly mitre_technique?: string;

  constructor(
    message: string,
    code: ErrorCode,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: Partial<ErrorContext> = {},
    options: {
      recoverable?: boolean;
      remediation?: string;
      mitre_technique?: string;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'LearningContractsError';
    // Store cause for error chaining (ES2022+ has native support)
    if (options.cause) {
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        writable: true,
        configurable: true,
      });
    }
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.context = {
      timestamp: new Date(),
      stack: this.stack,
      ...context,
    };
    this.recoverable = options.recoverable ?? false;
    this.event_id = this.generateEventId();
    this.remediation = options.remediation;
    this.mitre_technique = options.mitre_technique;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, LearningContractsError.prototype);
  }

  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `lc-err-${timestamp}-${random}`;
  }

  /** Convert to SIEM-compatible event */
  toErrorEvent(): ErrorEvent {
    return {
      event_id: this.event_id,
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      context: this.context,
      recoverable: this.recoverable,
      remediation: this.remediation,
      mitre_technique: this.mitre_technique,
    };
  }

  /** Convert to CEF format for SIEM ingestion */
  toCEF(): string {
    const version = 0;
    const vendor = 'LearningContracts';
    const product = 'learning-contracts';
    const productVersion = '0.1.0-alpha';
    const signatureId = this.code;
    const name = this.category;
    const severity = this.mapSeverityToCEF();

    const extension = [
      `msg=${this.escapeForCEF(this.message)}`,
      `cat=${this.category}`,
      `outcome=Failure`,
      `deviceEventId=${this.event_id}`,
      this.context.user_id ? `suser=${this.context.user_id}` : '',
      this.context.contract_id ? `cs1=${this.context.contract_id}` : '',
      this.context.operation ? `act=${this.context.operation}` : '',
      this.context.source_component ? `deviceProcessName=${this.context.source_component}` : '',
      this.context.boundary_mode ? `cs2=${this.context.boundary_mode}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return `CEF:${version}|${vendor}|${product}|${productVersion}|${signatureId}|${name}|${severity}|${extension}`;
  }

  private mapSeverityToCEF(): number {
    // CEF severity is 0-10
    const mapping: Record<ErrorSeverity, number> = {
      [ErrorSeverity.INFO]: 1,
      [ErrorSeverity.LOW]: 3,
      [ErrorSeverity.MEDIUM]: 5,
      [ErrorSeverity.HIGH]: 7,
      [ErrorSeverity.CRITICAL]: 10,
    };
    return mapping[this.severity];
  }

  private escapeForCEF(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/=/g, '\\=');
  }

  /** Convert to JSON for HTTP API reporting */
  toJSON(): Record<string, unknown> {
    return {
      event_id: this.event_id,
      error_type: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      severity_name: ErrorSeverity[this.severity],
      message: this.message,
      context: {
        ...this.context,
        timestamp: this.context.timestamp.toISOString(),
      },
      recoverable: this.recoverable,
      remediation: this.remediation,
      mitre_technique: this.mitre_technique,
    };
  }
}

// Specialized error classes

export class ContractError extends LearningContractsError {
  constructor(
    message: string,
    code: ErrorCode,
    context?: Partial<ErrorContext>,
    options?: { recoverable?: boolean; remediation?: string; cause?: Error }
  ) {
    super(message, code, ErrorCategory.CONTRACT, ErrorSeverity.MEDIUM, context, options);
    this.name = 'ContractError';
  }
}

export class EnforcementError extends LearningContractsError {
  constructor(
    message: string,
    code: ErrorCode,
    severity: ErrorSeverity = ErrorSeverity.HIGH,
    context?: Partial<ErrorContext>,
    options?: { recoverable?: boolean; remediation?: string; mitre_technique?: string; cause?: Error }
  ) {
    super(message, code, ErrorCategory.ENFORCEMENT, severity, context, options);
    this.name = 'EnforcementError';
  }
}

export class SecurityError extends LearningContractsError {
  constructor(
    message: string,
    code: ErrorCode,
    context?: Partial<ErrorContext>,
    options?: { recoverable?: boolean; remediation?: string; mitre_technique?: string; cause?: Error }
  ) {
    super(message, code, ErrorCategory.SECURITY, ErrorSeverity.CRITICAL, context, {
      recoverable: false,
      ...options,
    });
    this.name = 'SecurityError';
  }
}

export class StorageError extends LearningContractsError {
  constructor(
    message: string,
    code: ErrorCode,
    context?: Partial<ErrorContext>,
    options?: { recoverable?: boolean; remediation?: string; cause?: Error }
  ) {
    super(message, code, ErrorCategory.STORAGE, ErrorSeverity.HIGH, context, options);
    this.name = 'StorageError';
  }
}

export class NetworkError extends LearningContractsError {
  constructor(
    message: string,
    code: ErrorCode,
    context?: Partial<ErrorContext>,
    options?: { recoverable?: boolean; remediation?: string; cause?: Error }
  ) {
    super(message, code, ErrorCategory.NETWORK, ErrorSeverity.MEDIUM, context, {
      recoverable: true,
      ...options,
    });
    this.name = 'NetworkError';
  }
}

export class IntegrationError extends LearningContractsError {
  constructor(
    message: string,
    code: ErrorCode,
    context?: Partial<ErrorContext>,
    options?: { recoverable?: boolean; remediation?: string; cause?: Error }
  ) {
    super(message, code, ErrorCategory.INTEGRATION, ErrorSeverity.HIGH, context, options);
    this.name = 'IntegrationError';
  }
}

export class AuthError extends LearningContractsError {
  constructor(
    message: string,
    code: ErrorCode,
    context?: Partial<ErrorContext>,
    options?: { recoverable?: boolean; remediation?: string; mitre_technique?: string; cause?: Error }
  ) {
    super(message, code, ErrorCategory.AUTH, ErrorSeverity.HIGH, context, options);
    this.name = 'AuthError';
  }
}
