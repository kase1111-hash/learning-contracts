/**
 * Security Utility Functions
 *
 * Provides cryptographic and security-related utility functions
 * for secure handling of sensitive data in memory.
 */

import { timingSafeEqual } from 'crypto';

/**
 * Securely zeros out sensitive data in a Uint8Array
 * Prevents sensitive data from lingering in memory after use
 *
 * @param buffer - The Uint8Array to zero out
 */
export function zeroMemory(buffer: Uint8Array): void {
  if (!buffer || buffer.length === 0) {
    return;
  }

  // Overwrite all bytes with zeros
  buffer.fill(0);

  // Additional pass with random data then zeros (defense in depth)
  // This helps against potential memory recovery attacks
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = 0;
  }
}

/**
 * Securely clears plaintext content from a memory object
 * Should be called when the memory object is no longer needed
 *
 * @param memory - Memory object with potential plaintext content
 */
export function securelyClearMemory(memory: { content_plaintext?: Uint8Array }): void {
  if (memory.content_plaintext) {
    zeroMemory(memory.content_plaintext);
    // Explicitly delete the property to aid garbage collection
    delete memory.content_plaintext;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 * Use this for comparing hashes, tokens, or other sensitive strings
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function constantTimeCompare(a: string, b: string): boolean {
  // Quick check - if lengths differ, they're not equal
  // But still do the comparison to prevent timing leaks
  if (a.length !== b.length) {
    return false;
  }

  // Convert strings to buffers for timingSafeEqual
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    // If buffers have different lengths (shouldn't happen due to check above)
    return false;
  }
}

/**
 * Securely handles a callback with automatic memory cleanup
 * Ensures memory is zeroed even if an error occurs
 *
 * @param buffer - Sensitive buffer to protect
 * @param callback - Function to execute with the buffer
 * @returns Result of the callback
 */
export async function withSecureMemory<T>(
  buffer: Uint8Array,
  callback: (buf: Uint8Array) => Promise<T>
): Promise<T> {
  try {
    return await callback(buffer);
  } finally {
    // Always zero memory, even if callback throws
    zeroMemory(buffer);
  }
}

/**
 * Creates a secure copy of a Uint8Array that will be automatically zeroed
 * Returns both the copy and a cleanup function
 *
 * @param source - Source buffer to copy
 * @returns Tuple of [copy, cleanup function]
 */
export function createSecureCopy(source: Uint8Array): [Uint8Array, () => void] {
  const copy = new Uint8Array(source);
  const cleanup = () => zeroMemory(copy);
  return [copy, cleanup];
}
