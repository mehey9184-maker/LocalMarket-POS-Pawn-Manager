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

export function humanizeErrorMessage(err: any): string {
  if (!err) return "We couldn't finish this operation. Please try again.";
  const message = typeof err === 'string' ? err : err.message || String(err);
  const lower = message.toLowerCase();

  // Network / fetch issues
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network error') ||
    lower.includes('net::') ||
    lower.includes('offline') ||
    lower.includes('connection refused') ||
    lower.includes('timeout')
  ) {
    return 'Your connection was interrupted. The change was not confirmed.';
  }

  // Auth / session expiration
  if (
    lower.includes('jwt') ||
    lower.includes('session expired') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid token') ||
    lower.includes('401') ||
    lower.includes('not authenticated')
  ) {
    return 'Your session expired. Please sign in again and retry.';
  }

  // Permission / Authorization / RLS
  if (
    lower.includes('permission denied') ||
    lower.includes('forbidden') ||
    lower.includes('403') ||
    lower.includes('row-level security') ||
    lower.includes('access denied') ||
    lower.includes('rls')
  ) {
    return 'You do not have permission to make this change.';
  }

  // Database / Postgres / Supabase / Backend technical noise
  if (
    lower.includes('postgres') ||
    lower.includes('supabase') ||
    lower.includes('pgrst') ||
    lower.includes('duplicate key') ||
    lower.includes('violates constraint') ||
    lower.includes('foreign key') ||
    lower.includes('syntax error') ||
    lower.includes('invalid input syntax') ||
    lower.includes('column') ||
    lower.includes('relation') ||
    lower.includes('http 500') ||
    lower.includes('http 400') ||
    lower.includes('internal server error') ||
    lower.includes('stack trace') ||
    lower.includes('uuid')
  ) {
    return 'The server could not accept this change. Please review the information and try again.';
  }

  if (message.includes('\n') || message.includes('at ') || message.includes('Error:')) {
    return "We couldn't finish this operation. Please try again.";
  }

  return message || "We couldn't finish this operation. Please try again.";
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
      let activeStepId: string | null = config.steps[0]?.id || null;

      const executeWrapper = async (): Promise<T | null> => {
        activeStepId = config.steps[0]?.id || null;

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
            activeStepId = id;
            setStepActive(id, update);
          },
          completeStep: (id, update) => {
            if (activeStepId === id) {
              activeStepId = null;
            }
            setStepComplete(id, update);
          },
          failStep: (id, detail) => {
            activeStepId = id;
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
          const humanMsg = humanizeErrorMessage(err);

          if (activeStepId) {
            setStepError(activeStepId, humanMsg);
          }

          failOperation({
            title: "We couldn't finish saving",
            message: humanMsg,
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
