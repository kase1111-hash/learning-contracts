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
  type TripwireEvent,
  type RecallGateRequest,
  type RecallGateResult,
  type ToolGateRequest,
  type ToolGateResult,
  type BoundaryStatus,
  type ModeTransitionRequest,
  type ModeTransitionResult,
  type OverrideCeremonyRequest,
  type OverrideCeremonyResult,
  type BoundaryAuditEntry,
  type AuditVerificationResult,
  type ContractSuspensionEvent,
  type ContractResumeEvent,
  type BoundaryEnforcedOptions,
  BOUNDARY_CLASSIFICATION_CAPS,
  BOUNDARY_NETWORK_STATUS,
  LC_TO_DAEMON_MODE,
  DAEMON_TO_LC_MODE,
} from './types';

// Adapter interface and implementations
export {
  type BoundaryDaemonAdapter,
  BaseBoundaryDaemonAdapter,
  MockBoundaryDaemonAdapter,
  type DaemonConnectionStatus,
  type ModeChangeListener,
  type TripwireListener,
} from './adapter';

// Boundary-enforced system
export {
  BoundaryEnforcedSystem,
  type BoundaryEnforcedSystemConfig,
  type BoundaryContractResolver,
  type ActiveContractsProvider,
  type SuspensionListener,
  type ResumeListener,
  type BoundaryAuditLogger,
  type BoundaryAuditEvent,
} from './enforced-system';
