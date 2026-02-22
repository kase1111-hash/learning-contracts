/**
 * Audit Persistence Adapter
 *
 * Interface and implementations for persisting audit events
 * to an external store (file, database, etc.).
 */

import * as fs from 'fs/promises';
import { AuditEvent } from '../types';

/**
 * Interface for persisting audit events to an external store.
 * Implementations can write to files, databases, or external services.
 */
export interface AuditPersistenceAdapter {
  /** Persist one or more audit events. */
  persist(events: AuditEvent[]): Promise<void>;
  /** Load all persisted events (for recovery). */
  load(): Promise<AuditEvent[]>;
  /** Close the persistence adapter and flush any buffers. */
  close(): Promise<void>;
}

/**
 * File-backed audit persistence adapter.
 * Appends events to a JSON-lines file for durability.
 * Each line is a self-contained JSON object representing one AuditEvent.
 */
export class FileAuditPersistence implements AuditPersistenceAdapter {
  constructor(private filePath: string) {}

  async persist(events: AuditEvent[]): Promise<void> {
    const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
    await fs.appendFile(this.filePath, lines, 'utf-8');
  }

  async load(): Promise<AuditEvent[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const lines = content.trim().split('\n').filter((line) => line.length > 0);
      return lines.map((line) => {
        const parsed = JSON.parse(line);
        // Restore Date objects from ISO strings
        parsed.timestamp = new Date(parsed.timestamp);
        return parsed as AuditEvent;
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    // No buffering to flush for simple append-based persistence
  }
}
