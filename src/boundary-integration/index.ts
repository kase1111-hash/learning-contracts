/**
 * Boundary Daemon Integration
 *
 * Provides integration between Learning Contracts and Boundary Daemon.
 * Ensures all operations comply with current boundary mode and
 * automatically suspends/resumes contracts on mode changes.
 */

// Types
export {
  DaemonBoundaryMode,
  NetworkStatus,
  TripwireType,
  TripwireEvent,
  RecallGateRequest,
  RecallGateResult,
  ToolGateRequest,
  ToolGateResult,
  BoundaryStatus,
  ModeTransitionRequest,
  ModeTransitionResult,
  OverrideCeremonyRequest,
  OverrideCeremonyResult,
  BoundaryAuditEntry,
  AuditVerificationResult,
  ContractSuspensionEvent,
  ContractResumeEvent,
  BoundaryEnforcedOptions,
  BOUNDARY_CLASSIFICATION_CAPS,
  BOUNDARY_NETWORK_STATUS,
  LC_TO_DAEMON_MODE,
  DAEMON_TO_LC_MODE,
} from './types';

// Adapter interface and implementations
export {
  BoundaryDaemonAdapter,
  BaseBoundaryDaemonAdapter,
  MockBoundaryDaemonAdapter,
  DaemonConnectionStatus,
  ModeChangeListener,
  TripwireListener,
} from './adapter';

// Boundary-enforced system
export {
  BoundaryEnforcedSystem,
  BoundaryEnforcedSystemConfig,
  ContractResolver,
  ActiveContractsProvider,
  SuspensionListener,
  ResumeListener,
  BoundaryAuditLogger,
  BoundaryAuditEvent,
} from './enforced-system';
