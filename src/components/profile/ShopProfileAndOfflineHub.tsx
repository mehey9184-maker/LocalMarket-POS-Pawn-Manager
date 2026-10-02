import React, { useState, useRef } from 'react';
import { 
  HardDrive, 
  Download, 
  Upload, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const ShopProfileAndOfflineHub: React.FC = () => {
  const { isOwner } = useAuth();
  const {
    isOnline,
    isSlowSyncing,
    pendingSyncCount,
    failedSyncCount = 0,
    hasDeterministicError = false,
    hasTransientError = false,
    slowSyncProgress,
    triggerManualSlowSync,
    exportDeviceBackup,
    restoreDeviceBackup,
    deviceStorageStats,
    showToast
  } = useApp();

  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
      const text = await file.text();
      await restoreDeviceBackup(text);
    } catch (err: any) {
      showToast('File Read Error', err?.message || 'Invalid backup file', 'error');
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8 text-stone-900">
      {/* 1. SAVED ON THIS COMPUTER / LOCAL DEVICE STORAGE CARD */}
      <div className="bg-white border border-stone-200 rounded-[2.5rem] p-8 lg:p-10 space-y-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
              <HardDrive className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black text-stone-900 font-headline tracking-tight">
                  Saved on this computer
                </h2>
                {isOnline ? (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Wifi className="w-3 h-3" /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    <WifiOff className="w-3 h-3" /> Offline Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-1">
                All receipts, inventory, and records are stored securely on this computer so you can keep serving customers without interruptions.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              onClick={triggerManualSlowSync}
              disabled={isSlowSyncing}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isSlowSyncing 
                  ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' 
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
              }`}
              title="Save pending changes to the server"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-600 ${isSlowSyncing ? 'animate-spin' : ''}`} />
              <span>{isSlowSyncing ? 'Saving…' : 'Save Changes'}</span>
            </button>
            <span className="text-[10px] text-stone-400 font-medium">
              Changes normally sync automatically.
            </span>
          </div>
        </div>

        {/* ACTIVE SYNC PROGRESS BANNER */}
        {isSlowSyncing && slowSyncProgress && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Saving changes ({slowSyncProgress.current} of {slowSyncProgress.total})…</span>
            </div>
            <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${Math.round((slowSyncProgress.current / slowSyncProgress.total) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-blue-500/80">
              Your changes are being saved in the background.
            </p>
          </div>
        )}

        {/* DEVICE STORAGE METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Items stored</p>
            <p className="text-2xl font-black text-stone-900 font-headline mt-1">{deviceStorageStats.totalItems}</p>
            <p className="text-[9px] text-emerald-600 mt-1 font-semibold">Saved on this computer</p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Receipts stored</p>
            <p className="text-2xl font-black text-stone-900 font-headline mt-1">{deviceStorageStats.totalSales}</p>
            <p className="text-[9px] text-emerald-600 mt-1 font-semibold">Saved on this computer</p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Storage used</p>
            <p className="text-2xl font-black text-stone-900 font-headline mt-1">~{deviceStorageStats.estimatedLocalSizeKb} KB</p>
            <p className="text-[9px] text-stone-400 mt-1">Space used on this computer</p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Sync status</p>
            <div className="flex flex-col gap-1 mt-1.5">
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-black text-stone-900 font-headline">
                  {isSlowSyncing 
                    ? 'Saving your changes…' 
                    : (pendingSyncCount > 0 || failedSyncCount > 0)
                    ? `${pendingSyncCount + failedSyncCount} changes waiting` 
                    : 'Synced'}
                </p>
                {isSlowSyncing ? (
                  <span className="text-[9px] text-cyan-700 font-bold px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-200">Saving…</span>
                ) : (pendingSyncCount > 0 || failedSyncCount > 0) ? (
                  <span className="text-[9px] text-amber-700 font-bold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">Waiting</span>
                ) : (
                  <span className="text-[9px] text-emerald-700 font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-sans">Synced</span>
                )}
              </div>
              
              {hasDeterministicError && (
                <p className="text-[10px] text-rose-600 font-medium leading-tight mt-0.5">⚠️ Some changes need attention.</p>
              )}
              {hasTransientError && (
                <p className="text-[10px] text-amber-600 font-medium leading-tight mt-0.5">🔄 Connection is unavailable. We'll retry automatically.</p>
              )}
              {!hasDeterministicError && !hasTransientError && pendingSyncCount === 0 && failedSyncCount === 0 && (
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Everything is saved and synced.</p>
              )}
            </div>
          </div>
        </div>

        {/* BACKUP & RECOVERY GATED BY ISOWNER */}
        {isOwner && (
          <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-stone-700">Backup this computer</p>
              <p className="text-[11px] text-stone-500">
                Create a backup file so you can recover your store data or move to another computer.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".json" 
                  className="hidden" 
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-bold border border-stone-200 transition cursor-pointer"
                  title="Restore store data from a backup file"
                >
                  {isRestoring ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 text-blue-600" />
                  )}
                  <span>{isRestoring ? 'Restoring your backup…' : 'Restore Backup'}</span>
                </button>

                <button
                  onClick={exportDeviceBackup}
                  disabled={isRestoring}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/10 cursor-pointer"
                  title="Create a backup file so you can recover your store data"
                >
                  <Download className="w-4 h-4" />
                  <span>Create Backup</span>
                </button>
              </div>
              {isRestoring && (
                <p className="text-[11px] text-blue-600 font-semibold animate-pulse">
                  Your store data is being restored. Keep this window open until it finishes.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
