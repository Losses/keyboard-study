/**
 * ExperimentScreen component.
 * Displays the main experiment interface with target sequence, current input, and virtual keyboard.
 */

import { THEME_COLORS, TOTAL_TRIALS } from '../constants';
import type { Trial, ContentType } from '../types';
import { VirtualKeyboard } from './VirtualKeyboard';

interface ExperimentScreenProps {
  /** Current trial being executed */
  trial: Trial;
  /** Current trial index (1-based) */
  currentTrialIndex: number;
  /** User's current input sequence */
  currentInput: string[];
  /** Callback when a key is pressed */
  onKeyPress: (event: React.PointerEvent, keyText: string, index: number) => void;
  /** Callback when backspace is pressed */
  onBackspace: (event: React.PointerEvent) => void;
  /** Ref for measuring button dimensions */
  buttonRef: (element: HTMLButtonElement | null) => void;
}

/**
 * Renders the main experiment screen.
 */
export function ExperimentScreen({
  trial,
  currentTrialIndex,
  currentInput,
  onKeyPress,
  onBackspace,
  buttonRef,
}: ExperimentScreenProps) {
  const isErrorState =
    currentInput.length === trial.target.length &&
    !currentInput.every((val, idx) => val === trial.target[idx]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center font-sans p-4"
      style={{ backgroundColor: THEME_COLORS.background, color: THEME_COLORS.textPrimary }}
    >
      {/* Trial counter */}
      <div
        className="w-full max-w-lg mb-8 text-center text-sm font-medium"
        style={{ color: THEME_COLORS.textTertiary }}
      >
        Trial {currentTrialIndex} / {TOTAL_TRIALS}
      </div>

      {/* Target sequence display */}
      <div className="mb-8 flex flex-col items-center">
        <div className="text-sm mb-2" style={{ color: THEME_COLORS.textTertiary }}>
          Target Sequence
        </div>
        <div className="flex gap-2">
          {trial.target.map((target, idx) => (
            <TargetSlot key={idx} value={target} contentType={trial.content} />
          ))}
        </div>
      </div>

      {/* Current input display with backspace button */}
      <div className="mb-8 flex items-center gap-4 w-full max-w-lg justify-center">
        <div className="flex-1 flex gap-2 justify-end min-h-[3rem]">
          {currentInput.map((val, idx) => (
            <InputSlot
              key={idx}
              value={val}
              contentType={trial.content}
              isError={isErrorState}
            />
          ))}
        </div>
        <BackspaceButton onClick={onBackspace} />
      </div>

      {/* Virtual keyboard */}
      <VirtualKeyboard
        layoutKeys={trial.layoutKeys}
        contentType={trial.content}
        onKeyPress={onKeyPress}
        buttonRef={buttonRef}
      />
    </div>
  );
}

/**
 * Displays a single target slot.
 */
interface TargetSlotProps {
  value: string;
  contentType: ContentType;
}

function TargetSlot({ value, contentType }: TargetSlotProps) {
  const isColorMode = contentType === 'Color';
  const backgroundColor = isColorMode ? value : undefined;
  const borderColor = isColorMode && value === '#FFFFFF' ? THEME_COLORS.border : value;

  return (
    <div
      className="px-4 py-2 rounded font-mono text-lg min-w-[3rem] min-h-[3rem] flex items-center justify-center text-center shadow-sm border"
      style={{
        backgroundColor: isColorMode ? backgroundColor : THEME_COLORS.cardBackground,
        borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {isColorMode ? '' : value}
    </div>
  );
}

/**
 * Displays a single input slot.
 */
interface InputSlotProps {
  value: string;
  contentType: ContentType;
  isError: boolean;
}

function InputSlot({ value, contentType, isError }: InputSlotProps) {
  const isColorMode = contentType === 'Color';
  const backgroundColor = isColorMode ? value : isError ? THEME_COLORS.errorBackground : THEME_COLORS.background;
  const borderColor = isColorMode
    ? value === '#FFFFFF'
      ? THEME_COLORS.border
      : value
    : isError
      ? THEME_COLORS.errorBorder
      : THEME_COLORS.primary;

  return (
    <div
      className={`px-4 py-2 rounded font-mono text-lg min-w-[3rem] min-h-[3rem] flex items-center justify-center text-center border shadow-sm`}
      style={{
        backgroundColor,
        borderColor,
        borderWidth: isError ? '4px' : '1px',
        borderStyle: 'solid',
      }}
    >
      {isColorMode ? '' : value}
    </div>
  );
}

/**
 * Backspace button for correcting input.
 */
interface BackspaceButtonProps {
  onClick: (event: React.PointerEvent) => void;
}

function BackspaceButton({ onClick }: BackspaceButtonProps) {
  return (
    <button
      onPointerDown={onClick}
      className="px-4 py-2 h-12 rounded font-medium text-sm transition-colors"
      style={{
        backgroundColor: THEME_COLORS.primary,
        color: THEME_COLORS.textPrimary,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = THEME_COLORS.primaryHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = THEME_COLORS.primary;
      }}
      onPointerDownCapture={(e) => {
        e.currentTarget.style.backgroundColor = THEME_COLORS.primaryActive;
      }}
      onPointerUp={(e) => {
        e.currentTarget.style.backgroundColor = THEME_COLORS.primaryHover;
      }}
    >
      Backspace
    </button>
  );
}
