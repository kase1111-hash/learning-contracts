/**
 * Boundary Daemon Connector
 *
 * Connects to the Boundary Daemon for policy enforcement and connection protection.
 * Supports Unix socket and HTTP communication protocols.
 */

import { randomBytes } from 'crypto';
import * as net from 'net';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { URL } from 'url';
import {
  DaemonConfig,
  DaemonBoundaryMode,
  DaemonClassificationLevel,
  PolicyDecision,
  PolicyRequest,
  PolicyOperation,
  DaemonStatus,
  ModeChangeEvent,
  TripwireEvent,
  AttestationRequest,
  AttestationResponse,
  DaemonEventHandlers,
  DaemonCommand,
  DaemonResponse,
  CLASSIFICATION_CAPS,
  ConnectionProtection,
} from './types';
import {
  IntegrationError,
  SecurityError,
  ErrorCode,
} from '../errors/types';

/** Default daemon configuration */
const DEFAULT_CONFIG: Partial<DaemonConfig> = {
  timeout_ms: 5000,
  use_tls: true,
  component_name: 'learning-contracts',
  component_version: '0.1.0-alpha',
  reconnect: {
    enabled: true,
    max_attempts: 5,
    base_delay_ms: 1000,
    max_delay_ms: 30000,
  },
  health_check_interval_ms: 30000,
};

/**
 * Boundary Daemon Connector
 *
 * Provides secure communication with the Boundary Daemon for policy decisions,
 * connection protection, and security event handling.
 */
export class DaemonConnector {
  private config: DaemonConfig;
  private isConnected = false;
  private currentMode: DaemonBoundaryMode = DaemonBoundaryMode.RESTRICTED;
  private status?: DaemonStatus;
  private eventHandlers: DaemonEventHandlers = {};
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private reconnectAttempts = 0;
  private attestationToken?: string;
  private attestationExpiry?: Date;
  private socket?: net.Socket;
  private connectionProtection?: ConnectionProtection;

  constructor(config: Partial<DaemonConfig>) {
    if (!config.socket_path && !config.http_endpoint) {
      throw new Error('Either socket_path or http_endpoint must be provided');
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      reconnect: { ...DEFAULT_CONFIG.reconnect!, ...config.reconnect },
    } as DaemonConfig;
  }

