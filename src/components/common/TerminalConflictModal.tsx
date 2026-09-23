import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Monitor, RefreshCw, LogOut, ShieldAlert } from 'lucide-react';

interface TerminalConflictModalProps {
  isOpen: boolean;
  existingTerminalName: string;
  lastActiveTime?: string;
  onStay: () => void;
  onSwitch: () => void;
  isLoading?: boolean;
}

export const TerminalConflictModal: React.FC<TerminalConflictModalProps> = ({
  isOpen,
  existingTerminalName,
  lastActiveTime,
  onStay,
  onSwitch,
  isLoading = false
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-[#FDF0EA] border-b border-[#C85A32]/20 p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#C85A32]/10 text-[#C85A32] flex items-center justify-center shrink-0">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C85A32]/15 text-[#C85A32] uppercase tracking-wider">
                Concurrent Session Notice
              </span>
              <h3 className="text-base font-bold text-gray-900 mt-1">
                Active Terminal Session Detected
              </h3>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                This cashier is active on another terminal. Switch to this terminal?
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5 text-xs text-gray-700 font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Active Device:</span>
                <span className="font-bold text-gray-900">{existingTerminalName}</span>
              </div>
              {lastActiveTime && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Activity:</span>
                  <span className="text-gray-800">{new Date(lastActiveTime).toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 leading-normal">
              Switching will activate this terminal and securely lock out the previous terminal to prevent simultaneous sales conflicts.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onStay}
                disabled={isLoading}
                className="py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
              >
                Stay on Current Terminal
              </button>
              <button
                type="button"
                onClick={onSwitch}
                disabled={isLoading}
                className="py-2.5 px-4 rounded-xl bg-[#C85A32] text-white text-xs font-semibold hover:bg-[#B24D28] transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Switch Terminal</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

interface TerminalInvalidatedModalProps {
  isOpen: boolean;
  reason?: string;
  onReAuthenticate: () => void;
}

export const TerminalInvalidatedModal: React.FC<TerminalInvalidatedModalProps> = ({
  isOpen,
  reason,
  onReAuthenticate
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden text-center p-7 space-y-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-900">
              Terminal Session Locked
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              {reason || "Your staff session has been switched to another terminal. This device has been locked to prevent concurrency conflicts."}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onReAuthenticate}
              className="w-full py-3 px-4 rounded-xl bg-[#C85A32] text-white text-xs font-semibold hover:bg-[#B24D28] transition shadow-md cursor-pointer"
            >
              Re-activate on this Terminal
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
