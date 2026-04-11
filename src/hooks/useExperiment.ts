/**
 * Custom hook for managing experiment state and logic.
 * Handles trial generation, user input, timing, and data collection.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  Trial,
  TrialResult,
  DetailedLog,
  EnvironmentData,
  UploadStatus,
  SlotPosition,
} from '../types';
import { generateTrials } from '../utils/trials';
import { pxToMm, getSlotPosition } from '../utils/measurement';
import { exportAllData } from '../utils/export';
import {
  uploadTrialsData,
  uploadDeviceData,
  uploadKeypressChunk,
  finalizeUpload,
  getHashBase64Url,
} from '../utils/api';
import { UPLOAD_CHUNK_SIZE } from '../constants';
import { nanoid } from 'nanoid';

interface UseExperimentReturn {
  /** Current application stage */
  stage: 'setup' | 'running' | 'done';
  /** Unique participant identifier */
  participantId: string;
  /** Array of all trials */
  trials: Trial[];
  /** Current trial index */
  currentTrialIndex: number;
  /** Current trial being executed */
  currentTrial: Trial | null;
  /** User's current input sequence */
  currentInput: string[];
  /** Array of completed trial results */
  results: TrialResult[];
  /** Array of detailed action logs */
  detailedLogs: DetailedLog[];
  /** Environment and device data */
  envData: EnvironmentData;
  /** Upload status */
  uploadStatus: UploadStatus;
  /** Upload progress percentage (0-100) */
  uploadProgress: number;
  /** Reference for measuring button dimensions */
  buttonRef: (element: HTMLButtonElement | null) => void;
  /** Starts the experiment */
  startExperiment: () => void;
  /** Handles key press events */
  handleKeyPress: (event: React.PointerEvent, keyText: string, index: number) => void;
  /** Handles backspace events */
  handleBackspace: (event: React.PointerEvent) => void;
  /** Initiates data upload */
  handleUpload: () => Promise<void>;
  /** Exports data to CSV */
  handleExport: () => void;
}

/**
 * Hook for managing experiment state and logic.
 */
