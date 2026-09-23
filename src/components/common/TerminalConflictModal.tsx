import React from 'react';
import { AlertTriangle, Monitor, ArrowLeftRight } from 'lucide-react';

interface TerminalConflictModalProps {
  activeSession: {
    terminal_id: string;
    terminal_name?: string;
    activated_at: string;
  };
  onSwitch: () => void;
  onStay: () => void;
}

export const TerminalConflictModal: React.FC<TerminalConflictModalProps> = ({
  activeSession,
  onSwitch,
  onStay
}) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-amber-100">
        <div className="bg-amber-50 p-6 flex items-start gap-4 border-b border-amber-100">
          <div className="bg-amber-100 p-3 rounded-full">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Active Session Detected</h3>
            <p className="text-amber-700 mt-1">
              This cashier account is already active on another terminal.
            </p>
          </div>
        </div>
        
        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-3 text-gray-700 font-medium">
              <Monitor className="w-5 h-5 text-gray-400" />
              <span>Current Active Terminal</span>
            </div>
            <div className="space-y-1 text-sm text-gray-600 ml-8">
              <p>Name: <span className="font-semibold text-gray-900">{activeSession.terminal_name || 'Unknown Terminal'}</span></p>
              <p>ID: <span className="font-mono text-xs">{activeSession.terminal_id}</span></p>
              <p>Active Since: <span className="font-medium text-gray-900">{new Date(activeSession.activated_at).toLocaleString()}</span></p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onSwitch}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              <ArrowLeftRight className="w-5 h-5" />
              Switch to This Terminal
            </button>
            <button
              onClick={onStay}
              className="w-full bg-white text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors border border-gray-200"
            >
              Stay on Current Terminal
            </button>
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Switching will invalidate the session on the other terminal.
          </p>
        </div>
      </div>
    </div>
  );
};
