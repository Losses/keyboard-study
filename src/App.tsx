/**
 * Main App component.
 * Orchestrates the keyboard layout study experiment.
 */

import { useEffect } from 'react';
import { useExperiment } from './hooks/useExperiment';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ExperimentScreen } from './components/ExperimentScreen';
import { CompletionScreen } from './components/CompletionScreen';
import { registerDebugState } from './utils/debug-tools';

/**
 * Renders the appropriate screen based on the current experiment stage.
 */
export function App() {
  const experiment = useExperiment();

  // Register experiment state for debug tools
  useEffect(() => {
    registerDebugState({
      startExperiment: experiment.startExperiment,
      handleUpload: experiment.handleUpload,
    });
  }, [experiment]);

  switch (experiment.stage) {
    case 'setup':
      return <WelcomeScreen onStart={experiment.startExperiment} />;

    case 'running':
      return experiment.currentTrial ? (
        <ExperimentScreen
          trial={experiment.currentTrial}
          currentTrialIndex={experiment.currentTrialIndex + 1}
          currentInput={experiment.currentInput}
          onKeyPress={experiment.handleKeyPress}
          onBackspace={experiment.handleBackspace}
          buttonRef={experiment.buttonRef}
        />
      ) : (
        <div>Loading...</div>
      );

    case 'done':
      return (
        <CompletionScreen
          results={experiment.results}
          envData={experiment.envData}
          detailedLogs={experiment.detailedLogs}
          participantId={experiment.participantId}
          uploadStatus={experiment.uploadStatus}
          uploadProgress={experiment.uploadProgress}
          onUpload={experiment.handleUpload}
          onExport={experiment.handleExport}
        />
      );

    default:
      return <div>Unknown stage</div>;
  }
}
