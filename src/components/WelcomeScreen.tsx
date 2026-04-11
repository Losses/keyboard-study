/**
 * WelcomeScreen component.
 * Displays the introduction and instructions for the experiment.
 */

import { THEME_COLORS, TOTAL_TRIALS } from '../constants';

interface WelcomeScreenProps {
  /** Callback when user starts the experiment */
  onStart: () => void;
}

/**
 * Renders the welcome screen with experiment instructions.
 */
export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center font-sans p-4"
      style={{ backgroundColor: THEME_COLORS.background, color: THEME_COLORS.textPrimary }}
    >
      <div
        className="p-8 rounded shadow-sm max-w-md w-full border"
        style={{
          backgroundColor: THEME_COLORS.cardBackground,
          borderColor: THEME_COLORS.border,
        }}
      >
        <h1 className="text-2xl mb-6 font-semibold">Welcome</h1>

        <div
          className="mb-8 text-sm space-y-3"
          style={{ color: THEME_COLORS.textSecondary }}
        >
          <p>This is the Keyboard Layout Study.</p>
          <p>
            You will complete {TOTAL_TRIALS} sequential tasks. In each task, a target sequence of 5
            items is provided.
          </p>
          <p>
            Please enter the exact sequence using the on-screen grid keyboard. If an
            incorrect entry is made, use the Backspace button to correct it.
          </p>
        </div>

        <button
          onClick={onStart}
          className="w-full py-3 rounded transition-colors text-sm font-medium"
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
        >
          Start Experiment
        </button>
      </div>
    </div>
  );
}
