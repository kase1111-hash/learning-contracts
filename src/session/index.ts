/**
 * Session Management
 *
 * Provides session tracking and automatic cleanup of session-scoped contracts.
 */

export * from './types';
export {
  SessionManager,
  SessionManagerConfig,
  SessionContractResolver,
  SessionContractExpirer,
  SessionMemoryFreezer,
} from './manager';
