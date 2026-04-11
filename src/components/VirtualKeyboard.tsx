/**
 * VirtualKeyboard component.
 * Displays an interactive 3x3 grid keyboard with an isolated zero key.
 */

import { THEME_COLORS } from '../constants';
import type { ContentType } from '../types';

interface VirtualKeyboardProps {
  /** Array of key labels to display */
  layoutKeys: string[];
  /** Content type being tested */
  contentType: ContentType;
  /** Callback when a key is pressed */
  onKeyPress: (event: React.PointerEvent, keyText: string, index: number) => void;
  /** Ref for the first button (used for measurement) */
  buttonRef: (element: HTMLButtonElement | null) => void;
}

/**
 * Renders the virtual keyboard grid.
 */
export function VirtualKeyboard({
  layoutKeys,
  contentType,
  onKeyPress,
  buttonRef,
}: VirtualKeyboardProps) {
  return (
    <div
      className="grid grid-cols-3 gap-2 p-4 rounded shadow-sm border w-full max-w-xs"
      style={{
        backgroundColor: THEME_COLORS.cardBackground,
        borderColor: THEME_COLORS.border,
      }}
    >
      {layoutKeys.map((keyText, idx) => {
        const isZeroPosition = idx === 9;
        const isColorMode = contentType === 'Color';

        return (
          <button
            key={idx}
            ref={idx === 0 ? buttonRef : null}
            onPointerDown={(e) => onKeyPress(e, keyText, idx)}
            className={`h-16 bg-[#ebf4f6] border border-[#c4e0e8] rounded text-lg font-mono transition-opacity shadow-sm ${
              isZeroPosition ? 'col-start-2' : ''
            } ${
              isColorMode ? 'hover:opacity-80 active:opacity-60' : 'hover:bg-[#d4e9ee] active:bg-[#b0d4de]'
            }`}
            style={isColorMode ? { backgroundColor: keyText, borderColor: keyText === '#FFFFFF' ? '#c4e0e8' : keyText } : {}}
          >
            {isColorMode ? '' : keyText}
          </button>
        );
      })}
    </div>
  );
}
