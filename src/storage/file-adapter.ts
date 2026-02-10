/**
 * File Storage Adapter
 *
 * JSON file-based storage adapter for persistent storage.
 * Uses atomic writes to prevent data corruption.
 * Includes SHA-256 integrity verification to detect tampering.
 * Supports AES-256-GCM encryption at rest.
 */

import {
  createHash,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from 'crypto';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { LearningContract } from '../types';
import {
  StorageAdapter,
  SerializedContract,
  serializeContract,
  deserializeContract,
} from './adapter';

/**
 * Encryption configuration for file storage
 */
export interface EncryptionConfig {
  /**
   * Enable encryption at rest
   */
  enabled: boolean;

  /**
   * Passphrase for key derivation (required if enabled)
   */
  passphrase?: string;

  /**
   * Salt for key derivation (auto-generated if not provided)
   */
  salt?: string;

  /**
   * PBKDF2 iterations for key derivation (default: 100000)
   */
  iterations?: number;
}

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

  /**
   * Encryption configuration for data at rest
   */
  encryption?: EncryptionConfig;
}

interface StorageFileFormat {
  version: number;
  updated_at: string;
  contracts: SerializedContract[];
  checksum?: string; // SHA-256 hash of contracts array for integrity verification
}

interface EncryptedStorageFileFormat {
  version: number;
  encrypted: true;
  updated_at: string;
  salt: string;      // Hex-encoded salt for key derivation
  iv: string;        // Hex-encoded initialization vector
  authTag: string;   // Hex-encoded authentication tag
  ciphertext: string; // Base64-encoded encrypted data
}

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // 96 bits for GCM
const DEFAULT_ITERATIONS = 100000;

export class FileStorageAdapter implements StorageAdapter {
  private contracts: Map<string, LearningContract> = new Map();
  private filePath: string;
  private createIfMissing: boolean;
  private prettyPrint: boolean;
  private initialized = false;
  private encryptionConfig?: EncryptionConfig;
  private encryptionKey?: Buffer;
  private encryptionSalt?: string;

