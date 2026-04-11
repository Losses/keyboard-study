/**
 * Type definitions for the Keyboard Layout Study application.
 */

/**
 * Supported content types for the experiment trials.
 */
export type ContentType = 'Number' | 'Letter' | 'Color';

/**
 * Keyboard layout configurations for testing different arrangements.
 */
export type LayoutType = 'Standard' | 'Reverse' | 'Random';

/**
 * Configuration for generating a trial.
 */
export interface TrialConfig {
  /** The type of content to display */
  content: ContentType;
  /** The keyboard layout arrangement */
  layout: LayoutType;
}

/**
 * A single trial in the experiment sequence.
 */
export interface Trial {
  /** Unique identifier for the trial */
  id: number;
  /** The type of content being tested */
  content: ContentType;
  /** The keyboard layout used */
  layout: LayoutType;
  /** The target sequence the user must input */
  target: string[];
  /** The arranged keyboard keys for this trial */
  layoutKeys: string[];
}

/**
 * Result data for a completed trial.
 */
export interface TrialResult {
  /** Unique participant identifier */
  participantId: string;
  /** Trial identifier */
  trialId: number;
  /** Content type tested */
  content: ContentType;
  /** Keyboard layout used */
  layout: LayoutType;
  /** Target sequence that was presented */
  target: string[];
  /** Time taken to complete the trial (milliseconds) */
  timeMs: number;
  /** Number of backspace presses during the trial */
  backspaceCount: number;
}

/**
 * Detailed log entry for each user action during the experiment.
 */
export interface DetailedLog {
  /** Unique participant identifier */
  participantId: string;
  /** Trial identifier */
  trialId: number;
  /** Timestamp when the action occurred (milliseconds) */
  timestamp: number;
  /** Time interval since the last action (milliseconds) */
  intervalMs: number;
  /** Type of action performed */
  action: 'KeyPress' | 'Backspace';
  /** Input method used (mouse, touch, pen, etc.) */
  inputMethod: string;
  /** Position identifier for the key pressed */
  slotId: string;
  /** The key that was pressed */
  pressedKey: string;
  /** The expected key at that position */
  expectedKey: string;
  /** Status of the action (correct, incorrect, error fix, etc.) */
  status: string;
}

/**
 * Environment and device data collected during the experiment.
 */
export interface EnvironmentData {
  /** Window width in millimeters */
  windowWidthMm?: number;
  /** Window height in millimeters */
  windowHeightMm?: number;
  /** Button width in millimeters */
  buttonWidthMm?: number;
  /** Button height in millimeters */
  buttonHeightMm?: number;
  /** User agent string */
  userAgent?: string;
}

/**
 * Upload status for data synchronization.
 */
export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

/**
 * Application stage states.
 */
export type AppStage = 'setup' | 'running' | 'done';

/**
 * Key position identifiers for the virtual keyboard.
 */
export type SlotPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-isolated'
  | 'backspace'
  | 'unknown';

/**
 * Dictionary definitions for each content type.
 */
export type Dictionaries = Record<ContentType, string[]>;
