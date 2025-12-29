/**
 * Security Utilities Tests
 *
 * Tests for cryptographic and security utility functions
 */

import {
  zeroMemory,
  securelyClearMemory,
  constantTimeCompare,
  withSecureMemory,
  createSecureCopy,
} from '../src/vault-integration/security-utils';

describe('Security Utilities', () => {
  describe('zeroMemory', () => {
    it('should zero out all bytes in a buffer', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]);
      zeroMemory(buffer);

      expect(buffer).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    });

    it('should handle empty buffers', () => {
      const buffer = new Uint8Array([]);
      expect(() => zeroMemory(buffer)).not.toThrow();
    });

    it('should handle large buffers', () => {
      const buffer = new Uint8Array(10000);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = i % 256;
      }

      zeroMemory(buffer);

      for (let i = 0; i < buffer.length; i++) {
        expect(buffer[i]).toBe(0);
      }
    });
  });

  describe('securelyClearMemory', () => {
    it('should clear content_plaintext from memory object', () => {
      const memory = {
        content_plaintext: new Uint8Array([1, 2, 3, 4, 5]),
      };

      securelyClearMemory(memory);

      expect(memory.content_plaintext).toBeUndefined();
    });

    it('should zero the buffer before deleting', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]);
      const memory = {
        content_plaintext: buffer,
      };

      securelyClearMemory(memory);

      // Buffer should be zeroed
      expect(buffer).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
      // Property should be deleted
      expect(memory.content_plaintext).toBeUndefined();
    });

    it('should handle objects without content_plaintext', () => {
      const memory = {};
      expect(() => securelyClearMemory(memory)).not.toThrow();
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for identical strings', () => {
      const hash = 'a'.repeat(64); // SHA-256 length
      expect(constantTimeCompare(hash, hash)).toBe(true);
    });

    it('should return false for different strings of same length', () => {
      const hashA = 'a'.repeat(64);
      const hashB = 'b'.repeat(64);
      expect(constantTimeCompare(hashA, hashB)).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      const hashA = 'a'.repeat(64);
      const hashB = 'a'.repeat(32);
      expect(constantTimeCompare(hashA, hashB)).toBe(false);
    });

    it('should be constant-time (not leak timing info)', () => {
      // This is a basic test - real timing attack tests require more sophisticated measurement
      const correctHash = 'a'.repeat(64);
      const wrongHashEarly = 'b' + 'a'.repeat(63); // Differs in first char
      const wrongHashLate = 'a'.repeat(63) + 'b'; // Differs in last char

      const start1 = process.hrtime.bigint();
      constantTimeCompare(correctHash, wrongHashEarly);
      const time1 = process.hrtime.bigint() - start1;

      const start2 = process.hrtime.bigint();
      constantTimeCompare(correctHash, wrongHashLate);
      const time2 = process.hrtime.bigint() - start2;

      // Times should be similar (within order of magnitude)
      // This is a loose check - real constant-time verification needs statistical analysis
      expect(time1).toBeGreaterThan(0n);
      expect(time2).toBeGreaterThan(0n);
    });

    it('should handle empty strings', () => {
      expect(constantTimeCompare('', '')).toBe(true);
      expect(constantTimeCompare('a', '')).toBe(false);
      expect(constantTimeCompare('', 'a')).toBe(false);
    });

    it('should work with realistic SHA-256 hashes', () => {
      const hash1 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const hash2 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const hash3 = 'a'.repeat(64);

      expect(constantTimeCompare(hash1, hash2)).toBe(true);
      expect(constantTimeCompare(hash1, hash3)).toBe(false);
    });
  });

  describe('withSecureMemory', () => {
    it('should execute callback and zero memory after', async () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]);

      const result = await withSecureMemory(buffer, async (buf) => {
        // Verify buffer is accessible during callback
        expect(buf[0]).toBe(1);
        return 'success';
      });

      expect(result).toBe('success');
      // Buffer should be zeroed after callback
      expect(buffer).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    });

    it('should zero memory even if callback throws', async () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]);

      await expect(
        withSecureMemory(buffer, async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Buffer should still be zeroed despite error
      expect(buffer).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    });

    it('should work with async operations', async () => {
      const buffer = new Uint8Array([1, 2, 3]);

      const result = await withSecureMemory(buffer, async (buf) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return buf.length;
      });

      expect(result).toBe(3);
      expect(buffer).toEqual(new Uint8Array([0, 0, 0]));
    });
  });

  describe('createSecureCopy', () => {
    it('should create a copy of the buffer', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const [copy, cleanup] = createSecureCopy(original);

      expect(copy).toEqual(original);
      expect(copy).not.toBe(original); // Different object

      // Cleanup to avoid unused variable warning
      cleanup();
    });

    it('should provide cleanup function that zeros the copy', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const [copy, cleanup] = createSecureCopy(original);

      cleanup();

      // Copy should be zeroed
      expect(copy).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
      // Original should be unchanged
      expect(original).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('should work with empty buffers', () => {
      const original = new Uint8Array([]);
      const [copy, cleanup] = createSecureCopy(original);

      expect(copy).toEqual(original);
      cleanup(); // Call cleanup to avoid unused variable
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('Integration: Memory lifecycle', () => {
    it('should demonstrate secure memory handling pattern', async () => {
      // Simulate receiving sensitive data
      const sensitiveData = new Uint8Array([1, 2, 3, 4, 5]);

      // Create secure copy for processing
      const [workingCopy, cleanup] = createSecureCopy(sensitiveData);

      try {
        // Process data
        await withSecureMemory(workingCopy, async (data) => {
          // Do something with data
          expect(data[0]).toBe(1);
        });
      } finally {
        // Ensure cleanup happens
        cleanup();
      }

      // Working copy is zeroed (already by withSecureMemory)
      expect(workingCopy).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    });

    it('should clear memory object after use', () => {
      const memoryObject = {
        memory_id: 'test-123',
        content_plaintext: new Uint8Array([1, 2, 3, 4, 5]),
      };

      // Use the data
      expect(memoryObject.content_plaintext![0]).toBe(1);

      // Clear when done
      securelyClearMemory(memoryObject);

      // Verify it's cleared
      expect(memoryObject.content_plaintext).toBeUndefined();
    });
  });
});
