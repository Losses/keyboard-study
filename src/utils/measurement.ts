/**
 * Utility functions for measurements and position identification.
 */

import type { SlotPosition } from '../types';
import { KEYBOARD_POSITIONS } from '../constants';

/**
 * Converts pixels to millimeters.
 * Uses the standard assumption of 96 DPI (dots per inch).
 *
 * @param px - Value in pixels
 * @returns Equivalent value in millimeters
 */
export function pxToMm(px: number): number {
  return (px * 25.4) / 96;
}

/**
 * Gets the position identifier for a keyboard slot index.
 * Maps a 0-9 index to a descriptive position name.
 *
 * @param idx - The slot index (0-9)
 * @returns The position identifier
 */
export function getSlotPosition(idx: number): SlotPosition {
  if (idx >= 0 && idx < KEYBOARD_POSITIONS.length) {
    return KEYBOARD_POSITIONS[idx] as SlotPosition;
  }
  return 'unknown';
}
