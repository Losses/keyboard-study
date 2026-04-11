/**
 * API layer for backend communication.
 * Provides high-level functions that accept domain objects and handle serialization.
 */

import type { TrialResult, EnvironmentData, DetailedLog } from '../types';
import { jsonpFetch, type JsonpResponse } from './transport';
import {
  serializeTrialResults,
  serializeEnvironmentData,
  serializeDetailedLogs,
  rowsToJsonString,
} from './serializers';

/**
 * Uploads trial results to the backend.
 *
 * @param results - Array of trial results to upload
 * @returns A promise that resolves when upload is complete
 */
export function uploadTrials(results: TrialResult[]): Promise<JsonpResponse> {
  const rows = serializeTrialResults(results);
  return jsonpFetch({
    action: 'write',
    sheet: 'trials',
    rows: rowsToJsonString(rows),
  });
}

/**
 * Uploads environment and device data to the backend.
 *
 * @param envData - Environment data to upload
 * @param participantId - Participant identifier
 * @returns A promise that resolves when upload is complete
 */
export function uploadDevice(
  envData: EnvironmentData,
  participantId: string
): Promise<JsonpResponse> {
  const rows = serializeEnvironmentData(envData, participantId);
  return jsonpFetch({
    action: 'write',
    sheet: 'device',
    rows: rowsToJsonString(rows),
  });
}

/**
 * Uploads a single chunk of keypress data to the backend.
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
      console.warn(
        `[Chunk ${chunkIndex}] Upload attempt ${attempt + 1}/${retries} failed:`,
        lastError.message
      );

      if (attempt < retries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Chunk ${chunkIndex}] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
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
