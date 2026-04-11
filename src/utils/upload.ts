/**
 * Upload orchestration service.
 * Coordinates the complete upload workflow including chunking, batching, and progress tracking.
 */

import type { TrialResult, EnvironmentData, DetailedLog } from '../types';
import { UPLOAD_CHUNK_SIZE } from '../constants';
import { uploadTrials, uploadDevice, uploadKeypressChunk, finalizeUpload } from './api';
import {
  serializeDetailedLogs,
  rowsToJsonString,
  chunkString,
  encodeChunkToBase64,
} from './serializers';
import { hashData } from './crypto';

/**
 * Progress callback type for upload operations.
 */
export type UploadProgressCallback = (progress: number) => void;

/**
 * Configuration for upload operations.
 */
export interface UploadConfig {
  /** Size of each chunk in characters */
  chunkSize?: number;
  /** Number of concurrent chunks to upload */
  batchSize?: number;
  /** Optional progress callback */
  onProgress?: UploadProgressCallback;
}

/**
 * Uploads all experiment data to the backend.
 * Handles data preparation, chunking, batching, and progress tracking.
 *
 * @param results - Trial results to upload
 * @param envData - Environment data to upload
 * @param detailedLogs - Detailed keypress logs to upload
 * @param participantId - Participant identifier
 * @param config - Optional upload configuration
 * @returns A promise that resolves when all uploads are complete
 */
export async function uploadExperimentData(
  results: TrialResult[],
  envData: EnvironmentData,
  detailedLogs: DetailedLog[],
  participantId: string,
  config: UploadConfig = {}
): Promise<void> {
  const {
    chunkSize = UPLOAD_CHUNK_SIZE,
    batchSize = 8,
    onProgress,
  } = config;

  // Serialize keypress data
  const rowsKeypresses = serializeDetailedLogs(detailedLogs);
  const strKeypresses = rowsToJsonString(rowsKeypresses);

  // Calculate total requests for progress tracking
  const chunks = chunkString(strKeypresses, chunkSize);
  const totalReqs = 2 + chunks.length; // trials + device + all chunks
  let completed = 0;

  const incrementProgress = () => {
    completed++;
    const progress = (completed / totalReqs) * 100;
    onProgress?.(progress);
  };

  // Prepare session data for keypress chunks
  const sessionId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dataHash = await hashData(strKeypresses);

  console.log('[Upload] Session ID:', sessionId);
  console.log('[Upload] Total chunks:', chunks.length);
  console.log('[Upload] Data hash:', dataHash);
  console.log('[Upload] Keypress data size:', strKeypresses.length, 'chars');

  // Upload trials and device data first
  console.log('[Upload] Starting trials and device upload...');
  await Promise.all([
    uploadTrials(results).then(incrementProgress),
    uploadDevice(envData, participantId).then(incrementProgress),
  ]);

  // Upload keypress chunks in batches
  console.log('[Upload] Starting chunk upload in batches...');
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(chunks.length / batchSize);
    console.log(`[Upload] Uploading batch ${batchNumber}/${totalBatches}`);

    // Create upload promises for this batch
    const batchPromises = batchChunks.map((chunk, batchIndex) => {
      const chunkIndex = i + batchIndex;
      const chunkData = encodeChunkToBase64(chunk);
      return uploadKeypressChunk(chunkData, sessionId, chunks.length, chunkIndex, dataHash).then(
        incrementProgress
      );
    });

    await Promise.all(batchPromises);
  }

  // All chunks uploaded successfully, now trigger finalization
  console.log('[Upload] All chunks uploaded, triggering finalize...');
  const finalizeResult = await finalizeUpload(sessionId);
  console.log('[Upload] Finalize result:', finalizeResult);
}
