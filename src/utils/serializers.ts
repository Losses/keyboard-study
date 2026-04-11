/**
 * Data serialization layer.
 * Converts domain objects to API-compatible formats.
 */

import type { TrialResult, EnvironmentData, DetailedLog } from "../types";

/**
 * Serializes a single trial result to API row format.
 * @internal
 */
function serializeTrialResultRow(result: TrialResult): unknown[] {
  return [
    result.participantId,
    result.trialId,
    result.content,
    result.layout,
    result.target.join("-"),
    result.timeMs,
    result.backspaceCount,
  ];
}

/**
 * Serializes trial results to API format.
 *
 * @param results - Array of trial results
 * @returns Array of rows ready for API transmission
 */
export function serializeTrialResults(results: TrialResult[]): unknown[][] {
  return results.map(serializeTrialResultRow);
}

/**
 * Serializes environment and device data to API format.
 *
 * @param envData - Environment data
 * @param participantId - Participant identifier
 * @returns Array of rows ready for API transmission
 */
export function serializeEnvironmentData(
  envData: EnvironmentData,
  participantId: string,
): unknown[][] {
  return [
    [
      participantId,
      (envData.windowWidthMm || 0).toFixed(2),
      (envData.windowHeightMm || 0).toFixed(2),
      (envData.buttonWidthMm || 0).toFixed(2),
      (envData.buttonHeightMm || 0).toFixed(2),
      `"${envData.userAgent || ""}"`,
    ],
  ];
}

/**
 * Serializes a single detailed log entry to API row format.
 * @internal
 */
function serializeDetailedLogRow(log: DetailedLog): unknown[] {
  return [
    log.participantId,
    log.trialId,
    Math.round(log.timestamp),
    Math.round(log.intervalMs),
    log.action,
    log.inputMethod,
    log.slotId,
    log.pressedKey,
    log.expectedKey,
    log.status,
  ];
}

/**
 * Serializes detailed log entries to API format.
 *
 * @param logs - Array of detailed log entries
 * @returns Array of rows ready for API transmission
 */
export function serializeDetailedLogs(logs: DetailedLog[]): unknown[][] {
  return logs.map(serializeDetailedLogRow);
}

export class SearchableMap {
  private index = 0;

  private value = new Map<string, number>();

  push = (x: string) => {
    this.value.set(x, this.index);

    this.index = this.index + 1;
  };

  get length() {
    return this.index;
  }

  indexOf = (x: string) => {
    const result = this.value.get(x);

    if (result === undefined) {
      return -1;
    }

    return result;
  };

  dump = () => {
    return [...this.value.keys()];
  };
}

export const stringify = (x: unknown) => {
  const head = new SearchableMap();

  const getIndex = (x: string) => {
    const index = head.indexOf(x);

    if (index >= 0) {
      return index;
    }

    head.push(x);
    return head.length - 1;
  };

  const sBody = JSON.stringify(x, (_, value) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (value !== null && typeof value === "object") {
      const result: Record<string, unknown> = {};

      const keys = Object.keys(value);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        result[getIndex(key)] = value[key];
      }

      return result;
    }

    return getIndex(value);
  });

  const sHead = JSON.stringify(head.dump());

  return `${sBody}\n${sHead}`;
};

/**
 * Converts serialized rows to JSON string.
 * Used for chunking large datasets.
 *
 * @param rows - Serialized rows
 * @returns JSON string representation
 */
export function rowsToJsonString(rows: unknown[][]): string {
  return stringify(rows);
}

/**
 * Splits a string into chunks of specified size.
 *
 * @param str - String to chunk
 * @param chunkSize - Maximum size of each chunk
 * @returns Array of string chunks
 */
export function chunkString(str: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Encodes a string chunk to base64.
 *
 * @param chunk - String chunk to encode
 * @returns Base64 encoded string
 */
export function encodeChunkToBase64(chunk: string): string {
  const encoder = new TextEncoder();
  const chunkBytes = encoder.encode(chunk);
  return btoa(Array.from(chunkBytes, (x) => String.fromCharCode(x)).join(""));
}
