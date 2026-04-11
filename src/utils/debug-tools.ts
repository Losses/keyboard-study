/**
 * Debug tools for testing and development.
 * Simple global flag-based auto-complete system.
 */

/**
 * Debug state container to hold experiment state for testing
 */
interface DebugState {
  startExperiment?: () => void;
  handleUpload?: () => Promise<void>;
}

const debugState: DebugState = {};

/**
 * Registers the current experiment state for debug access
 */
export function registerDebugState(state: DebugState) {
  Object.assign(debugState, state);
  console.log('[Debug Tools] 🔧 Experiment state registered');
}

/**
 * Checks if the current environment is localhost or development.
 */
function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;
  return hostname === 'localhost' ||
         hostname === '127.0.0.1' ||
         hostname === '' ||
         hostname.startsWith('192.168.') ||
         hostname.startsWith('10.') ||
         hostname.startsWith('172.');
}

/**
 * Checks if debug mode is explicitly enabled via environment variable.
 */
function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for explicit debug flag in URL or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const debugFlag = urlParams.get('debug') || localStorage.getItem('debug');

  return debugFlag === 'true' || debugFlag === '1';
}

/**
 * Sets up global debug functions on the window object.
 * Only enables debug tools in localhost/development environments.
 */
export function setupDebugTools() {
  // Security check: Only enable debug tools in localhost or when explicitly enabled
  if (!isLocalhost() && !isDebugMode()) {
    console.log('[Debug Tools] 🔒 Debug tools disabled in production');
    console.log('[Debug Tools] 💡 To enable in production, add ?debug=true to URL or set localStorage.debug = "true"');
    return;
  }

  const win = window as unknown as {
    autoRun?: () => void;
  };

  // Auto-run: Start and complete the entire experiment automatically
  win.autoRun = () => {
    console.log('[Debug] 🚀 Auto-running experiment...');

    // Start experiment if not started
    if (debugState.startExperiment) {
      debugState.startExperiment();
      console.log('[Debug] ✅ Experiment started');
    } else {
      console.error('[Debug] ❌ Experiment function not available');
      return;
    }

    // Enable auto-completion (React hook will handle the rest)
    (window as unknown as { __autoRun__?: boolean }).__autoRun__ = true;
    console.log('[Debug] ✅ Auto-run enabled. Sit back and relax!');
  };
}
