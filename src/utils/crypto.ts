/**
 * Cryptographic utilities for data integrity verification.
 */

import md5 from 'md5';

/**
 * Generates a base64 URL-safe MD5 hash of a string.
 * Used for data integrity verification during upload.
 * Note: Using MD5 to match the Google Apps Script implementation.
 *
 * @param str - The string to hash
 * @returns A promise that resolves to the base64 URL-safe hash
 */
export async function hashData(str: string): Promise<string> {
  // Compute MD5 hash (returns hex string)
  const hashHex = md5(str);

  // Convert hex to bytes
  const hashBytes = new Uint8Array(hashHex.length / 2);
  for (let i = 0; i < hashHex.length; i += 2) {
    hashBytes[i / 2] = parseInt(hashHex.substr(i, 2), 16);
  }

  // Convert bytes to base64
  const hashBase64 = btoa(String.fromCharCode.apply(null, Array.from(hashBytes)));

  // Convert to URL-safe base64
  return hashBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
