import React from 'react';
import { useTerminalSession } from '../hooks/useTerminalSession';
import { TerminalConflictModal } from './common/TerminalConflictModal';
import { useAuth } from '../context/AuthContext';
import { Loader2, MonitorOff, WifiOff, RefreshCw, LogOut } from 'lucide-react';

export const TerminalGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { session, conflict, isLoading, isOfflineRevalidation, switchTerminal, reconnectTerminal } = useTerminalSession();

  if (!user) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]/90 backdrop-blur-md z-[100]">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl space-y-4">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
          <p className="text-gray-200 font-medium text-sm">Authorizing Terminal Session...</p>
        </div>
      </div>
    );
  }

  if (conflict) {
    return (
      <TerminalConflictModal
        activeSession={conflict.active_session}
        onSwitch={switchTerminal}
        onStay={() => window.location.href = '/login'}
      />
    );
  }

  if (session && (session.status === 'invalidated' || session.status === 'expired')) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a0a]/95 backdrop-blur-md">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="bg-red-500/10 border border-red-500/25 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MonitorOff className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Terminal Session Ended</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            This terminal session has been invalidated or expired because you signed in on another device or the lease timed out.
          </p>
          <div className="space-y-3">
            <button
              onClick={reconnectTerminal}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 px-4 rounded-xl font-bold text-sm tracking-wide shadow-xl shadow-amber-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reconnect Terminal
            </button>
            <button
              onClick={switchTerminal}
              className="w-full bg-[#1e1e1e] hover:bg-[#252525] border border-[#2e2e2e] text-gray-300 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Switch Terminal / Re-acquire
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {isOfflineRevalidation && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>You’re offline — you can keep working. Changes will sync when connection returns.</span>
        </div>
      )}
      {children}
    </>
  );
};
