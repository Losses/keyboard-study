/**
 * Utility functions for exporting experiment data to CSV files.
 */

import type { TrialResult, DetailedLog, EnvironmentData } from '../types';

/**
 * Triggers a browser download for a CSV file.
 *
 * @param content - The CSV content as a string
 * @param filename - The name for the downloaded file
 */
export function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports all experiment data to three CSV files:
 * - results_main.csv: Main trial results
 * - results_environment.csv: Environment and device data
 * - results_keystrokes.csv: Detailed keystroke logs
 *
 * @param results - Array of trial results
 * @param envData - Environment and device data
 * @param detailedLogs - Array of detailed action logs
 * @param participantId - Unique participant identifier
 */
export function exportAllData(
  results: TrialResult[],
  envData: EnvironmentData,
  detailedLogs: DetailedLog[],
  participantId: string
): void {
  // Export main results
  const mainCsv = formatMainResultsCsv(results);
  triggerDownload(mainCsv, 'results_main.csv');

  // Export environment data (delayed to avoid browser blocking multiple downloads)
  setTimeout(() => {
    const envCsv = formatEnvironmentDataCsv(envData, participantId);
    triggerDownload(envCsv, 'results_environment.csv');
  }, 300);

  // Export keystroke logs
  setTimeout(() => {
    const logsCsv = formatKeystrokeLogsCsv(detailedLogs);
    triggerDownload(logsCsv, 'results_keystrokes.csv');
  }, 600);
}

/**
 * Formats trial results as CSV.
 *
 * @param results - Array of trial results
 * @returns CSV formatted string
 */
function formatMainResultsCsv(results: TrialResult[]): string {
  const headers = [
    'Participant_ID',
    'Trial_ID',
    'Content_Type',
    'Layout_Order',
    'Target_Sequence',
    'Time_ms',
    'Backspace_Count',
  ];

  const rows = results.map((r) => [
    r.participantId,
    r.trialId,
    r.content,
    r.layout,
    r.target.join('-'),
    r.timeMs,
    r.backspaceCount,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Formats environment data as CSV.
 *
 * @param envData - Environment and device data
 * @param participantId - Unique participant identifier
 * @returns CSV formatted string
 */
function formatEnvironmentDataCsv(envData: EnvironmentData, participantId: string): string {
  const headers = [
    'Participant_ID',
    'Window_Width_mm',
    'Window_Height_mm',
    'Button_Width_mm',
    'Button_Height_mm',
    'User_Agent',
  ];

  const row = [
    participantId,
    (envData.windowWidthMm || 0).toFixed(2),
    (envData.windowHeightMm || 0).toFixed(2),
    (envData.buttonWidthMm || 0).toFixed(2),
    (envData.buttonHeightMm || 0).toFixed(2),
    `"${envData.userAgent || ''}"`,
  ];

  return [headers.join(','), row.join(',')].join('\n');
}

/**
 * Formats detailed keystroke logs as CSV.
 *
 * @param detailedLogs - Array of detailed action logs
 * @returns CSV formatted string
 */
function formatKeystrokeLogsCsv(detailedLogs: DetailedLog[]): string {
  const headers = [
    'Participant_ID',
    'Trial_ID',
    'Timestamp_ms',
    'Interval_ms',
    'Action',
    'Input_Method',
    'Slot_ID',
    'Pressed_Key',
    'Expected_Key',
    'Status',
  ];

  const rows = detailedLogs.map((l) => [
    l.participantId,
    l.trialId,
    Math.round(l.timestamp),
    Math.round(l.intervalMs),
    l.action,
    l.inputMethod,
    l.slotId,
    l.pressedKey,
    l.expectedKey,
    l.status,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