  constructor(config: FileStorageConfig) {
    this.filePath = path.resolve(config.filePath);
    this.createIfMissing = config.createIfMissing ?? true;
    this.prettyPrint = config.prettyPrint ?? false;
    this.encryptionConfig = config.encryption;

    // Validate encryption config
    if (this.encryptionConfig?.enabled && !this.encryptionConfig.passphrase) {
      throw new Error('Encryption passphrase is required when encryption is enabled');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize encryption if enabled
    if (this.encryptionConfig?.enabled) {
      this.encryptionSalt = this.encryptionConfig.salt ?? randomBytes(16).toString('hex');
      this.deriveEncryptionKey();
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

  /**
   * Derives the encryption key from passphrase using PBKDF2
   */
  private deriveEncryptionKey(): void {
    if (!this.encryptionConfig?.passphrase || !this.encryptionSalt) {
      throw new Error('Cannot derive key without passphrase and salt');
    }

    const iterations = this.encryptionConfig.iterations ?? DEFAULT_ITERATIONS;
    this.encryptionKey = pbkdf2Sync(
      this.encryptionConfig.passphrase,
      Buffer.from(this.encryptionSalt, 'hex'),
      iterations,
      KEY_LENGTH,
      'sha256'
    );
  }

  /**
   * Encrypts data using AES-256-GCM
   */
  private encrypt(plaintext: string): { iv: string; authTag: string; ciphertext: string } {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf-8', 'base64');
    encrypted += cipher.final('base64');

    return {
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
      ciphertext: encrypted,
    };
  }

  /**
   * Decrypts data using AES-256-GCM
   */
  private decrypt(iv: string, authTag: string, ciphertext: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(ciphertext, 'base64', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }

  async save(contract: LearningContract): Promise<void> {
    this.ensureInitialized();
    this.contracts.set(contract.contract_id, { ...contract });
    await this.saveToFile();
  }

  get(contractId: string): Promise<LearningContract | null> {
    this.ensureInitialized();
    const contract = this.contracts.get(contractId);
    return Promise.resolve(contract ? { ...contract } : null);
  }

  async delete(contractId: string): Promise<boolean> {
    this.ensureInitialized();
    const deleted = this.contracts.delete(contractId);
    if (deleted) {
      await this.saveToFile();
    }
    return deleted;
  }

  exists(contractId: string): Promise<boolean> {
    this.ensureInitialized();
    return Promise.resolve(this.contracts.has(contractId));
  }

  getAll(): Promise<LearningContract[]> {
    this.ensureInitialized();
    return Promise.resolve(Array.from(this.contracts.values()).map((c) => ({ ...c })));
  }

  count(): Promise<number> {
    this.ensureInitialized();
    return Promise.resolve(this.contracts.size);
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
      const rawData = JSON.parse(content) as { encrypted?: boolean };

      // Check if file is encrypted
      if (rawData.encrypted) {
        this.loadEncryptedFile(content);
        return;
      }

      const data = rawData as StorageFileFormat;

      // Validate version
      if (data.version !== 1) {
        throw new Error(`Unsupported storage file version: ${data.version}`);
      }

      // Verify integrity checksum if present
      if (data.checksum) {
        const contractsJson = JSON.stringify(data.contracts);
        const calculatedChecksum = createHash('sha256').update(contractsJson).digest('hex');

        // Use constant-time comparison to prevent timing attacks
        if (!this.constantTimeCompare(calculatedChecksum, data.checksum)) {
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
   * Loads and decrypts an encrypted storage file
   */
  private loadEncryptedFile(content: string): void {
    if (!this.encryptionConfig?.enabled) {
      throw new Error('File is encrypted but encryption is not configured');
    }

    const encryptedData = JSON.parse(content) as EncryptedStorageFileFormat;

    // Use the salt from the file for key derivation
    this.encryptionSalt = encryptedData.salt;
    this.deriveEncryptionKey();

    // Decrypt the content
    const decryptedContent = this.decrypt(
      encryptedData.iv,
      encryptedData.authTag,
      encryptedData.ciphertext
    );

    const data = JSON.parse(decryptedContent) as StorageFileFormat;

    // Verify integrity checksum if present
    if (data.checksum) {
      const contractsJson = JSON.stringify(data.contracts);
      const calculatedChecksum = createHash('sha256').update(contractsJson).digest('hex');

      if (!this.constantTimeCompare(calculatedChecksum, data.checksum)) {
        throw new Error(
          'Contract file integrity check failed - possible tampering detected.'
        );
      }
    }

    // Load contracts
    this.contracts.clear();
    for (const serialized of data.contracts) {
      const contract = deserializeContract(serialized);
      this.contracts.set(contract.contract_id, contract);
    }
  }

  /**
   * Saves contracts to the storage file using atomic write
   * Includes SHA-256 checksum for integrity verification
   * Encrypts if encryption is enabled
   */
  private async saveToFile(): Promise<void> {
    const contracts = Array.from(this.contracts.values()).map(serializeContract);

    // Calculate checksum of contracts array for integrity verification
    const contractsJson = JSON.stringify(contracts);
    const checksum = createHash('sha256').update(contractsJson).digest('hex');

    const innerData: StorageFileFormat = {
      version: 1,
      updated_at: new Date().toISOString(),
      contracts,
      checksum,
    };

    let content: string;

    if (this.encryptionConfig?.enabled && this.encryptionKey && this.encryptionSalt) {
      // Encrypt the data
      const plaintext = JSON.stringify(innerData);
      const encrypted = this.encrypt(plaintext);

      const encryptedData: EncryptedStorageFileFormat = {
        version: 1,
        encrypted: true,
        updated_at: new Date().toISOString(),
        salt: this.encryptionSalt,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        ciphertext: encrypted.ciphertext,
      };

      content = this.prettyPrint
        ? JSON.stringify(encryptedData, null, 2)
        : JSON.stringify(encryptedData);
    } else {
      content = this.prettyPrint
        ? JSON.stringify(innerData, null, 2)
        : JSON.stringify(innerData);
    }

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

  /**
   * Constant-time string comparison to prevent timing attacks
   * Uses timingSafeEqual for cryptographic hash comparison
   */
  private constantTimeCompare(a: string, b: string): boolean {
    // If lengths differ, still perform comparison to prevent length-based timing leaks
    // Pad the shorter string to match length for constant-time comparison
    const maxLength = Math.max(a.length, b.length);
    const bufA = Buffer.alloc(maxLength);
    const bufB = Buffer.alloc(maxLength);

    bufA.write(a, 0, a.length, 'utf-8');
    bufB.write(b, 0, b.length, 'utf-8');

    // timingSafeEqual requires equal-length buffers
    const equalLength = a.length === b.length;
    const equalContent = timingSafeEqual(bufA, bufB);

    return equalLength && equalContent;
  }
}
