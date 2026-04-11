/**
 * Utility functions for generating and managing experiment trials.
 */

import type { Trial, TrialConfig, ContentType, LayoutType } from '../types';
import { DICTIONARIES, CONTENT_TYPES, LAYOUT_TYPES, TARGET_SEQUENCE_LENGTH, REVERSE_LAYOUT_INDICES } from '../constants';

/**
 * Generates a complete set of trials for the experiment.
 * Creates combinations of all content types and layouts, duplicates them,
 * and adds two random trials for a total of 20 trials.
 *
 * @returns An array of randomized trial configurations
 */
export function generateTrials(): Trial[] {
  // Generate all content × layout combinations
  const combinations: TrialConfig[] = [];
  for (const content of CONTENT_TYPES) {
    for (const layout of LAYOUT_TYPES) {
      combinations.push({ content, layout });
    }
  }

  // Duplicate all combinations and add 2 random trials
  let pool = [...combinations, ...combinations];
  pool.push(combinations[Math.floor(Math.random() * combinations.length)]);
  pool.push(combinations[Math.floor(Math.random() * combinations.length)]);

  // Shuffle the pool
  pool = shuffleArray(pool);

  // Convert combinations to full trials with layout keys and targets
  return pool.map((config, index) => createTrial(config, index + 1));
}

/**
 * Creates a single trial from a configuration.
 *
 * @param config - The trial configuration containing content type and layout
 * @param id - Unique identifier for the trial
 * @returns A complete trial with layout keys and target sequence
 */
function createTrial(config: TrialConfig, id: number): Trial {
  const keys = DICTIONARIES[config.content];
  const layoutKeys = getLayoutKeys(keys, config.layout);
  const target = generateTargetSequence(keys);

  return {
    id,
    content: config.content,
    layout: config.layout,
    target,
    layoutKeys,
  };
}

/**
 * Gets the keyboard layout based on the specified layout type.
 *
 * @param keys - The original key array
 * @param layout - The layout type to apply
 * @returns The arranged key array for the layout
 */
function getLayoutKeys(keys: string[], layout: LayoutType): string[] {
  switch (layout) {
    case 'Standard':
      return [...keys];

    case 'Reverse':
      // Rearrange keys: positions 6,7,8,3,4,5,0,1,2,9
      return REVERSE_LAYOUT_INDICES.map((idx) => keys[idx]);

    case 'Random':
      return shuffleArray([...keys]);

    default:
      return [...keys];
  }
}

/**
 * Generates a random target sequence from the available keys.
 *
 * @param keys - Array of available keys
 * @returns A random sequence of 5 keys
 */
function generateTargetSequence(keys: string[]): string[] {
  const target: string[] = [];
  for (let i = 0; i < TARGET_SEQUENCE_LENGTH; i++) {
    target.push(keys[Math.floor(Math.random() * keys.length)]);
  }
  return target;
}

/**
 * Shuffles an array using the Fisher-Yates algorithm.
 *
 * @param array - The array to shuffle
 * @returns A new shuffled array
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
