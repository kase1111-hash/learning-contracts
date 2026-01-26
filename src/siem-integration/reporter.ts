/**
 * Boundary-SIEM Reporter
 *
 * Sends security events to Boundary-SIEM via HTTP JSON API and CEF.
 * Supports batching, retry logic, and multiple transport protocols.
 */

import { randomBytes } from 'crypto';
import {
  SIEMConfig,
  SIEMEvent,
  SIEMResponse,
  SIEMHealthStatus,
  SIEMEventType,
  CEF_SEVERITY_MAP,
  ContractEvent,
  EnforcementEvent,
  SecurityViolationEvent,
  ConnectionEvent,
  AuditLogEntry,
} from './types';
import { ErrorEvent, ErrorSeverity } from '../errors/types';
import { NetworkError, IntegrationError, ErrorCode } from '../errors/types';
import * as http from 'http';
import * as https from 'https';
import * as dgram from 'dgram';
import * as net from 'net';
import { URL } from 'url';

/** Default SIEM configuration */
const DEFAULT_CONFIG: Partial<SIEMConfig> = {
  timeout_ms: 10000,
  use_tls: true,
  verify_tls: true,
  retry: {
    max_attempts: 3,
    base_delay_ms: 1000,
    max_delay_ms: 30000,
  },
  batch: {
    max_size: 100,
    flush_interval_ms: 5000,
  },
  source: {
    product: 'learning-contracts',
    vendor: 'LearningContracts',
    version: '0.1.0-alpha',
  },
};

/**
 * SIEM Reporter for Boundary-SIEM integration
 */
export class SIEMReporter {
  private config: SIEMConfig;
  private eventBuffer: SIEMEvent[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;
  private isConnected = false;
  private lastHealthCheck?: SIEMHealthStatus;
  private hostname: string;
  private eventHandlers: Map<string, ((event: SIEMEvent) => void)[]> = new Map();

  constructor(config: Partial<SIEMConfig> & { base_url: string }) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      retry: { ...DEFAULT_CONFIG.retry!, ...config.retry },
      batch: { ...DEFAULT_CONFIG.batch!, ...config.batch },
      source: { ...DEFAULT_CONFIG.source!, ...config.source },
    } as SIEMConfig;

