import React from 'react';
import { useTerminalSession } from '../hooks/useTerminalSession';
import { TerminalConflictModal } from './common/TerminalConflictModal';
import { useAuth } from '../context/AuthContext';
import { terminalService } from '../services/terminalService';
import { Loader2, MonitorOff, WifiOff, RefreshCw, LogOut } from 'lucide-react';

export const TerminalGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isProfileLoading, isSwitchingAccount } = useAuth();
  const { session, conflict, isLoading, isOfflineRevalidation, switchTerminal, reconnectTerminal } = useTerminalSession();

  if (!user || isSwitchingAccount) return <>{children}</>;

  // Check if we have an active matching local terminal session
  const hasMatchingActiveSession =
    session &&
    session.status === 'active' &&
    session.userId === user.id &&
    (!profile?.shop_id || session.shopId === profile.shop_id) &&
    session.deviceId === terminalService.getDeviceId();

  // On genuine cold start or when no usable local session exists, show loading screen.
  // If a matching local session exists, do not block the entire application with the overlay
  // while profile revalidation or background checks occur.
  const shouldBlockWithLoader = (isProfileLoading || isLoading) && !hasMatchingActiveSession;

  if (shouldBlockWithLoader) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-stone-50/90 backdrop-blur-md z-[100]">
        <div className="bg-white border border-stone-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl space-y-4">
          <Loader2 className="w-10 h-10 text-[#C85A32] animate-spin mx-auto" />
          <p className="text-stone-700 font-semibold text-sm">Connecting to your Shop...</p>
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-50/95 backdrop-blur-md">
        <div className="bg-white border border-stone-200 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="bg-red-50 border border-red-200 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MonitorOff className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Terminal Session Ended</h2>
          <p className="text-stone-500 text-sm mb-8 leading-relaxed">
            This terminal session has been invalidated or expired because you signed in on another device or the lease timed out.
          </p>
          <div className="space-y-3">
            <button
              onClick={reconnectTerminal}
              className="w-full bg-[#C85A32] hover:bg-[#B84E27] text-white py-3 px-4 rounded-xl font-bold text-sm tracking-wide shadow-md shadow-[#C85A32]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reconnect Terminal
            </button>
            <button
              onClick={switchTerminal}
              className="w-full bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
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
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-900 flex items-center justify-center gap-2 font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          <span>You’re offline — you can keep working. Changes will sync when connection returns.</span>
        </div>
      )}
      {children}
    </>
  );
};