export function useExperiment(): UseExperimentReturn {
  // Participant identifier (persistent across session)
  // Using 10-character nanoid instead of UUID for data compression
  const [participantId] = useState(() => nanoid(10));

  // Application state
  const [stage, setStage] = useState<'setup' | 'running' | 'done'>('setup');
  const [trials, setTrials] = useState<Trial[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState<string[]>([]);
  const [results, setResults] = useState<TrialResult[]>([]);
  const [detailedLogs, setDetailedLogs] = useState<DetailedLog[]>([]);
  const [envData, setEnvData] = useState<EnvironmentData>({});
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [backspaceCount, setBackspaceCount] = useState(0);

  // Timing and refs
  const startTimeRef = useRef(0);
  const lastActionTimeRef = useRef(0);
  const buttonRefCallback = useRef<HTMLButtonElement | null>(null);

  /**
   * Starts the experiment by generating trials and resetting state.
   */
  const startExperiment = useCallback(() => {
    const newTrials = generateTrials();
    setTrials(newTrials);
    setStage('running');
    setCurrentTrialIndex(0);
    setResults([]);
    setDetailedLogs([]);
    setCurrentInput([]);
    setBackspaceCount(0);
    setEnvData({
      windowWidthMm: pxToMm(window.innerWidth),
      windowHeightMm: pxToMm(window.innerHeight),
      userAgent: navigator.userAgent,
    });
    setUploadStatus('idle');
    setUploadProgress(0);

    const now = performance.now();
    startTimeRef.current = now;
    lastActionTimeRef.current = now;
  }, []);

  /**
   * Logs a user action to the detailed logs.
   */
  const logAction = useCallback(
    (
      action: 'KeyPress' | 'Backspace',
      slotId: SlotPosition,
      pressedKey: string,
      expectedKey: string,
      status: string,
      inputMethod: string,
      timestamp: number,
      intervalMs: number
    ) => {
      const activeTrial = trials[currentTrialIndex];
      if (!activeTrial) return;

      setDetailedLogs((prev) => [
        ...prev,
        {
          participantId,
          trialId: activeTrial.id,
          timestamp,
          intervalMs,
          action,
          inputMethod,
          slotId,
          pressedKey,
          expectedKey,
          status,
        },
      ]);
    },
    [trials, currentTrialIndex, participantId]
  );

  /**
   * Handles key press events during the experiment.
   */
  const handleKeyPress = useCallback(
    (event: React.PointerEvent, keyText: string, index: number) => {
      const activeTrial = trials[currentTrialIndex];
      if (!activeTrial || currentInput.length >= activeTrial.target.length) return;

      const now = performance.now();
      const timeSinceLast = now - lastActionTimeRef.current;
      lastActionTimeRef.current = now;

      const expectedKey = activeTrial.target[currentInput.length];
      const isCorrect = keyText === expectedKey;
      const status = isCorrect ? 'Correct' : 'Incorrect';
      const pointerType = (event.nativeEvent as PointerEvent).pointerType || 'unknown';

      logAction(
        'KeyPress',
        getSlotPosition(index),
        keyText,
        expectedKey,
        status,
        pointerType,
        now,
        timeSinceLast
      );

      const newInput = [...currentInput, keyText];
      setCurrentInput(newInput);

      // Check if trial is complete
      if (newInput.length === activeTrial.target.length) {
        const isAllCorrect = newInput.every(
          (val, idx) => val === activeTrial.target[idx]
        );
        if (isAllCorrect) {
          completeTrial(activeTrial, now);
        }
      }
    },
    [trials, currentTrialIndex, currentInput, logAction]
  );

  /**
   * Handles backspace events.
   */
  const handleBackspace = useCallback(
    (event: React.PointerEvent) => {
      if (currentInput.length === 0) return;

      const activeTrial = trials[currentTrialIndex];
      if (!activeTrial) return;

      const now = performance.now();
      const timeSinceLast = now - lastActionTimeRef.current;
      lastActionTimeRef.current = now;

      const lastIndex = currentInput.length - 1;
      const wasLastError = currentInput[lastIndex] !== activeTrial.target[lastIndex];
      const status = wasLastError ? 'Fix_Error' : 'Backspace';
      const expectedKey = activeTrial.target[lastIndex];
      const pointerType = (event.nativeEvent as PointerEvent).pointerType || 'unknown';

      logAction(
        'Backspace',
        'backspace',
        'BACKSPACE',
        expectedKey,
        status,
        pointerType,
        now,
        timeSinceLast
      );

      setCurrentInput(currentInput.slice(0, -1));
      setBackspaceCount((prev) => prev + 1);
    },
    [trials, currentTrialIndex, currentInput, logAction]
  );

  /**
   * Completes the current trial and moves to the next or ends the experiment.
   */
  const completeTrial = useCallback(
    (activeTrial: Trial, endTime: number) => {
      const duration = endTime - startTimeRef.current;

      // Measure button dimensions if not already done
      if (buttonRefCallback.current && !envData.buttonWidthMm) {
        setEnvData((prev) => ({
          ...prev,
          buttonWidthMm: pxToMm(buttonRefCallback.current!.offsetWidth),
          buttonHeightMm: pxToMm(buttonRefCallback.current!.offsetHeight),
        }));
      }

      const trialResult: TrialResult = {
        participantId,
        trialId: activeTrial.id,
        content: activeTrial.content,
        layout: activeTrial.layout,
        target: activeTrial.target,
        timeMs: Math.round(duration),
        backspaceCount,
      };

      setResults((prev) => [...prev, trialResult]);

      // Move to next trial or end experiment
      if (currentTrialIndex + 1 < trials.length) {
        setCurrentTrialIndex((prev) => prev + 1);
        setCurrentInput([]);
        setBackspaceCount(0);
        const now = performance.now();
        startTimeRef.current = now;
        lastActionTimeRef.current = now;
      } else {
        setStage('done');
      }
    },
    [
      participantId,
      currentTrialIndex,
      trials.length,
      backspaceCount,
      envData.buttonWidthMm,
    ]
  );

  /**
   * Handles data upload to Google Sheets.
   */
  const handleUpload = useCallback(async () => {
    if (uploadStatus === 'uploading') return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // Prepare data arrays
      const rowsTrials = results.map((r) => [
        r.participantId,
        r.trialId,
        r.content,
        r.layout,
        r.target.join('-'),
        r.timeMs,
        r.backspaceCount,
      ]);

      const rowsDevice = [
        [
          participantId,
          (envData.windowWidthMm || 0).toFixed(2),
          (envData.windowHeightMm || 0).toFixed(2),
          (envData.buttonWidthMm || 0).toFixed(2),
          (envData.buttonHeightMm || 0).toFixed(2),
          `"${envData.userAgent || ''}"`,
        ],
      ];

      const rowsKeypresses = detailedLogs.map((l) => [
        l.participantId,
        l.trialId,
        Math.round(l.timestamp),
        Math.round(l.intervalMs),
        l.action,
        l.inputMethod,
        l.slotId,
        l.pressedKey,
        l.expectedKey,
        l.status,
      ]);

      // Calculate total requests
      const strKeypresses = JSON.stringify(rowsKeypresses);
      const chunks: string[] = [];
      for (let i = 0; i < strKeypresses.length; i += UPLOAD_CHUNK_SIZE) {
        chunks.push(strKeypresses.slice(i, i + UPLOAD_CHUNK_SIZE));
      }

      const totalReqs = 2 + chunks.length;
      let completed = 0;

      const incrementProgress = () => {
        completed++;
        setUploadProgress((completed / totalReqs) * 100);
      };

      // Prepare session data for keypress chunks
      const sessionId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const dataHash = await getHashBase64Url(strKeypresses);
      const encoder = new TextEncoder();

      console.log('[Upload] Session ID:', sessionId);
      console.log('[Upload] Total chunks:', chunks.length);
      console.log('[Upload] Data hash:', dataHash);
      console.log('[Upload] Keypress data size:', strKeypresses.length, 'chars');

      // Upload trials and device first, then upload chunks in batches
      console.log('[Upload] Starting trials and device upload...');
      await Promise.all([
        uploadTrialsData(rowsTrials, 'trials').then(incrementProgress),
        uploadDeviceData(rowsDevice).then(incrementProgress),
      ]);

      // Upload chunks in batches to avoid overwhelming the network
      console.log('[Upload] Starting chunk upload in batches...');
      const BATCH_SIZE = 8;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
        console.log(`[Upload] Uploading batch ${batchNumber}/${totalBatches}`);

        // Create upload promises for this batch only
        const batchPromises = batchChunks.map((chunk, batchIndex) => {
          const chunkIndex = i + batchIndex;
          const chunkBytes = encoder.encode(chunk);
          const chunkData = btoa(
            Array.from(chunkBytes, (x) => String.fromCharCode(x)).join('')
          );
          return uploadKeypressChunk(chunkData, sessionId, chunks.length, chunkIndex, dataHash)
            .then(incrementProgress);
        });

        await Promise.all(batchPromises);
      }

      // All chunks uploaded successfully, now trigger finalization
      console.log('[Upload] All chunks uploaded, triggering finalize...');
      const finalizeResult = await finalizeUpload(sessionId);
      console.log('[Upload] Finalize result:', finalizeResult);

      setUploadStatus('success');
    } catch (error) {
      console.error('[Upload] Error during upload:', error);
      console.error('[Upload] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        resultsCount: results.length,
        detailedLogsCount: detailedLogs.length,
        participantId,
      });
      setUploadStatus('error');
    }
  }, [
    uploadStatus,
    results,
    envData,
    detailedLogs,
    participantId,
    UPLOAD_CHUNK_SIZE,
  ]);

  /**
   * Handles data export to CSV files.
   */
  const handleExport = useCallback(() => {
    exportAllData(results, envData, detailedLogs, participantId);
  }, [results, envData, detailedLogs, participantId]);

  /**
   * Ref callback for the button element.
   */
  const buttonRef = useCallback((element: HTMLButtonElement | null) => {
    buttonRefCallback.current = element;
  }, []);

  const currentTrial = trials[currentTrialIndex] || null;

  /**
   * Auto-run feature for debugging.
   * Monitors global window.__autoRun__ flag and:
   * - Starts experiment if in setup stage
   * - Auto-completes trials with simulated input
   */
  useEffect(() => {
    const win = window as unknown as { __autoRun__?: boolean };

    if (!win.__autoRun__) return;

    // Start experiment if in setup stage
    if (stage === 'setup') {
      console.log('[Auto-Run] 🚀 Starting experiment...');
      startExperiment();
      return; // Let the next effect handle auto-completion
    }

    // Auto-complete trials if running
    if (stage === 'running' && currentTrial) {
      console.log('[Auto-Run] ⚡ Auto-completing trial', currentTrialIndex + 1);

      const targetKeys = currentTrial.target;
      let currentIndex = currentInput.length;
      let timeoutIds: NodeJS.Timeout[] = [];

      const pressNextKey = () => {
        if (currentIndex >= targetKeys.length) {
          console.log('[Auto-Run] ✅ Trial', currentTrialIndex + 1, 'completed');
          // Don't reset flag here - let it continue to next trial
          return;
        }

        const targetKey = targetKeys[currentIndex];
        // Find the key in layoutKeys
        const keyIndex = currentTrial.layoutKeys.indexOf(targetKey);

        if (keyIndex === -1) {
          console.error('[Auto-Run] ❌ Key not found in layout:', targetKey);
          win.__autoRun__ = false;
          return;
        }

        // Simulate key press
        const mockEvent = {
          nativeEvent: { pointerType: 'mouse' },
        } as React.PointerEvent;

        handleKeyPress(mockEvent, targetKey, keyIndex);
        currentIndex++;

        // Schedule next key press with random delay (100-300ms)
        const delay = Math.random() * 200 + 100;
        const timeoutId = setTimeout(pressNextKey, delay);
        timeoutIds.push(timeoutId);
      };

      // Start pressing keys
      if (currentIndex < targetKeys.length) {
        const initialDelay = Math.random() * 200 + 100;
        const timeoutId = setTimeout(pressNextKey, initialDelay);
        timeoutIds.push(timeoutId);
      }

      return () => {
        // Cleanup: clear all pending timeouts
        timeoutIds.forEach((id) => clearTimeout(id));
      };
    }

    // Stop auto-run when experiment is done
    if (stage === 'done') {
      console.log('[Auto-Run] 🎉 All trials completed! Click Upload to finish.');
      win.__autoRun__ = false;
    }
  }, [stage, currentTrial, currentTrialIndex, currentInput, handleKeyPress, startExperiment]);

  return {
    stage,
    participantId,
    trials,
    currentTrialIndex,
    currentTrial,
    currentInput,
    results,
    detailedLogs,
    envData,
    uploadStatus,
    uploadProgress,
    buttonRef,
    startExperiment,
    handleKeyPress,
    handleBackspace,
    handleUpload,
    handleExport,
  };
}
