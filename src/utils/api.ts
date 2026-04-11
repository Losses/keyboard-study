/**
 * Utility functions for API communication with Google Apps Script.
 * Uses JSONP for cross-domain requests and includes data integrity verification.
 */

import { GOOGLE_APPS_SCRIPT_URL } from '../constants';
import md5 from 'md5';

/**
 * Parameters for JSONP requests.
 */
export interface JsonpParams {
  [key: string]: string | number;
}

/**
 * Response from the JSONP endpoint.
 */
export interface JsonpResponse {
  status: 'success' | 'error';
  message?: string;
  data?: unknown;
}

/**
 * Generates a base64 URL-safe MD5 hash of a string.
 * Used for data integrity verification during upload.
 * Note: Using MD5 to match the Google Apps Script implementation.
 *
 * @param str - The string to hash
 * @returns A promise that resolves to the base64 URL-safe hash
 */
export async function getHashBase64Url(str: string): Promise<string> {
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

/**
 * Callback ID generator for JSONP requests.
 * Uses base-36 encoding for compact representation.
 * For a single session with ≤50 requests, provides 46,656 unique combinations.
 */
let callbackCounter = 0;

function generateCallbackId(): string {
  // Use base-36 (0-9, a-z) for shorter representation
  // For 50 requests: 0, 1, 2, ..., '1d' (49 in base-36)
  // Length: 4-5 characters instead of 18-21
  const id = callbackCounter.toString(36);
  callbackCounter++;
  return `cb_${id}`;
}

/**
 * Performs a JSONP (JSON with Padding) request to the Google Apps Script endpoint.
 * JSONP is used to bypass CORS restrictions when communicating with Google Apps Script.
 *
 * @param params - Query parameters to send with the request
 * @returns A promise that resolves with the response data
 * @throws Error if the network request fails
 */
export function jsonpFetch(params: JsonpParams): Promise<JsonpResponse> {
  return new Promise<JsonpResponse>((resolve, reject) => {
    // Generate a unique callback name (optimized for short length)
    const cbName = generateCallbackId();

    // Define the callback function globally
    // Using type assertion to bypass window's strict typing for dynamic callback registration
    (window as unknown as { [key: string]: (data: JsonpResponse) => void })[cbName] = (data: JsonpResponse) => {
      // Cleanup
      delete (window as unknown as { [key: string]: unknown })[cbName];
      if (script.parentNode) {
        document.head.removeChild(script);
      }

      // Log response for debugging
      console.log('[JSONP Response]', data);

      // Check for error in response
      if (data && typeof data === 'object' && 'error' in data) {
        console.error('[JSONP Error]', data.error);
        reject(new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error)));
        return;
      }

      resolve(data);
    };

    // Create and configure the script element
    const script = document.createElement('script');
    const searchParams = new URLSearchParams();
    searchParams.set('callback', cbName);

    // Add all parameters to the query string
    for (const [key, value] of Object.entries(params)) {
      searchParams.set(key, String(value));
    }

    const url = `${GOOGLE_APPS_SCRIPT_URL}?${searchParams.toString()}`;
    console.log('[JSONP Request]', params.action, params);

    script.src = url;

    // Handle errors
    script.onerror = () => {
      delete (window as unknown as { [key: string]: unknown })[cbName];
      if (script.parentNode) {
        document.head.removeChild(script);
      }
      console.error('[JSONP Network Error] Failed to load script:', url);
      console.error('[JSONP Network Error] URL length:', url.length);
      console.error('[JSONP Network Error] Parameters:', params);
      reject(new Error(`Network Request Error: Failed to load ${url}`));
    };

    // Execute the request
    document.head.appendChild(script);
  });
}

/**
 * Uploads trial results data to Google Sheets via JSONP.
 *
 * @param rows - Array of data rows to upload
 * @param sheet - Target sheet name ('trials', 'device', etc.)
 * @returns A promise that resolves when upload is complete
 */
export function uploadTrialsData(rows: unknown[][], sheet: string): Promise<JsonpResponse> {
  return jsonpFetch({
    action: 'write',
    sheet,
    rows: JSON.stringify(rows),
  });
}

/**
 * Uploads device environment data to Google Sheets via JSONP.
 *
 * @param rows - Device data rows to upload
 * @returns A promise that resolves when upload is complete
 */
export function uploadDeviceData(rows: unknown[][]): Promise<JsonpResponse> {
  return jsonpFetch({
    action: 'write',
    sheet: 'device',
    rows: JSON.stringify(rows),
  });
}

/**
 * Uploads a chunk of keypress data to Google Sheets via JSONP.
 * Large datasets are split into chunks to avoid URL length limits.
 * Includes retry logic for network failures.
 *
 * @param chunkData - Base64 encoded chunk data
 * @param sessionId - Unique session identifier for chunk reconstruction
 * @param totalChunks - Total number of chunks in this upload
 * @param chunkIndex - Index of this chunk (0-based)
 * @param dataHash - Hash of the complete dataset for verification
 * @param retries - Number of retry attempts (default: 3)
 * @returns A promise that resolves when chunk upload is complete
 */
export async function uploadKeypressChunk(
  chunkData: string,
  sessionId: string,
  totalChunks: number,
  chunkIndex: number,
  dataHash: string,
  retries = 3
): Promise<JsonpResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await jsonpFetch({
        action: 'chunk',
        sheet: 'keypresses',
        sessionId,
        totalChunks,
        chunkIndex,
        chunkData,
        dataHash,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[Chunk ${chunkIndex}] Upload attempt ${attempt + 1}/${retries} failed:`, lastError.message);

      if (attempt < retries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Chunk ${chunkIndex}] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to upload chunk ${chunkIndex} after ${retries} attempts`);
}

/**
 * Finalizes a chunked upload session.
 * This triggers the server to merge all uploaded chunks into the keypresses sheet.
 * Should be called immediately after all chunks have been successfully uploaded.
 *
 * @param sessionId - Unique session identifier for the upload session
 * @returns A promise that resolves when finalization is complete
 */
export function finalizeUpload(sessionId: string): Promise<JsonpResponse> {
  return jsonpFetch({
    action: 'finalize',
    sessionId,
  });
}