  /** Initialize connection to daemon */
  async connect(): Promise<void> {
    try {
      // Attempt initial connection
      await this.establishConnection();

      // Register component with daemon
      await this.registerComponent();

      // Get initial status
      this.status = await this.getStatus();
      this.currentMode = this.status.boundary_mode;
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Start health check timer
      this.startHealthCheck();

      // Notify handlers
      await this.eventHandlers.onConnect?.();
    } catch (error) {
      throw new IntegrationError(
        `Failed to connect to Boundary Daemon: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.INTEGRATION_DAEMON_UNREACHABLE,
        { metadata: { endpoint: this.config.socket_path || this.config.http_endpoint } },
        { cause: error instanceof Error ? error : undefined, recoverable: true }
      );
    }
  }

  /** Disconnect from daemon */
  async disconnect(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }

    this.isConnected = false;
    await this.eventHandlers.onDisconnect?.('manual disconnect');
  }

  /** Request policy decision from daemon */
  async requestPolicy(request: PolicyRequest): Promise<PolicyDecision> {
    this.ensureConnected();

    const response = await this.sendCommand<PolicyDecision>(DaemonCommand.POLICY, request);

    if (!response.success) {
      throw new IntegrationError(
        `Policy request failed: ${response.error}`,
        ErrorCode.INTEGRATION_DAEMON_REJECTED,
        { metadata: { operation: request.operation, error_code: response.error_code } }
      );
    }

    return response.data!;
  }

  /** Check if operation is allowed under current policy */
  async checkPolicy(
    operation: PolicyOperation,
    options: {
      contract_id?: string;
      classification?: DaemonClassificationLevel;
      domain?: string;
      context?: string;
      requires_network?: boolean;
      target_host?: string;
    } = {}
  ): Promise<PolicyDecision> {
    const request: PolicyRequest = {
      operation,
      component: this.config.component_name,
      ...options,
    };

    return this.requestPolicy(request);
  }

  /** Request component attestation */
  async requestAttestation(capabilities: string[]): Promise<AttestationResponse> {
    this.ensureConnected();

    const request: AttestationRequest = {
      component: this.config.component_name,
      version: this.config.component_version,
      nonce: randomBytes(16).toString('hex'),
      capabilities,
    };

    const response = await this.sendCommand<AttestationResponse>(DaemonCommand.ATTEST, request);

    if (response.success && response.data?.success) {
      this.attestationToken = response.data.token;
      this.attestationExpiry = response.data.expires_at;
    }

    return response.data || { success: false, failure_reason: response.error };
  }

  /** Get current daemon status */
  async getStatus(): Promise<DaemonStatus> {
    const response = await this.sendCommand<DaemonStatus>(DaemonCommand.STATUS, {});

    if (!response.success) {
      throw new IntegrationError(
        `Failed to get daemon status: ${response.error}`,
        ErrorCode.INTEGRATION_DAEMON_REJECTED
      );
    }

    this.status = response.data!;
    return this.status;
  }

  /** Get current boundary mode */
  getCurrentMode(): DaemonBoundaryMode {
    return this.currentMode;
  }

  /** Get classification cap for current mode */
  getClassificationCap(): number {
    return CLASSIFICATION_CAPS[this.currentMode];
  }

  /** Check if classification is allowed in current mode */
  isClassificationAllowed(level: DaemonClassificationLevel): boolean {
    const cap = this.getClassificationCap();
    if (cap === -1) {
      return false; // Lockdown mode
    }
    return level <= cap;
  }

  /** Request lockdown */
  async triggerLockdown(reason: string): Promise<void> {
    this.ensureConnected();

    const response = await this.sendCommand(DaemonCommand.LOCKDOWN, { reason });

    if (!response.success) {
      throw new SecurityError(
        `Failed to trigger lockdown: ${response.error}`,
        ErrorCode.SECURITY_LOCKDOWN_TRIGGERED,
        { metadata: { reason } }
      );
    }

    this.currentMode = DaemonBoundaryMode.LOCKDOWN;
    await this.eventHandlers.onLockdown?.(reason);
  }

  /** Report security event to daemon */
  async reportEvent(event: {
    type: 'tripwire' | 'violation' | 'anomaly';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.isConnected) {
      // Queue for later if not connected
      console.warn('Daemon not connected, cannot report event');
      return;
    }

    await this.sendCommand(DaemonCommand.REPORT, {
      ...event,
      component: this.config.component_name,
      timestamp: new Date().toISOString(),
    });
  }

  /** Set connection protection settings */
  setConnectionProtection(protection: ConnectionProtection): void {
    this.connectionProtection = protection;
  }

  /** Get connection protection settings */
  getConnectionProtection(): ConnectionProtection | undefined {
    return this.connectionProtection;
  }

  /** Check if connection to host is protected/allowed */
  async isConnectionAllowed(host: string, port: number): Promise<PolicyDecision> {
    return this.checkPolicy(PolicyOperation.NETWORK_ACCESS, {
      requires_network: true,
      target_host: `${host}:${port}`,
    });
  }

  /** Register event handlers */
  setEventHandlers(handlers: DaemonEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /** Check if connected to daemon */
  isConnectedToDaemon(): boolean {
    return this.isConnected;
  }

  /** Get attestation token if available */
  getAttestationToken(): string | undefined {
    if (this.attestationToken && this.attestationExpiry) {
      if (new Date() < this.attestationExpiry) {
        return this.attestationToken;
      }
    }
    return undefined;
  }

  // ==================== Private Methods ====================

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new IntegrationError(
        'Not connected to Boundary Daemon',
        ErrorCode.INTEGRATION_DAEMON_UNREACHABLE,
        {},
        { recoverable: true, remediation: 'Call connect() first' }
      );
    }
  }

  private async establishConnection(): Promise<void> {
    if (this.config.socket_path) {
      await this.connectViaSocket();
    } else {
      await this.connectViaHttp();
    }
  }

  private async connectViaSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socketPath = this.config.socket_path!;

      // Check if socket exists
      if (!fs.existsSync(socketPath)) {
        reject(new Error(`Socket not found: ${socketPath}`));
        return;
      }

      this.socket = net.createConnection(socketPath, () => {
        resolve();
      });

      this.socket.on('error', (error) => {
        reject(error);
      });

      this.socket.on('close', () => {
        this.handleDisconnect('socket closed');
      });

      this.socket.on('data', (data) => {
        const buffer = typeof data === 'string' ? Buffer.from(data) : data;
        this.handleSocketData(buffer);
      });

      this.socket.setTimeout(this.config.timeout_ms);
    });
  }

  private async connectViaHttp(): Promise<void> {
    // Test connection with health check
    const response = await this.httpRequest<DaemonResponse>('GET', '/health');
    if (!response.success) {
      throw new Error('Health check failed');
    }
  }

  private async registerComponent(): Promise<void> {
    const response = await this.sendCommand(DaemonCommand.REGISTER, {
      component: this.config.component_name,
      version: this.config.component_version,
      capabilities: ['contract_enforcement', 'memory_operations', 'audit_logging'],
    });

    if (!response.success) {
      throw new Error(`Component registration failed: ${response.error}`);
    }
  }

  private async sendCommand<T = unknown>(
    command: DaemonCommand,
    payload: unknown
  ): Promise<DaemonResponse<T>> {
    const requestId = randomBytes(8).toString('hex');
    const request = {
      command,
      payload,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      auth_token: this.config.auth_token,
      attestation_token: this.attestationToken,
    };

    if (this.config.socket_path && this.socket) {
      return this.sendViaSocket<T>(request);
    } else {
      return this.sendViaHttp<T>(command, request);
    }
  }

  private async sendViaSocket<T>(request: unknown): Promise<DaemonResponse<T>> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const message = JSON.stringify(request) + '\n';

      // Set up response handler
      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString()) as DaemonResponse<T>;
          this.socket?.removeListener('data', responseHandler);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };

      this.socket.on('data', responseHandler);

      // Send request
      this.socket.write(message, (error) => {
        if (error) {
          this.socket?.removeListener('data', responseHandler);
          reject(error);
        }
      });

      // Timeout
      setTimeout(() => {
        this.socket?.removeListener('data', responseHandler);
        reject(new Error('Request timeout'));
      }, this.config.timeout_ms);
    });
  }

  private async sendViaHttp<T>(
    command: DaemonCommand,
    request: unknown
  ): Promise<DaemonResponse<T>> {
    const path = `/api/v1/${command}`;
    return this.httpRequest<DaemonResponse<T>>('POST', path, request);
  }

  private async httpRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.config.http_endpoint);
      const isHttps = url.protocol === 'https:' || this.config.use_tls;
      const httpModule = isHttps ? https : http;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': `${this.config.component_name}/${this.config.component_version}`,
      };

      // Add authentication
      if (this.config.auth_token) {
        headers['Authorization'] = `Bearer ${this.config.auth_token}`;
      }
      if (this.attestationToken) {
        headers['X-Attestation-Token'] = this.attestationToken;
      }

      const options: https.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        timeout: this.config.timeout_ms,
        headers,
      };

      // TLS options
      if (isHttps) {
        if (this.config.client_cert && this.config.client_key) {
          options.cert = fs.readFileSync(this.config.client_cert);
          options.key = fs.readFileSync(this.config.client_key);
        }
        if (this.config.ca_cert) {
          options.ca = fs.readFileSync(this.config.ca_cert);
        }
      }

      const req = httpModule.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data) as T;
            resolve(response);
          } catch {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true } as T);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  private handleSocketData(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      // Handle push notifications from daemon
      if (message.type === 'mode_change') {
        this.handleModeChange(message.data as ModeChangeEvent);
      } else if (message.type === 'tripwire') {
        this.handleTripwire(message.data as TripwireEvent);
      }
    } catch {
      // Ignore parse errors for non-JSON data
    }
  }

  private handleModeChange(event: ModeChangeEvent): void {
    this.currentMode = event.new_mode;

    if (event.new_mode === DaemonBoundaryMode.LOCKDOWN) {
      void this.eventHandlers.onLockdown?.(event.reason);
    }

    void this.eventHandlers.onModeChange?.(event);
  }

  private handleTripwire(event: TripwireEvent): void {
    void this.eventHandlers.onTripwire?.(event);

    // Automatically trigger lockdown on critical tripwires
    if (event.severity === 'critical') {
      void this.triggerLockdown(`Critical tripwire: ${event.description}`);
    }
  }

  private handleDisconnect(reason: string): void {
    this.isConnected = false;
    void this.eventHandlers.onDisconnect?.(reason);

    if (this.config.reconnect.enabled) {
      void this.attemptReconnect();
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.reconnect.max_attempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnect.base_delay_ms * Math.pow(2, this.reconnectAttempts - 1),
      this.config.reconnect.max_delay_ms
    );

    await this.delay(delay);

    try {
      await this.connect();
    } catch (error) {
      console.error('Reconnection failed:', error);
      await this.attemptReconnect();
    }
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.sendCommand(DaemonCommand.HEARTBEAT, {
          component: this.config.component_name,
        });
      } catch (error) {
        console.error('Health check failed:', error);
        this.handleDisconnect('health check failed');
      }
    }, this.config.health_check_interval_ms);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Create a mock daemon connector for testing */
export class MockDaemonConnector extends DaemonConnector {
  private mockMode: DaemonBoundaryMode = DaemonBoundaryMode.TRUSTED;
  private mockPolicies: Map<PolicyOperation, boolean> = new Map();

  constructor() {
    super({ http_endpoint: 'http://mock-daemon' });

    // Check for production environment
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MockDaemonConnector cannot be used in production');
    }
  }

  /** Set mock boundary mode */
  setMockMode(mode: DaemonBoundaryMode): void {
    this.mockMode = mode;
  }

  /** Set mock policy result for an operation */
  setMockPolicy(operation: PolicyOperation, allowed: boolean): void {
    this.mockPolicies.set(operation, allowed);
  }

  override async connect(): Promise<void> {
    // No-op for mock
  }

  override async disconnect(): Promise<void> {
    // No-op for mock
  }

  override async checkPolicy(
    operation: PolicyOperation,
    _options: {
      contract_id?: string;
      classification?: DaemonClassificationLevel;
      domain?: string;
      context?: string;
      requires_network?: boolean;
      target_host?: string;
    } = {}
  ): Promise<PolicyDecision> {
    const allowed = this.mockPolicies.get(operation) ?? true;

    return {
      allowed,
      reason: allowed ? 'Mock policy allows operation' : 'Mock policy denies operation',
      boundary_mode: this.mockMode,
      timestamp: new Date(),
      decision_id: `mock-${Date.now()}`,
    };
  }

  override getCurrentMode(): DaemonBoundaryMode {
    return this.mockMode;
  }

  override isConnectedToDaemon(): boolean {
    return true;
  }
}
