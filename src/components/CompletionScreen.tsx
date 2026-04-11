/**
 * CompletionScreen component.
 * Displays the completion message and data upload options.
 */

import { THEME_COLORS } from '../constants';
import type { TrialResult, DetailedLog, EnvironmentData, UploadStatus } from '../types';

interface CompletionScreenProps {
  /** Array of completed trial results */
  results: TrialResult[];
  /** Environment and device data */
  envData: EnvironmentData;
  /** Detailed action logs */
  detailedLogs: DetailedLog[];
  /** Participant identifier */
  participantId: string;
  /** Current upload status */
  uploadStatus: UploadStatus;
  /** Upload progress percentage (0-100) */
  uploadProgress: number;
  /** Callback to initiate data upload */
  onUpload: () => void;
  /** Callback to export local CSV backup */
  onExport: () => void;
}

/**
 * Renders the completion screen with upload and export options.
 */
export function CompletionScreen({
  results,
  envData,
  detailedLogs,
  participantId,
  uploadStatus,
  uploadProgress,
  onUpload,
  onExport,
}: CompletionScreenProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center font-sans p-4"
      style={{ backgroundColor: THEME_COLORS.background, color: THEME_COLORS.textPrimary }}
    >
      <div
        className="p-8 rounded shadow-sm max-w-md w-full border flex flex-col items-center"
        style={{
          backgroundColor: THEME_COLORS.cardBackground,
          borderColor: THEME_COLORS.border,
        }}
      >
        <h1 className="text-2xl mb-6 font-semibold text-center">Study Complete</h1>
        <p className="mb-6 text-sm text-center">
          Data has been collected for {results.length} trials.
        </p>

        <button
          onClick={onUpload}
          disabled={uploadStatus === 'uploading' || uploadStatus === 'success'}
          className="w-full py-3 mb-4 rounded transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: THEME_COLORS.primary,
            color: THEME_COLORS.textPrimary,
          }}
          onMouseEnter={(e) => {
            if (uploadStatus !== 'uploading' && uploadStatus !== 'success') {
              e.currentTarget.style.backgroundColor = THEME_COLORS.primaryHover;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = THEME_COLORS.primary;
          }}
        >
          Upload Data
        </button>

        {uploadStatus !== 'idle' && (
          <div className="w-full mb-6">
            <div
              className="h-2 w-full rounded overflow-hidden"
              style={{ backgroundColor: THEME_COLORS.primary }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${uploadProgress}%`,
                  backgroundColor: THEME_COLORS.progress,
                }}
              />
            </div>
            <div
              className="text-center text-sm mt-2 font-medium"
              style={{ color: THEME_COLORS.textTertiary }}
            >
              {uploadStatus === 'uploading' && `Uploading... ${Math.round(uploadProgress)}%`}
              {uploadStatus === 'success' && 'Upload Successful'}
              {uploadStatus === 'error' && 'Upload Failed'}
            </div>
          </div>
        )}

        <div className="w-full border-t pt-4 mt-2" style={{ borderColor: THEME_COLORS.border }}>
          <button
            onClick={onExport}
            className="w-full py-2 bg-transparent hover:bg-[#c4e0e8] rounded transition-colors text-sm"
            style={{ color: THEME_COLORS.textTertiary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = THEME_COLORS.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Export Local Backup (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}