    this.hostname = this.config.source.host || this.getHostname();
  }

  /** Initialize the reporter and start background tasks */
  async initialize(): Promise<void> {
    // Verify connection to SIEM
    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new IntegrationError(
        `Failed to connect to SIEM: ${health.error}`,
        ErrorCode.INTEGRATION_SIEM_UNREACHABLE,
        { metadata: { endpoint: this.config.base_url } },
        { recoverable: true }
      );
    }

    this.isConnected = true;
    this.startFlushTimer();

    // Report connection event
    await this.reportConnectionEvent({
      connection_type: 'siem',
      status: 'connected',
      endpoint: this.config.base_url,
      latency_ms: health.latency_ms,
      tls_verified: this.config.verify_tls,
    });
  }

  /** Stop the reporter and flush remaining events */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Report disconnection
    if (this.isConnected) {
      await this.reportConnectionEvent({
        connection_type: 'siem',
        status: 'disconnected',
        endpoint: this.config.base_url,
      });
    }

    // Final flush
    await this.flush();
    this.isConnected = false;
  }

  /** Check SIEM health */
  async healthCheck(): Promise<SIEMHealthStatus> {
    const startTime = Date.now();

    try {
      const response = await this.httpRequest('GET', '/api/v1/health', undefined);
      const latency = Date.now() - startTime;

      this.lastHealthCheck = {
        healthy: response.success,
        latency_ms: latency,
        last_check: new Date(),
        version: response.version,
      };

      return this.lastHealthCheck;
    } catch (error) {
      const latency = Date.now() - startTime;

      this.lastHealthCheck = {
        healthy: false,
        latency_ms: latency,
        last_check: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return this.lastHealthCheck;
    }
  }

  /** Report error events to SIEM */
  async reportErrors(errors: ErrorEvent[]): Promise<void> {
    const events = errors.map((error) => this.errorToSIEMEvent(error));
    await this.bufferEvents(events);
  }

  /** Report a single error event */
  async reportError(error: ErrorEvent): Promise<void> {
    await this.reportErrors([error]);
  }

  /** Report contract lifecycle event */
  async reportContractEvent(event: ContractEvent): Promise<void> {
    const siemEvent = this.contractEventToSIEMEvent(event);
    await this.bufferEvents([siemEvent]);
  }

  /** Report enforcement event */
  async reportEnforcementEvent(event: EnforcementEvent): Promise<void> {
    const siemEvent = this.enforcementEventToSIEMEvent(event);
    await this.bufferEvents([siemEvent]);
  }

  /** Report security violation */
  async reportSecurityViolation(event: SecurityViolationEvent): Promise<void> {
    const siemEvent = this.securityViolationToSIEMEvent(event);

    // Security violations are sent immediately, not buffered
    await this.sendEvents([siemEvent]);

    // Also send via CEF if configured for redundancy
    if (this.config.cef_endpoint) {
      await this.sendCEF([siemEvent]);
    }
  }

  /** Report connection event */
  async reportConnectionEvent(event: ConnectionEvent): Promise<void> {
    const siemEvent = this.connectionEventToSIEMEvent(event);
    await this.bufferEvents([siemEvent]);
  }

  /** Report audit log entry */
  async reportAuditEntry(entry: AuditLogEntry): Promise<void> {
    const siemEvent = this.auditEntryToSIEMEvent(entry);
    await this.bufferEvents([siemEvent]);
  }

  /** Force flush buffered events */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    await this.sendEvents(events);
  }

  /** Register event handler for specific event types */
  onEvent(eventType: SIEMEventType, handler: (event: SIEMEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  /** Get connection status */
  isHealthy(): boolean {
    return this.isConnected && (this.lastHealthCheck?.healthy ?? false);
  }

  /** Get last health check result */
  getLastHealthCheck(): SIEMHealthStatus | undefined {
    return this.lastHealthCheck;
  }

  // ==================== Private Methods ====================

  private async bufferEvents(events: SIEMEvent[]): Promise<void> {
    this.eventBuffer.push(...events);

    // Notify handlers
    for (const event of events) {
      const handlers = this.eventHandlers.get(event.event_type) || [];
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      }
    }

    // Auto-flush if buffer is full
    if (this.eventBuffer.length >= this.config.batch.max_size) {
      await this.flush();
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.config.batch.flush_interval_ms);
  }

  private async sendEvents(events: SIEMEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.config.retry.max_attempts) {
      try {
        const response = await this.httpRequest('POST', '/api/v1/events', { events });

        if (!response.success && response.errors) {
          console.error('Some events rejected by SIEM:', response.errors);
        }

        return;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt < this.config.retry.max_attempts) {
          const delay = Math.min(
            this.config.retry.base_delay_ms * Math.pow(2, attempt - 1),
            this.config.retry.max_delay_ms
          );
          await this.delay(delay);
        }
      }
    }

    // All retries failed - log but don't throw to prevent caller disruption
    console.error(`Failed to send ${events.length} events to SIEM after ${attempt} attempts:`, lastError);
  }

  private async sendCEF(events: SIEMEvent[]): Promise<void> {
    if (!this.config.cef_endpoint) {
      return;
    }

    const { host, port, protocol } = this.config.cef_endpoint;

    for (const event of events) {
      const cefMessage = this.eventToCEF(event);

      try {
        if (protocol === 'udp') {
          await this.sendUDP(host, port, cefMessage);
        } else {
          await this.sendTCP(host, port, cefMessage);
        }
      } catch (error) {
        console.error('Failed to send CEF event:', error);
      }
    }
  }

  private async sendUDP(host: string, port: number, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = dgram.createSocket('udp4');
      const buffer = Buffer.from(message);

      client.send(buffer, port, host, (error) => {
        client.close();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async sendTCP(host: string, port: number, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      client.setTimeout(this.config.timeout_ms);

      client.connect(port, host, () => {
        client.write(message + '\n', () => {
          client.end();
          resolve();
        });
      });

      client.on('error', (error) => {
        client.destroy();
        reject(error);
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error('TCP connection timeout'));
      });
    });
  }

  private async httpRequest(method: string, path: string, body?: unknown): Promise<SIEMResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.config.base_url);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': `${this.config.source.product}/${this.config.source.version}`,
      };

      // Add authentication
      if (this.config.api_key) {
        headers['X-API-Key'] = this.config.api_key;
      } else if (this.config.oauth_token) {
        headers['Authorization'] = `Bearer ${this.config.oauth_token}`;
      }

      const options: http.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        timeout: this.config.timeout_ms,
        headers,
      };

      // TLS options
      if (isHttps && !this.config.verify_tls) {
        (options as https.RequestOptions).rejectUnauthorized = false;
      }

      const req = httpModule.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data) as SIEMResponse;
            resolve(response);
          } catch {
            // Handle non-JSON responses
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true });
            } else {
              reject(new NetworkError(
                `HTTP ${res.statusCode}: ${data}`,
                ErrorCode.NETWORK_CONNECTION_FAILED,
                { metadata: { status: res.statusCode, body: data } }
              ));
            }
          }
        });
      });

      req.on('error', (error) => {
        reject(new NetworkError(
          `SIEM request failed: ${error.message}`,
          ErrorCode.NETWORK_CONNECTION_FAILED,
          { metadata: { endpoint: url.href } },
          { cause: error }
        ));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new NetworkError(
          'SIEM request timeout',
          ErrorCode.NETWORK_TIMEOUT,
          { metadata: { endpoint: url.href, timeout: this.config.timeout_ms } }
        ));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  private errorToSIEMEvent(error: ErrorEvent): SIEMEvent {
    return {
      event_id: error.event_id,
      timestamp: error.context.timestamp.toISOString(),
      event_type: SIEMEventType.ERROR,
      severity: CEF_SEVERITY_MAP[error.severity],
      category: error.category,
      action: 'error',
      outcome: 'failure',
      message: error.message,
      source: {
        product: this.config.source.product,
        vendor: this.config.source.vendor,
        version: this.config.source.version,
        host: this.hostname,
        component: error.context.source_component,
      },
      actor: {
        user_id: error.context.user_id,
        session_id: error.context.session_id,
      },
      target: {
        contract_id: error.context.contract_id,
      },
      context: {
        error_code: error.code,
        recoverable: error.recoverable,
        remediation: error.remediation,
        operation: error.context.operation,
        metadata: error.context.metadata,
      },
      mitre_technique: error.mitre_technique,
      correlation_id: error.context.correlation_id,
      boundary_mode: error.context.boundary_mode,
    };
  }

  private contractEventToSIEMEvent(event: ContractEvent): SIEMEvent {
    return {
      event_id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      event_type: SIEMEventType.CONTRACT,
      severity: CEF_SEVERITY_MAP[ErrorSeverity.INFO],
      category: 'contract',
      action: event.event_type,
      outcome: 'success',
      message: `Contract ${event.contract_id} ${event.event_type}`,
      source: {
        product: this.config.source.product,
        vendor: this.config.source.vendor,
        version: this.config.source.version,
        host: this.hostname,
      },
      actor: {
        user_id: event.owner_id,
      },
      target: {
        contract_id: event.contract_id,
        resource_type: event.contract_type,
      },
      context: {
        domains: event.domains,
        contexts: event.contexts,
        expiration: event.expiration,
        reason: event.reason,
      },
    };
  }

  private enforcementEventToSIEMEvent(event: EnforcementEvent): SIEMEvent {
    const severity = event.outcome === 'denied' ? ErrorSeverity.MEDIUM : ErrorSeverity.INFO;

    return {
      event_id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      event_type: SIEMEventType.ENFORCEMENT,
      severity: CEF_SEVERITY_MAP[severity],
      category: 'enforcement',
      action: event.event_type,
      outcome: event.outcome === 'allowed' ? 'success' : 'failure',
      message: `Enforcement ${event.event_type}: ${event.outcome}`,
      source: {
        product: this.config.source.product,
        vendor: this.config.source.vendor,
        version: this.config.source.version,
        host: this.hostname,
      },
      target: {
        contract_id: event.contract_id,
      },
      context: {
        classification_level: event.classification_level,
        domain: event.domain,
        context: event.context,
        denial_reason: event.denial_reason,
      },
      boundary_mode: event.boundary_mode,
    };
  }

  private securityViolationToSIEMEvent(event: SecurityViolationEvent): SIEMEvent {
    return {
      event_id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      event_type: SIEMEventType.SECURITY_VIOLATION,
      severity: CEF_SEVERITY_MAP[event.severity],
      category: 'security',
      action: event.violation_type,
      outcome: 'failure',
      message: event.description,
      source: {
        product: this.config.source.product,
        vendor: this.config.source.vendor,
        version: this.config.source.version,
        host: this.hostname,
      },
      actor: {
        user_id: event.user_id,
      },
      target: {
        contract_id: event.contract_id,
      },
      context: {
        indicators: event.indicators,
        recommended_action: event.recommended_action,
      },
      mitre_technique: event.mitre_technique,
    };
  }

  private connectionEventToSIEMEvent(event: ConnectionEvent): SIEMEvent {
    const severity = event.status === 'error' ? ErrorSeverity.HIGH : ErrorSeverity.INFO;

    return {
      event_id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      event_type: SIEMEventType.CONNECTION,
      severity: CEF_SEVERITY_MAP[severity],
      category: 'connection',
      action: event.status,
      outcome: event.status === 'error' ? 'failure' : 'success',
      message: `Connection ${event.connection_type}: ${event.status}`,
      source: {
        product: this.config.source.product,
        vendor: this.config.source.vendor,
        version: this.config.source.version,
        host: this.hostname,
      },
      context: {
        connection_type: event.connection_type,
        endpoint: event.endpoint,
        latency_ms: event.latency_ms,
        error_message: event.error_message,
        tls_verified: event.tls_verified,
      },
    };
  }

  private auditEntryToSIEMEvent(entry: AuditLogEntry): SIEMEvent {
    return {
      event_id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      event_type: SIEMEventType.AUDIT,
      severity: CEF_SEVERITY_MAP[ErrorSeverity.INFO],
      category: 'audit',
      action: entry.action,
      outcome: entry.outcome,
      message: `Audit: ${entry.action} on ${entry.target_type}/${entry.target_id}`,
      source: {
        product: this.config.source.product,
        vendor: this.config.source.vendor,
        version: this.config.source.version,
        host: this.hostname,
      },
      actor: {
        user_id: entry.actor,
      },
      target: {
        resource_type: entry.target_type,
      },
      context: {
        target_id: entry.target_id,
        details: entry.details,
        hash: entry.hash,
        previous_hash: entry.previous_hash,
      },
    };
  }

  private eventToCEF(event: SIEMEvent): string {
    const version = 0;
    const vendor = this.escapeForCEF(this.config.source.vendor);
    const product = this.escapeForCEF(this.config.source.product);
    const productVersion = this.config.source.version;
    const signatureId = event.event_type;
    const name = this.escapeForCEF(event.action);
    const severity = event.severity;

    const extensions: string[] = [
      `msg=${this.escapeForCEF(event.message)}`,
      `cat=${event.category}`,
      `outcome=${event.outcome === 'success' ? 'Success' : 'Failure'}`,
      `deviceEventId=${event.event_id}`,
      `rt=${new Date(event.timestamp).getTime()}`,
      `dhost=${this.hostname}`,
    ];

    if (event.actor?.user_id) {
      extensions.push(`suser=${this.escapeForCEF(event.actor.user_id)}`);
    }
    if (event.target?.contract_id) {
      extensions.push(`cs1=${event.target.contract_id}`);
      extensions.push('cs1Label=ContractID');
    }
    if (event.boundary_mode) {
      extensions.push(`cs2=${event.boundary_mode}`);
      extensions.push('cs2Label=BoundaryMode');
    }
    if (event.mitre_technique) {
      extensions.push(`cs3=${event.mitre_technique}`);
      extensions.push('cs3Label=MITRETechnique');
    }
    if (event.correlation_id) {
      extensions.push(`cs4=${event.correlation_id}`);
      extensions.push('cs4Label=CorrelationID');
    }

    return `CEF:${version}|${vendor}|${product}|${productVersion}|${signatureId}|${name}|${severity}|${extensions.join(' ')}`;
  }

  private escapeForCEF(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')
      .replace(/=/g, '\\=')
      .replace(/\n/g, '\\n');
  }

  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');
    return `lc-siem-${timestamp}-${random}`;
  }

  private getHostname(): string {
    try {
      return require('os').hostname();
    } catch {
      return 'unknown';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
