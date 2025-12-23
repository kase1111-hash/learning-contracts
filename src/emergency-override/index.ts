/**
 * Emergency Override Module
 *
 * Provides a "pause all learning" capability for human supremacy.
 */

export { EmergencyOverrideManager } from './manager';
export {
  EmergencyOverrideConfig,
  EmergencyOverrideStatus,
  OverrideTriggerEvent,
  OverrideDisableEvent,
  OverrideTriggerResult,
  OverrideDisableResult,
  OverrideTriggerListener,
  OverrideDisableListener,
  BlockedOperationListener,
} from './types';
