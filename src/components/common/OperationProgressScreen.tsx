/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  Loader2, 
  AlertTriangle, 
  CloudOff, 
  RotateCcw, 
  ArrowLeft,
  Circle
} from 'lucide-react';
import { OperationProgressState } from '../../hooks/useOperationProgress';

export interface OperationProgressScreenProps {
  state: OperationProgressState;
  onRetry?: () => void;
  onClose?: () => void;
}

export const OperationProgressScreen: React.FC<OperationProgressScreenProps> = ({
  state,
  onRetry,
  onClose,
}) => {
  if (!state.isOpen) return null;

  const handleRetry = () => {
    if (state.onRetry) {
      state.onRetry();
    } else if (onRetry) {
      onRetry();
    }
  };

  const handleClose = () => {
    if (state.onClose) {
      state.onClose();
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm animate-auth-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="operation-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg bg-white border border-stone-200 rounded-3xl p-8 sm:p-10 shadow-2xl text-stone-900 relative overflow-hidden"
      >
        {/* TOP OFFLINE BANNER (IF APPLICABLE) */}
        {state.isOffline && (
          <div className="mb-6 p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900">
            <CloudOff className="w-4 h-4 text-amber-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold">Local-First Save:</span>{' '}
              <span className="text-amber-800">
                {state.offlineNotice || 'Changes will be saved securely on this device and queued for cloud sync.'}
              </span>
            </div>
          </div>
        )}

        {/* 1. IN PROGRESS STATE */}
        {state.status === 'in_progress' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 id="operation-title" className="text-2xl font-bold font-headline text-stone-900 tracking-tight">
                {state.title}
              </h2>
              <p className="text-sm text-stone-500">
                {state.subtitle || "We're taking care of your changes."}
              </p>
            </div>

            {/* Step-by-step Activity List */}
            <div className="py-2 space-y-3.5 border-y border-stone-100 my-4">
              {state.steps.map((step) => {
                const isComplete = step.status === 'complete';
                const isActive = step.status === 'active';
                const isError = step.status === 'error';
                const isPending = step.status === 'pending';

                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3.5 transition-all duration-200 ${
                      isPending ? 'opacity-40' : 'opacity-100'
                    }`}
                  >
                    {/* Step Icon */}
                    <div className="pt-0.5 shrink-0">
                      {isComplete && (
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      )}
                      {isActive && (
                        <div className="w-5 h-5 rounded-full bg-[#C85A32]/15 text-[#C85A32] flex items-center justify-center">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        </div>
                      )}
                      {isError && (
                        <div className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
                          <AlertTriangle className="w-3 h-3" />
                        </div>
                      )}
                      {isPending && (
                        <div className="w-5 h-5 rounded-full border border-stone-300 flex items-center justify-center">
                          <Circle className="w-1.5 h-1.5 fill-stone-300 text-transparent" />
                        </div>
                      )}
                    </div>

                    {/* Step Label & Optional Detail */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm tracking-tight leading-snug ${
                          isActive
                            ? 'font-bold text-stone-900'
                            : isComplete
                            ? 'font-medium text-stone-800'
                            : isError
                            ? 'font-medium text-red-700'
                            : 'font-normal text-stone-500'
                        }`}
                      >
                        {step.label}
                      </p>
                      {step.detail && (
                        <p className="text-xs text-stone-500 mt-0.5 font-mono truncate">
                          {step.detail}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-stone-400 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C85A32] animate-ping" />
                Please keep this window open
              </span>
            </div>
          </div>
        )}

        {/* 2. SUCCESS STATE */}
        {state.status === 'success' && (
          <div className="text-center py-4 space-y-5">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center shadow-inner"
            >
              <Check className="w-8 h-8 stroke-[2.5]" />
            </motion.div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold font-headline text-stone-900 tracking-tight">
                {state.successTitle || 'Changes Saved'}
              </h2>
              <p className="text-sm text-stone-600 max-w-sm mx-auto">
                {state.successMessage || 'Your changes have been saved.'}
              </p>
            </div>

            {state.isOffline && (
              <p className="text-xs text-stone-400 font-medium">
                Saved on this computer · Cloud sync queued
              </p>
            )}
          </div>
        )}

        {/* 3. ERROR STATE */}
        {state.status === 'error' && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold font-headline text-stone-900 tracking-tight">
                  {state.errorTitle || "We couldn't finish saving"}
                </h2>
                <p className="text-sm text-stone-600">
                  {state.errorMessage || 'An error occurred while saving your changes. Please review and try again.'}
                </p>
              </div>
            </div>

            {/* Step-by-step Activity List showing failed step */}
            {state.steps.length > 0 && (
              <div className="py-2 space-y-3.5 border-y border-stone-100 my-4">
                {state.steps.map((step) => {
                  const isComplete = step.status === 'complete';
                  const isActive = step.status === 'active';
                  const isError = step.status === 'error';
                  const isPending = step.status === 'pending';

                  return (
                    <div
                      key={step.id}
                      className={`flex items-start gap-3.5 transition-all duration-200 ${
                        isPending ? 'opacity-40' : 'opacity-100'
                      }`}
                    >
                      {/* Step Icon */}
                      <div className="pt-0.5 shrink-0">
                        {isComplete && (
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        )}
                        {isActive && (
                          <div className="w-5 h-5 rounded-full bg-[#C85A32]/15 text-[#C85A32] flex items-center justify-center">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          </div>
                        )}
                        {isError && (
                          <div className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
                            <AlertTriangle className="w-3 h-3" />
                          </div>
                        )}
                        {isPending && (
                          <div className="w-5 h-5 rounded-full border border-stone-300 flex items-center justify-center">
                            <Circle className="w-1.5 h-1.5 fill-stone-300 text-transparent" />
                          </div>
                        )}
                      </div>

                      {/* Step Label & Optional Detail */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm tracking-tight leading-snug ${
                            isActive
                              ? 'font-bold text-stone-900'
                              : isComplete
                              ? 'font-medium text-stone-800'
                              : isError
                              ? 'font-medium text-red-700'
                              : 'font-normal text-stone-500'
                          }`}
                        >
                          {step.label}
                        </p>
                        {step.detail && (
                          <p className={`text-xs mt-0.5 font-mono truncate ${isError ? 'text-red-600' : 'text-stone-500'}`}>
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {state.isOffline && (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600">
                <p className="font-semibold text-stone-800">Local Integrity Safeguard</p>
                <p className="mt-0.5">Your draft or existing data remains safe on this device. No unverified records were committed.</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return</span>
              </button>
              {(state.onRetry || onRetry) && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-6 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A94725] text-white text-xs font-bold transition-all shadow-md shadow-[#C85A32]/20 cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
