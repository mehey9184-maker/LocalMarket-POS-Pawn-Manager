import React from 'react';
import { WorkflowDraft } from '../../types';
import { motion } from 'motion/react';
import { RefreshCw, X, Trash2 } from 'lucide-react';

interface Props {
  drafts: WorkflowDraft[];
  onContinue: (draft: WorkflowDraft) => void;
  onDiscard: (draftId: string) => void;
}

export const DraftRecoveryModal: React.FC<Props> = ({ drafts, onContinue, onDiscard }) => {
  if (drafts.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full space-y-4"
      >
        <h2 className="text-lg font-bold text-gray-900">Welcome back</h2>
        <p className="text-sm text-gray-500">You have unfinished work:</p>
        
        <div className="space-y-3">
          {drafts.map(draft => (
            <div key={draft.id} className="p-3 border border-gray-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-900">{draft.payload.title || 'Untitled Draft'}</p>
                <p className="text-xs text-gray-500 capitalize">{draft.workflowType} · {draft.step}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onContinue(draft)}
                  className="px-3 py-1.5 bg-[#C85A32] text-white rounded-lg text-xs font-semibold"
                >
                  Continue
                </button>
                <button
                  onClick={() => onDiscard(draft.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
