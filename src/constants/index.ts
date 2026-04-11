/**
 * Constants and configuration for the Keyboard Layout Study application.
 */

import type { Dictionaries, ContentType, LayoutType } from '../types';

/**
 * Google Apps Script configuration for data upload.
 * This ID points to the deployed web app that handles data submission.
 */
export const GOOGLE_APPS_SCRIPT_ID = 'AKfycbwJCxfeaEzixLFiMU33eFooZRq4yoqTx6eFPkKggsq1Yt6q7FceOoF-MMhS-3SUT42Taw';

/**
 * Base URL for the Google Apps Script execution endpoint.
 */
export const GOOGLE_APPS_SCRIPT_URL = `https://script.google.com/macros/s/${GOOGLE_APPS_SCRIPT_ID}/exec`;

/**
 * Content dictionaries containing the values for each test type.
 * - Number: Digits 0-9
 * - Letter: Letters A-J
 * - Color: CSS color hex codes for color recognition tests
 */
export const DICTIONARIES: Dictionaries = {
  Number: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  Letter: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  Color: [
    '#FF0000', // Red
    '#FFA500', // Orange
    '#FFFF00', // Yellow
    '#008000', // Green
    '#00FFFF', // Cyan
    '#0000FF', // Blue
    '#800080', // Purple
    '#000000', // Black
    '#FFFFFF', // White
    '#808080', // Gray
  ],
};

/**
 * Available content types for the experiment.
 */
export const CONTENT_TYPES: ContentType[] = ['Number', 'Letter', 'Color'];

/**
 * Available keyboard layout configurations.
 */
export const LAYOUT_TYPES: LayoutType[] = ['Standard', 'Reverse', 'Random'];

/**
 * Total number of trials in a complete experiment session.
 * Each content type × each layout type × 2 repetitions + 2 random trials = 20 trials.
 */
export const TOTAL_TRIALS = 20;

/**
 * Length of the target sequence for each trial.
 */
export const TARGET_SEQUENCE_LENGTH = 5;

/**
 * Chunk size for splitting large keypress data during upload.
 */
export const UPLOAD_CHUNK_SIZE = 200;

/**
 * CSS color constants for the application theme.
 * Based on the soft blue/teal color scheme used in the experiment.
 */
export const THEME_COLORS = {
  background: '#ebf4f6',
  cardBackground: '#deedf1',
  primary: '#c4e0e8',
  primaryHover: '#add3dd',
  primaryActive: '#92bfcc',
  textPrimary: '#203038',
  textSecondary: '#405a63',
  textTertiary: '#5c7a85',
  border: '#c4e0e8',
  errorBorder: '#d4a39b',
  errorBackground: '#f5e3e0',
  progress: '#6b96a3',
} as const;

/**
 * Position names for keyboard slots.
 */
export const KEYBOARD_POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'bottom-isolated',
] as const;

/**
 * Reverse layout key indices.
 * Maps the standard position to the reversed position.
 */
export const REVERSE_LAYOUT_INDICES = [6, 7, 8, 3, 4, 5, 0, 1, 2, 9] as const;
