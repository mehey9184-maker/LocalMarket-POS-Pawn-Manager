import React from 'react';
import { useTerminalSession } from '../hooks/useTerminalSession';
import { TerminalConflictModal } from './common/TerminalConflictModal';
import { useAuth } from '../context/AuthContext';
import { Loader2, MonitorOff } from 'lucide-react';

export const TerminalGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { session, conflict, isLoading, switchTerminal } = useTerminalSession();

  if (!user) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm z-[100]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Authorizing Terminal Session...</p>
        </div>
      </div>
    );
  }

  if (conflict) {
    return (
      <TerminalConflictModal
        activeSession={conflict.active_session}
        onSwitch={switchTerminal}
        onStay={() => window.location.href = '/login'} // Logout or redirect
      />
    );
  }

  if (session && (session.status === 'invalidated' || session.status === 'expired')) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-md">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <MonitorOff className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Invalidated</h2>
          <p className="text-gray-600 mb-8">
            This terminal session has been invalidated because you logged in on another device or the session expired.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            Reconnect Terminal
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
