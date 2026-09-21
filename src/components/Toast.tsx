import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toastMessage } = useApp();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div
        className={`p-3.5 rounded-xl shadow-2xl border flex items-start gap-3 ${
          toastMessage.type === 'error'
            ? 'bg-red-950/95 border-red-700 text-white'
            : toastMessage.type === 'amber'
            ? 'bg-amber-950/95 border-amber-600 text-white'
            : toastMessage.type === 'info'
            ? 'bg-[#1E1E1E]/95 border-[#C85A32] text-white'
            : 'bg-emerald-950/95 border-emerald-600 text-white'
        }`}
      >
        <div className="mt-0.5 shrink-0">
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : toastMessage.type === 'amber' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          ) : toastMessage.type === 'info' ? (
            <Info className="w-5 h-5 text-[#E87A5D]" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-tight font-headline">{toastMessage.title}</p>
          <p className="text-[11px] text-gray-200 mt-0.5 leading-snug">{toastMessage.desc}</p>
        </div>
      </div>
    </div>
  );
};
