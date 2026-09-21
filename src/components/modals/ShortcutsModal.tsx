import React from 'react';
import { Keyboard, X, ArrowRight, Zap, ShoppingBag, Trash2, Camera, Shield } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC = () => {
  return null;
};

export const KeyboardShortcutsGuide: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const navShortcuts = [
    { label: 'Front POS Terminal', keys: ['Ctrl', '1'], altKey: 'F1', desc: 'Jump to cashier till & catalog' },
    { label: 'Buy / Pawn Intake Desk', keys: ['Ctrl', '2'], altKey: 'F2', desc: 'Appraise & log new collateral' },
    { label: 'Vault & Stockroom', keys: ['Ctrl', '3'], altKey: 'F3', desc: 'Manage 30-day holds & transfers' },
    { label: 'Loans Ledger', keys: ['Ctrl', '4'], altKey: 'F4', desc: 'Contract settlements & extensions' },
    { label: 'SAPS Compliance Register', keys: ['Ctrl', '5'], altKey: 'F5', desc: 'Second-Hand Goods Act Form 21' },
  ];

  const actionShortcuts = [
    {
      label: 'Quick Cash Checkout',
      keys: ['Ctrl', 'Enter'],
      altKey: 'F9',
      desc: 'Instantly tenders active cart with exact cash & prints receipt'
    },
    {
      label: 'Clear Till / Cart',
      keys: ['Ctrl', 'Backspace'],
      altKey: 'Alt+C',
      desc: 'Removes all line items from the active basket'
    },
    {
      label: 'Open Barcode Camera Scanner',
      keys: ['Ctrl', 'B'],
      altKey: 'F7',
      desc: 'Opens hardware optical or mobile camera feed'
    },
    {
      label: 'Keyboard Shortcuts Cheat-Sheet',
      keys: ['?'],
      altKey: 'Ctrl+/',
      desc: 'Toggle this cashier reference cheat-sheet'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#161616]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#291813] text-[#E87A5D] border border-[#C85A32]/40">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white font-headline">
                POS Hardware &amp; Keyboard Shortcuts
              </h3>
              <p className="text-[11px] text-gray-400 font-mono">
                Optimized for standard South African retail POS keyboards &amp; PC cashier layouts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Navigation */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#E87A5D] block mb-2">
              Tab Navigation (Ctrl + Number or F-Keys)
            </span>
            <div className="grid grid-cols-1 gap-2">
              {navShortcuts.map((s, idx) => (
                <div
                  key={idx}
                  className="bg-[#141414] p-2.5 rounded-xl border border-[#2A2A2A] flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{s.label}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">{s.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="px-2 py-1 rounded bg-[#2A2A2A] text-white font-mono text-[11px] font-bold border border-gray-700">
                      {s.keys.join(' + ')}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">or</span>
                    <span className="px-1.5 py-1 rounded bg-[#1A1A1A] text-gray-300 font-mono text-[10px] border border-gray-800">
                      {s.altKey}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Cashier Speed Actions */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-emerald-400 block mb-2 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              Cashier Quick Actions
            </span>
            <div className="grid grid-cols-1 gap-2">
              {actionShortcuts.map((s, idx) => (
                <div
                  key={idx}
                  className="bg-[#141414] p-2.5 rounded-xl border border-[#2A2A2A] flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{s.label}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">{s.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="px-2 py-1 rounded bg-[#291813] text-[#E87A5D] font-mono text-[11px] font-bold border border-[#C85A32]/40">
                      {s.keys.join(' + ')}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">or</span>
                    <span className="px-1.5 py-1 rounded bg-[#1A1A1A] text-gray-300 font-mono text-[10px] border border-gray-800">
                      {s.altKey}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#161616] border-t border-[#2A2A2A] flex items-center justify-between text-xs font-mono text-gray-400">
          <span>Press <strong className="text-white">Esc</strong> or <strong className="text-white">?</strong> to dismiss</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#383838] text-white font-semibold text-xs transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
