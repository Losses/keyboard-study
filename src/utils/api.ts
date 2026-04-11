/**
 * Utility functions for API communication with Google Apps Script.
 * Uses JSONP for cross-domain requests and includes data integrity verification.
 */

import { GOOGLE_APPS_SCRIPT_URL } from '../constants';

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
 * Generates a base64 URL-safe SHA-256 hash of a string.
 * Used for data integrity verification during upload.
 *
 * @param str - The string to hash
 * @returns A promise that resolves to the base64 URL-safe hash
 */
export async function getHashBase64Url(str: string): Promise<string> {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashBase64 = btoa(hashArray.map((x) => String.fromCharCode(x)).join(''));
  return hashBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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
    // Generate a unique callback name
    const cbName = `cb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Define the callback function globally
    // Using type assertion to bypass window's strict typing for dynamic callback registration
    (window as unknown as { [key: string]: (data: JsonpResponse) => void })[cbName] = (data: JsonpResponse) => {
      // Cleanup
      delete (window as unknown as { [key: string]: unknown })[cbName];
      if (script.parentNode) {
        document.head.removeChild(script);
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

    script.src = `${GOOGLE_APPS_SCRIPT_URL}?${searchParams.toString()}`;

    // Handle errors
    script.onerror = () => {
      delete (window as unknown as { [key: string]: unknown })[cbName];
      if (script.parentNode) {
        document.head.removeChild(script);
      }
      reject(new Error('Network Request Error'));
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
 *
 * @param chunkData - Base64 encoded chunk data
 * @param sessionId - Unique session identifier for chunk reconstruction
 * @param totalChunks - Total number of chunks in this upload
 * @param chunkIndex - Index of this chunk (0-based)
 * @param dataHash - Hash of the complete dataset for verification
 * @returns A promise that resolves when chunk upload is complete
 */
export function uploadKeypressChunk(
  chunkData: string,
  sessionId: string,
  totalChunks: number,
  chunkIndex: number,
  dataHash: string
): Promise<JsonpResponse> {
  return jsonpFetch({
    action: 'chunk',
    sheet: 'keypresses',
    sessionId,
    totalChunks,
    chunkIndex,
    chunkData,
    dataHash,
  });
}
