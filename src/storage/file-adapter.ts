/**
 * File Storage Adapter
 *
 * JSON file-based storage adapter for persistent storage.
 * Uses atomic writes to prevent data corruption.
 * Includes SHA-256 integrity verification to detect tampering.
 */

import { createHash } from 'crypto';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { LearningContract } from '../types';
import {
  StorageAdapter,
  SerializedContract,
  serializeContract,
  deserializeContract,
} from './adapter';

export interface FileStorageConfig {
  /**
   * Path to the storage file
   */
  filePath: string;

  /**
   * Whether to create the file if it doesn't exist
   */
  createIfMissing?: boolean;

  /**
   * Whether to pretty-print JSON (default: false for performance)
   */
  prettyPrint?: boolean;
}

interface StorageFileFormat {
  version: number;
  updated_at: string;
  contracts: SerializedContract[];
  checksum?: string; // SHA-256 hash of contracts array for integrity verification
}

export class FileStorageAdapter implements StorageAdapter {
  private contracts: Map<string, LearningContract> = new Map();
  private filePath: string;
  private createIfMissing: boolean;
  private prettyPrint: boolean;
  private initialized = false;

  constructor(config: FileStorageConfig) {
    this.filePath = path.resolve(config.filePath);
    this.createIfMissing = config.createIfMissing ?? true;
    this.prettyPrint = config.prettyPrint ?? false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    try {
      await fsPromises.access(dir);
    } catch {
      await fsPromises.mkdir(dir, { recursive: true });
    }

    // Load existing data or create new file
    try {
      await fsPromises.access(this.filePath);
      await this.loadFromFile();
    } catch {
      if (this.createIfMissing) {
        await this.saveToFile();
      } else {
        throw new Error(`Storage file not found: ${this.filePath}`);
      }
    }

    this.initialized = true;
  }

  async save(contract: LearningContract): Promise<void> {
    this.ensureInitialized();
    this.contracts.set(contract.contract_id, { ...contract });
    await this.saveToFile();
  }

  async get(contractId: string): Promise<LearningContract | null> {
    this.ensureInitialized();
    const contract = this.contracts.get(contractId);
    return contract ? { ...contract } : null;
  }

  async delete(contractId: string): Promise<boolean> {
    this.ensureInitialized();
    const deleted = this.contracts.delete(contractId);
    if (deleted) {
      await this.saveToFile();
    }
    return deleted;
  }

  async exists(contractId: string): Promise<boolean> {
    this.ensureInitialized();
    return this.contracts.has(contractId);
  }

  async getAll(): Promise<LearningContract[]> {
    this.ensureInitialized();
    return Array.from(this.contracts.values()).map((c) => ({ ...c }));
  }

  async count(): Promise<number> {
    this.ensureInitialized();
    return this.contracts.size;
  }

  async clear(): Promise<void> {
    this.ensureInitialized();
    this.contracts.clear();
    await this.saveToFile();
  }

  async close(): Promise<void> {
    // Ensure all data is persisted
    if (this.initialized) {
      await this.saveToFile();
    }
    this.initialized = false;
  }

  /**
   * Gets the file path being used
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Loads contracts from the storage file
   */
  private async loadFromFile(): Promise<void> {
    try {
      const content = await fsPromises.readFile(this.filePath, 'utf-8');
      const data: StorageFileFormat = JSON.parse(content);

      // Validate version
      if (data.version !== 1) {
        throw new Error(`Unsupported storage file version: ${data.version}`);
      }

      // Verify integrity checksum if present
      if (data.checksum) {
        const contractsJson = JSON.stringify(data.contracts);
        const calculatedChecksum = createHash('sha256').update(contractsJson).digest('hex');

        if (calculatedChecksum !== data.checksum) {
          throw new Error(
            'Contract file integrity check failed - possible tampering detected. ' +
            'The file checksum does not match the expected value.'
          );
        }
      }

      // Load contracts
      this.contracts.clear();
      for (const serialized of data.contracts) {
        const contract = deserializeContract(serialized);
        this.contracts.set(contract.contract_id, contract);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, start with empty store
        this.contracts.clear();
      } else {
        throw new Error(
          `Failed to load storage file: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Saves contracts to the storage file using atomic write
   * Includes SHA-256 checksum for integrity verification
   */
  private async saveToFile(): Promise<void> {
    const contracts = Array.from(this.contracts.values()).map(serializeContract);

    // Calculate checksum of contracts array for integrity verification
    const contractsJson = JSON.stringify(contracts);
    const checksum = createHash('sha256').update(contractsJson).digest('hex');

    const data: StorageFileFormat = {
      version: 1,
      updated_at: new Date().toISOString(),
      contracts,
      checksum,
    };

    const content = this.prettyPrint
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);

    // Atomic write: write to temp file, then rename
    const tempPath = `${this.filePath}.tmp`;
    try {
      // Write with restricted permissions (owner read/write only)
      await fsPromises.writeFile(tempPath, content, { mode: 0o600, encoding: 'utf-8' });
      await fsPromises.rename(tempPath, this.filePath);
      // Ensure final file has correct permissions
      await fsPromises.chmod(this.filePath, 0o600);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fsPromises.access(tempPath);
        await fsPromises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(
        `Failed to save storage file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Ensures the adapter has been initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('FileStorageAdapter has not been initialized. Call initialize() first.');
    }
  }
}
