import React from 'react';
import { WorkflowDraft } from '../../types';
import { motion } from 'motion/react';
import { Clock, ArrowRight, Trash2 } from 'lucide-react';

interface Props {
  drafts: WorkflowDraft[];
  onContinue: (draft: WorkflowDraft) => void;
  onDiscard: (draftId: string) => void;
}

export const DraftRecoveryModal: React.FC<Props> = ({ drafts, onContinue, onDiscard }) => {
  if (drafts.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl p-6 sm:p-7 shadow-xl max-w-md w-full space-y-5 border border-stone-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">You have unfinished work</h2>
            <p className="text-xs text-stone-500">Continue where you left off, or start fresh.</p>
          </div>
        </div>
        
        <div className="space-y-2.5">
          {drafts.map(draft => {
            const title = draft.payload?.itemData?.title || draft.payload?.title || 'Untitled intake';
            const typeLabel = draft.workflowType === 'buy' ? 'Buy from person' : draft.workflowType === 'pawn' ? 'Pawn loan' : 'Existing stock';

            return (
              <div 
                key={draft.id} 
                className="p-3.5 border border-stone-200 rounded-xl bg-stone-50/60 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-stone-900 truncate">{title}</p>
                  <p className="text-xs text-stone-500 capitalize">{typeLabel} · {draft.step}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onContinue(draft)}
                    className="px-3.5 py-1.5 bg-[#C85A32] hover:bg-[#B84E27] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDiscard(draft.id)}
                    aria-label="Discard draft"
                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};
