/**
 * Boundary-SIEM Integration Types
 *
 * Types for integrating with Boundary-SIEM for security event reporting.
 * Supports CEF, JSON HTTP, and syslog ingestion methods.
 */

import { ErrorSeverity } from '../errors/types';
import type { ErrorEvent } from '../errors/types';

/** SIEM connection configuration */
export interface SIEMConfig {
  /** Base URL for the SIEM API (e.g., "https://siem.example.com") */
  base_url: string;
  /** API key for authentication */
  api_key?: string;
  /** OAuth 2.0 token if using OAuth */
  oauth_token?: string;
  /** Connection timeout in ms */
  timeout_ms: number;
  /** Whether to use TLS */
  use_tls: boolean;
  /** Whether to verify TLS certificates */
  verify_tls: boolean;
  /** CEF endpoint for UDP/TCP ingestion */
  cef_endpoint?: {
    host: string;
    port: number;
    protocol: 'udp' | 'tcp';
  };
  /** Retry configuration */
  retry: {
    max_attempts: number;
    base_delay_ms: number;
    max_delay_ms: number;
  };
  /** Batch configuration */
  batch: {
    max_size: number;
    flush_interval_ms: number;
  };
  /** Source identification */
  source: {
    product: string;
    vendor: string;
    version: string;
    host?: string;
  };
}

/** SIEM event types that can be reported */
export enum SIEMEventType {
  /** System error events */
  ERROR = 'error',
  /** Security violation events */
  SECURITY_VIOLATION = 'security_violation',
  /** Authentication events */
  AUTH = 'auth',
  /** Access control events */
  ACCESS = 'access',
  /** Contract lifecycle events */
  CONTRACT = 'contract',
  /** Enforcement events */
  ENFORCEMENT = 'enforcement',
  /** Audit events */
  AUDIT = 'audit',
  /** System health events */
  HEALTH = 'health',
  /** Connection events */
  CONNECTION = 'connection',
}

/** CEF severity mapping (0-10 scale) */
export const CEF_SEVERITY_MAP: Record<ErrorSeverity, number> = {
  [ErrorSeverity.INFO]: 1,
  [ErrorSeverity.LOW]: 3,
  [ErrorSeverity.MEDIUM]: 5,
  [ErrorSeverity.HIGH]: 7,
  [ErrorSeverity.CRITICAL]: 10,
};

/** SIEM event structure for JSON HTTP ingestion */
export interface SIEMEvent {
  /** Unique event ID */
  event_id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event type */
  event_type: SIEMEventType;
  /** CEF severity (0-10) */
  severity: number;
  /** Event category */
  category: string;
  /** Event action (e.g., "create", "deny", "revoke") */
  action: string;
  /** Outcome ("success" | "failure") */
  outcome: 'success' | 'failure';
  /** Human-readable message */
  message: string;
  /** Source information */
  source: {
    product: string;
    vendor: string;
    version: string;
    host: string;
    component?: string;
  };
  /** Actor information */
  actor?: {
    user_id?: string;
    session_id?: string;
    ip_address?: string;
  };
  /** Target information */
  target?: {
    contract_id?: string;
    memory_id?: string;
    resource_type?: string;
  };
  /** Additional context */
  context?: Record<string, unknown>;
  /** MITRE ATT&CK technique if applicable */
  mitre_technique?: string;
  /** Correlation ID for tracing */
  correlation_id?: string;
  /** Boundary mode at time of event */
  boundary_mode?: string;
}

/** Response from SIEM API */
export interface SIEMResponse {
  success: boolean;
  event_ids?: string[];
  errors?: Array<{
    event_id: string;
    error: string;
  }>;
  message?: string;
  /** SIEM version (for health check responses) */
  version?: string;
}

/** SIEM health check response */
export interface SIEMHealthStatus {
  healthy: boolean;
  latency_ms: number;
  last_check: Date;
  version?: string;
  error?: string;
}

/** Contract lifecycle event for SIEM */
export interface ContractEvent {
  event_type: 'created' | 'activated' | 'revoked' | 'expired' | 'amended';
  contract_id: string;
  contract_type: string;
  owner_id: string;
  domains?: string[];
  contexts?: string[];
  expiration?: string;
  reason?: string;
}

/** Enforcement event for SIEM */
export interface EnforcementEvent {
  event_type: 'memory_creation' | 'abstraction' | 'recall' | 'export';
  contract_id: string;
  outcome: 'allowed' | 'denied';
  boundary_mode: string;
  classification_level?: number;
  domain?: string;
  context?: string;
  denial_reason?: string;
}

/** Security violation event for SIEM */
export interface SecurityViolationEvent {
  violation_type: string;
  severity: ErrorSeverity;
  contract_id?: string;
  user_id?: string;
  description: string;
  mitre_technique?: string;
  indicators?: Array<{
    type: string;
    value: string;
  }>;
  recommended_action?: string;
}

/** Connection event for SIEM (daemon/SIEM connectivity) */
export interface ConnectionEvent {
  connection_type: 'siem' | 'daemon' | 'vault';
  status: 'connected' | 'disconnected' | 'error';
  endpoint: string;
  latency_ms?: number;
  error_message?: string;
  tls_verified?: boolean;
}

/** Audit event for SIEM */
export interface AuditLogEntry {
  action: string;
  actor: string;
  target_type: string;
  target_id: string;
  outcome: 'success' | 'failure';
  details?: Record<string, unknown>;
  hash?: string;
  previous_hash?: string;
}

/** Event converter interface */
export interface EventConverter {
  /** Convert error event to SIEM event */
  fromError(error: ErrorEvent, config: SIEMConfig): SIEMEvent;
  /** Convert contract event to SIEM event */
  fromContractEvent(event: ContractEvent, config: SIEMConfig): SIEMEvent;
  /** Convert enforcement event to SIEM event */
  fromEnforcementEvent(event: EnforcementEvent, config: SIEMConfig): SIEMEvent;
  /** Convert security violation to SIEM event */
  fromSecurityViolation(event: SecurityViolationEvent, config: SIEMConfig): SIEMEvent;
  /** Convert to CEF format */
  toCEF(event: SIEMEvent): string;
}
