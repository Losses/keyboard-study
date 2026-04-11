/**
 * Transport layer for network communication.
 * Handles low-level JSONP requests for cross-domain communication.
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
 * Callback ID generator for JSONP requests.
 * Uses base-36 encoding for compact representation.
 */
let callbackCounter = 0;

function generateCallbackId(): string {
  const id = callbackCounter.toString(36);
  callbackCounter++;
  return `cb_${id}`;
}

/**
 * Performs a JSONP (JSON with Padding) request.
 * JSONP bypasses CORS restrictions when communicating with Google Apps Script.
 *
 * @param params - Query parameters to send with the request
 * @returns A promise that resolves with the response data
 * @throws Error if the network request fails
 */
export function jsonpFetch(params: JsonpParams): Promise<JsonpResponse> {
  return new Promise<JsonpResponse>((resolve, reject) => {
    const cbName = generateCallbackId();

    // Define the callback function globally
    (window as unknown as { [key: string]: (data: JsonpResponse) => void })[cbName] = (
      data: JsonpResponse
    ) => {
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
