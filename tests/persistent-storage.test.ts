/**
 * Persistent Storage Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  LearningContractsSystem,
  ContractRepository,
  MemoryStorageAdapter,
  FileStorageAdapter,
  serializeContract,
  deserializeContract,
  ContractState,
  ContractType,
  BoundaryMode,
  AbstractionLevel,
} from '../src';

describe('Persistent Storage', () => {
  describe('MemoryStorageAdapter', () => {
    let adapter: MemoryStorageAdapter;

    beforeEach(async () => {
      adapter = new MemoryStorageAdapter();
      await adapter.initialize();
    });

    test('should save and retrieve a contract', async () => {
      const contract = createTestContract('test-1');

      await adapter.save(contract);
      const retrieved = await adapter.get('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.contract_id).toBe('test-1');
    });

    test('should return null for non-existent contract', async () => {
      const retrieved = await adapter.get('non-existent');
      expect(retrieved).toBeNull();
    });

    test('should check if contract exists', async () => {
      const contract = createTestContract('test-1');
      await adapter.save(contract);

      expect(await adapter.exists('test-1')).toBe(true);
      expect(await adapter.exists('non-existent')).toBe(false);
    });

    test('should delete a contract', async () => {
      const contract = createTestContract('test-1');
      await adapter.save(contract);

      const deleted = await adapter.delete('test-1');

      expect(deleted).toBe(true);
      expect(await adapter.exists('test-1')).toBe(false);
    });

    test('should get all contracts', async () => {
      await adapter.save(createTestContract('test-1'));
      await adapter.save(createTestContract('test-2'));
      await adapter.save(createTestContract('test-3'));

      const all = await adapter.getAll();

      expect(all.length).toBe(3);
    });

    test('should count contracts', async () => {
      await adapter.save(createTestContract('test-1'));
      await adapter.save(createTestContract('test-2'));

      expect(await adapter.count()).toBe(2);
    });

    test('should clear all contracts', async () => {
      await adapter.save(createTestContract('test-1'));
      await adapter.save(createTestContract('test-2'));

      await adapter.clear();

      expect(await adapter.count()).toBe(0);
    });
  });

  describe('FileStorageAdapter', () => {
    let adapter: FileStorageAdapter;
    let tempDir: string;
    let testFilePath: string;

    beforeEach(async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-test-'));
      testFilePath = path.join(tempDir, 'contracts.json');
      adapter = new FileStorageAdapter({
        filePath: testFilePath,
        createIfMissing: true,
        prettyPrint: true,
      });
      await adapter.initialize();
    });

    afterEach(async () => {
      await adapter.close();
      // Clean up temp files
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
      }
    });

    test('should create storage file on initialization', async () => {
      expect(fs.existsSync(testFilePath)).toBe(true);
    });

    test('should save and retrieve a contract', async () => {
      const contract = createTestContract('test-1');

      await adapter.save(contract);
      const retrieved = await adapter.get('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.contract_id).toBe('test-1');
    });

    test('should persist contracts to file', async () => {
      const contract = createTestContract('test-1');
      await adapter.save(contract);

      // Read the file directly
      const content = fs.readFileSync(testFilePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.version).toBe(1);
      expect(data.contracts.length).toBe(1);
      expect(data.contracts[0].contract_id).toBe('test-1');
    });

    test('should load contracts on new adapter initialization', async () => {
      // Save a contract
      const contract = createTestContract('test-1');
      await adapter.save(contract);
      await adapter.close();

      // Create a new adapter with same file
      const adapter2 = new FileStorageAdapter({
        filePath: testFilePath,
        createIfMissing: false,
      });
      await adapter2.initialize();

      const retrieved = await adapter2.get('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.contract_id).toBe('test-1');

      await adapter2.close();
    });

    test('should preserve date fields correctly', async () => {
      const contract = createTestContract('test-1');
      const originalDate = contract.created_at;

      await adapter.save(contract);
      await adapter.close();

      // Create a new adapter with same file
      const adapter2 = new FileStorageAdapter({
        filePath: testFilePath,
      });
      await adapter2.initialize();

      const retrieved = await adapter2.get('test-1');

      expect(retrieved?.created_at).toBeInstanceOf(Date);
      expect(retrieved?.created_at.getTime()).toBe(originalDate.getTime());

      await adapter2.close();
    });

    test('should handle multiple contracts', async () => {
      await adapter.save(createTestContract('test-1'));
      await adapter.save(createTestContract('test-2'));
      await adapter.save(createTestContract('test-3'));

      const all = await adapter.getAll();
      expect(all.length).toBe(3);
    });

    test('should update existing contract', async () => {
      const contract = createTestContract('test-1');
      await adapter.save(contract);

      // Update contract
      contract.state = ContractState.REVOKED;
      await adapter.save(contract);

      const retrieved = await adapter.get('test-1');
      expect(retrieved?.state).toBe(ContractState.REVOKED);
    });

    test('should delete and persist', async () => {
      await adapter.save(createTestContract('test-1'));
      await adapter.save(createTestContract('test-2'));

      await adapter.delete('test-1');

      // Read the file directly
      const content = fs.readFileSync(testFilePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.contracts.length).toBe(1);
      expect(data.contracts[0].contract_id).toBe('test-2');
    });

    test('should clear all contracts', async () => {
      await adapter.save(createTestContract('test-1'));
      await adapter.save(createTestContract('test-2'));

      await adapter.clear();

      expect(await adapter.count()).toBe(0);

      // Verify file is updated
      const content = fs.readFileSync(testFilePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.contracts.length).toBe(0);
    });

    test('should throw error if file missing and createIfMissing is false', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent.json');
      const strictAdapter = new FileStorageAdapter({
        filePath: nonExistentPath,
        createIfMissing: false,
      });

      await expect(strictAdapter.initialize()).rejects.toThrow('Storage file not found');
    });

    test('should get file path', () => {
      expect(adapter.getFilePath()).toBe(testFilePath);
    });
  });

  describe('Contract Serialization', () => {
    test('should serialize contract correctly', () => {
      const contract = createTestContract('test-1');
      const serialized = serializeContract(contract);

      expect(serialized.contract_id).toBe('test-1');
      expect(typeof serialized.created_at).toBe('string');
      expect(serialized.state).toBe('active');
    });

    test('should deserialize contract correctly', () => {
      const contract = createTestContract('test-1');
      const serialized = serializeContract(contract);
      const deserialized = deserializeContract(serialized);

      expect(deserialized.contract_id).toBe('test-1');
      expect(deserialized.created_at).toBeInstanceOf(Date);
      expect(deserialized.state).toBe(ContractState.ACTIVE);
    });

    test('should handle optional retention_until', () => {
      const contract = createTestContract('test-1');
      contract.memory_permissions.retention_until = new Date('2025-12-31');

      const serialized = serializeContract(contract);
      const deserialized = deserializeContract(serialized);

      expect(deserialized.memory_permissions.retention_until).toBeInstanceOf(Date);
      expect(deserialized.memory_permissions.retention_until?.toISOString()).toBe(
        '2025-12-31T00:00:00.000Z'
      );
    });

    test('should handle null expiration', () => {
      const contract = createTestContract('test-1');
      contract.expiration = null;

      const serialized = serializeContract(contract);
      expect(serialized.expiration).toBeNull();

      const deserialized = deserializeContract(serialized);
      expect(deserialized.expiration).toBeNull();
    });
  });

  describe('ContractRepository with Adapters', () => {
    test('should work with MemoryStorageAdapter', async () => {
      const adapter = new MemoryStorageAdapter();
      const repo = new ContractRepository({ adapter });
      await repo.initialize();

      const contract = createTestContract('test-1');
      repo.save(contract);

      expect(repo.get('test-1')).toBeDefined();
      expect(repo.count()).toBe(1);
    });

    test('should work with FileStorageAdapter', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-test-'));
      const testFilePath = path.join(tempDir, 'contracts.json');

      try {
        const adapter = new FileStorageAdapter({
          filePath: testFilePath,
          createIfMissing: true,
        });
        const repo = new ContractRepository({ adapter });
        await repo.initialize();

        const contract = createTestContract('test-1');
        repo.save(contract);

        // Wait for background write
        await repo.flush();

        expect(repo.get('test-1')).toBeDefined();

        // Verify file was written
        expect(fs.existsSync(testFilePath)).toBe(true);

        await repo.close();
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      }
    });

    test('should persist across repository instances', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-test-'));
      const testFilePath = path.join(tempDir, 'contracts.json');

      try {
        // First repository
        const adapter1 = new FileStorageAdapter({
          filePath: testFilePath,
          createIfMissing: true,
        });
        const repo1 = new ContractRepository({ adapter: adapter1 });
        await repo1.initialize();

        repo1.save(createTestContract('test-1'));
        repo1.save(createTestContract('test-2'));
        await repo1.flush();
        await repo1.close();

        // Second repository
        const adapter2 = new FileStorageAdapter({
          filePath: testFilePath,
        });
        const repo2 = new ContractRepository({ adapter: adapter2 });
        await repo2.initialize();

        expect(repo2.count()).toBe(2);
        expect(repo2.get('test-1')).toBeDefined();
        expect(repo2.get('test-2')).toBeDefined();

        await repo2.close();
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      }
    });
  });

  describe('Integration with LearningContractsSystem', () => {
    test('should work with default memory storage', () => {
      const system = new LearningContractsSystem();

      let contract = system.createEpisodicContract('alice', {
        domains: ['coding'],
      });
      contract = system.submitForReview(contract.contract_id, 'alice');
      contract = system.activateContract(contract.contract_id, 'alice');

      expect(system.getContract(contract.contract_id)).toBeDefined();
    });

    test('should use storage adapter via repository', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-test-'));
      const testFilePath = path.join(tempDir, 'contracts.json');

      try {
        const adapter = new FileStorageAdapter({
          filePath: testFilePath,
          createIfMissing: true,
        });
        const repo = new ContractRepository({ adapter });
        await repo.initialize();

        // Create contract and save manually
        const contract = createTestContract('test-1');
        repo.save(contract);
        await repo.flush();

        expect(repo.count()).toBe(1);

        await repo.close();

        // Verify persistence
        expect(fs.existsSync(testFilePath)).toBe(true);
        const content = fs.readFileSync(testFilePath, 'utf-8');
        const data = JSON.parse(content);
        expect(data.contracts.length).toBe(1);
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      }
    });
  });
});

// Helper function to create test contracts
function createTestContract(id: string): any {
  return {
    contract_id: id,
    created_at: new Date(),
    created_by: 'test-user',
    state: ContractState.ACTIVE,
    contract_type: ContractType.EPISODIC,
    scope: {
      domains: ['coding'],
      contexts: [],
      tools: [],
      max_abstraction: AbstractionLevel.RAW,
      transferable: false,
    },
    memory_permissions: {
      may_store: true,
      classification_cap: 3,
      retention: 'timebound',
    },
    generalization_rules: {
      allowed: false,
      conditions: [],
    },
    recall_rules: {
      requires_owner: true,
      boundary_mode_min: BoundaryMode.NORMAL,
    },
    expiration: null,
    revocable: true,
  };
}
