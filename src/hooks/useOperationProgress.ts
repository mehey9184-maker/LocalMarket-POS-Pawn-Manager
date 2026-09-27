/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef } from 'react';

export type StepStatus = 'pending' | 'active' | 'complete' | 'error';

export interface OperationStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface OperationProgressConfig {
  title: string;
  subtitle?: string;
  steps: Array<{ id: string; label: string; detail?: string }>;
  isOffline?: boolean;
  offlineNotice?: string;
  onRetry?: () => void | Promise<void>;
  onClose?: () => void;
}

export interface OperationProgressState {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  steps: OperationStep[];
  status: 'idle' | 'in_progress' | 'success' | 'error';
  successTitle?: string;
  successMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
  isOffline?: boolean;
  offlineNotice?: string;
  onRetry?: () => void | Promise<void>;
  onClose?: () => void;
}

export interface StepRunner {
  startStep: (id: string, update?: { label?: string; detail?: string }) => void;
  completeStep: (id: string, update?: { label?: string; detail?: string }) => void;
  failStep: (id: string, errorDetail?: string) => void;
  updateStepDetail: (id: string, detail: string) => void;
  isCancelled: () => boolean;
}

export function useOperationProgress() {
  const [state, setState] = useState<OperationProgressState>({
    isOpen: false,
    title: '',
    steps: [],
    status: 'idle',
  });

  const activeOpRef = useRef<{
    cancelled: boolean;
    onRetry?: () => void | Promise<void>;
    onClose?: () => void;
  }>({ cancelled: false });

  const startOperation = useCallback((config: OperationProgressConfig) => {
    activeOpRef.current = {
      cancelled: false,
      onRetry: config.onRetry,
      onClose: config.onClose,
    };

    const initialSteps: OperationStep[] = config.steps.map((s, idx) => ({
      id: s.id,
      label: s.label,
      detail: s.detail,
      status: idx === 0 ? 'active' : 'pending',
    }));

    setState({
      isOpen: true,
      title: config.title,
      subtitle: config.subtitle || "We're taking care of your changes.",
      steps: initialSteps,
      status: 'in_progress',
      isOffline: config.isOffline,
      offlineNotice: config.offlineNotice,
      onRetry: config.onRetry,
      onClose: config.onClose,
    });
  }, []);

  const setStepActive = useCallback((stepId: string, update?: { label?: string; detail?: string }) => {
    setState(prev => {
      if (!prev.isOpen) return prev;
      return {
        ...prev,
        steps: prev.steps.map(s => {
          if (s.id === stepId) {
            return {
              ...s,
              status: 'active',
              label: update?.label ?? s.label,
              detail: update?.detail ?? s.detail,
            };
          }
          return s;
        }),
      };
    });
  }, []);

  const setStepComplete = useCallback((stepId: string, update?: { label?: string; detail?: string }) => {
    setState(prev => {
      if (!prev.isOpen) return prev;
      return {
        ...prev,
        steps: prev.steps.map(s => {
          if (s.id === stepId) {
            return {
              ...s,
              status: 'complete',
              label: update?.label ?? s.label,
              detail: update?.detail ?? s.detail,
            };
          }
          return s;
        }),
      };
    });
  }, []);

  const setStepError = useCallback((stepId: string, errorDetail?: string) => {
    setState(prev => {
      if (!prev.isOpen) return prev;
      return {
        ...prev,
        steps: prev.steps.map(s => {
          if (s.id === stepId) {
            return {
              ...s,
              status: 'error',
              detail: errorDetail ?? s.detail,
            };
          }
          return s;
        }),
      };
    });
  }, []);

  const updateStepDetail = useCallback((stepId: string, detail: string) => {
    setState(prev => {
      if (!prev.isOpen) return prev;
      return {
        ...prev,
        steps: prev.steps.map(s => (s.id === stepId ? { ...s, detail } : s)),
      };
    });
  }, []);

  const completeOperation = useCallback(
    async (options?: {
      title?: string;
      message?: string;
      holdDurationMs?: number;
      onDone?: () => void;
    }) => {
      setState(prev => ({
        ...prev,
        status: 'success',
        steps: prev.steps.map(s => (s.status === 'active' ? { ...s, status: 'complete' } : s)),
        successTitle: options?.title || 'Changes Saved',
        successMessage: options?.message || 'Your updates were saved successfully.',
      }));

      const holdDuration = options?.holdDurationMs ?? 950;
      await new Promise(res => setTimeout(res, holdDuration));

      if (!activeOpRef.current.cancelled) {
        setState(prev => ({ ...prev, isOpen: false, status: 'idle' }));
        if (options?.onDone) {
          options.onDone();
        } else if (activeOpRef.current.onClose) {
          activeOpRef.current.onClose();
        }
      }
    },
    []
  );

  const failOperation = useCallback(
    (options: {
      title?: string;
      message: string;
      onRetry?: () => void | Promise<void>;
    }) => {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorTitle: options.title || "We couldn't finish saving",
        errorMessage: options.message,
        onRetry: options.onRetry || prev.onRetry,
      }));
    },
    []
  );

  const close = useCallback(() => {
    activeOpRef.current.cancelled = true;
    setState(prev => ({ ...prev, isOpen: false, status: 'idle' }));
  }, []);

  const runSequence = useCallback(
    async <T,>(config: {
      title: string;
      subtitle?: string;
      steps: Array<{ id: string; label: string; detail?: string }>;
      isOffline?: boolean;
      offlineNotice?: string;
      execute: (runner: StepRunner) => Promise<T>;
      successTitle?: string | ((result: T) => string);
      successMessage?: string | ((result: T) => string);
      holdDurationMs?: number;
      onSuccess?: (result: T) => void | Promise<void>;
      onError?: (error: any) => void;
      onClose?: () => void;
    }): Promise<T | null> => {
      let isCancelled = false;

      const executeWrapper = async (): Promise<T | null> => {
        startOperation({
          title: config.title,
          subtitle: config.subtitle,
          steps: config.steps,
          isOffline: config.isOffline,
          offlineNotice: config.offlineNotice,
          onRetry: () => {
            executeWrapper();
          },
          onClose: () => {
            isCancelled = true;
            close();
            if (config.onClose) config.onClose();
          },
        });

        const runner: StepRunner = {
          startStep: (id, update) => {
            setStepActive(id, update);
          },
          completeStep: (id, update) => {
            setStepComplete(id, update);
          },
          failStep: (id, detail) => {
            setStepError(id, detail);
          },
          updateStepDetail: (id, detail) => {
            updateStepDetail(id, detail);
          },
          isCancelled: () => isCancelled || activeOpRef.current.cancelled,
        };

        try {
          const result = await config.execute(runner);
          if (isCancelled || activeOpRef.current.cancelled) return null;

          const sTitle =
            typeof config.successTitle === 'function'
              ? config.successTitle(result)
              : config.successTitle;
          const sMsg =
            typeof config.successMessage === 'function'
              ? config.successMessage(result)
              : config.successMessage;

          await completeOperation({
            title: sTitle,
            message: sMsg,
            holdDurationMs: config.holdDurationMs ?? 950,
            onDone: async () => {
              if (config.onSuccess) {
                await config.onSuccess(result);
              }
              if (config.onClose) {
                config.onClose();
              }
            },
          });

          return result;
        } catch (err: any) {
          console.error('Operation failed in progress sequence:', err);
          const errorMsg = err?.message || 'An unexpected error occurred while saving your changes.';
          failOperation({
            title: "We couldn't finish saving",
            message: errorMsg,
            onRetry: async () => {
              await executeWrapper();
            },
          });
          if (config.onError) {
            config.onError(err);
          }
          return null;
        }
      };

      return executeWrapper();
    },
    [startOperation, setStepActive, setStepComplete, setStepError, updateStepDetail, completeOperation, failOperation, close]
  );

  return {
    state,
    startOperation,
    setStepActive,
    setStepComplete,
    setStepError,
    updateStepDetail,
    completeOperation,
    failOperation,
    close,
    runSequence,
  };
}
