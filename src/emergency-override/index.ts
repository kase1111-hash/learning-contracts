/**
 * Emergency Override Module
 *
 * Provides a "pause all learning" capability for human supremacy.
 */

export { EmergencyOverrideManager } from './manager';
export {
  type EmergencyOverrideConfig,
  type EmergencyOverrideStatus,
  type OverrideTriggerEvent,
  type OverrideDisableEvent,
  type OverrideTriggerResult,
  type OverrideDisableResult,
  type OverrideTriggerListener,
  type OverrideDisableListener,
  type BlockedOperationListener,
} from './types';
