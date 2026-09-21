import React from 'react';
import { X, PlayCircle, ShieldCheck, Printer, Store, UserCheck, AlertTriangle } from 'lucide-react';

interface SystemTestProtocolModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemTestProtocolModal: React.FC<SystemTestProtocolModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="p-4 border-b border-[#333] flex items-center justify-between bg-[#111]">
          <div className="flex items-center gap-2.5">
            <PlayCircle className="w-5 h-5 text-[#C85A32]" />
            <div>
              <h3 className="font-bold text-sm text-white font-headline">End-to-End Walkthrough Protocol</h3>
              <p className="text-[10px] text-gray-500 font-mono">Simulation Test Suite v1.0</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
          {/* Scenario 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[#E87A5D]">
              <UserCheck className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider">Test Scenario 1: Intake Walk-in (Pawn)</h4>
            </div>
            <div className="pl-6 border-l-2 border-[#333] space-y-2 text-[11px] text-gray-300">
              <p>1. Go to <span className="text-white font-bold">"Intake (Buy/Pawn)"</span> tab.</p>
              <p>2. Click <span className="text-white font-bold">"Scan RSA ID"</span>. Verify auto-fill for <span className="italic text-gray-400">Sipho Ndlovu</span>.</p>
              <p>3. Select <span className="text-white font-bold">"30-Day Pawn Loan"</span>. Assessment: <span className="italic text-gray-400">iPhone 12, Good condition</span>.</p>
              <p>4. Set Cash Principal: <span className="text-emerald-400">R 2,500.00</span>. Verify NCR Interest: <span className="text-amber-400">R 125.00</span>.</p>
              <p>5. Click <span className="text-white font-bold">"Process 30-Day Loan"</span>. Verify ticket #PWN generated.</p>
            </div>
          </div>

          {/* Scenario 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[#E87A5D]">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider">Test Scenario 2: Defaulted Floor Transfer</h4>
            </div>
            <div className="pl-6 border-l-2 border-[#333] space-y-2 text-[11px] text-gray-300">
              <p>1. Go to <span className="text-white font-bold">"Vault & Stock"</span> tab → <span className="text-white font-bold">"Overdue & Forfeits"</span>.</p>
              <p>2. Locate <span className="italic text-gray-400">Dell Latitude</span>. Click <span className="text-white font-bold">"Approve Floor Transfer"</span>.</p>
              <p>3. Enter Resale Price: <span className="text-emerald-400">R 4,850.00</span>. Manager PIN: <span className="text-white font-bold font-mono">8419</span>.</p>
              <p>4. Verify item instantly appears in <span className="text-white font-bold">"POS"</span> inventory as "Forfeited Pawn".</p>
            </div>
          </div>

          {/* Scenario 3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[#E87A5D]">
              <Store className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider">Test Scenario 3: Retail Checkout</h4>
            </div>
            <div className="pl-6 border-l-2 border-[#333] space-y-2 text-[11px] text-gray-300">
              <p>1. Go to <span className="text-white font-bold">"POS"</span> tab. Add the forfeited <span className="italic text-gray-400">Dell Latitude</span> to cart.</p>
              <p>2. Select Tender: <span className="text-white font-bold">"Cash"</span>. Click <span className="text-white font-bold font-mono">[Round 5000]</span>.</p>
              <p>3. Verify Change Due: <span className="text-emerald-400">R 150.00</span>.</p>
              <p>4. Click <span className="text-white font-bold">"Complete Sale & Print"</span>. Observe Thermal Receipt preview.</p>
            </div>
          </div>

          {/* Scenario 4 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[#E87A5D]">
              <ShieldCheck className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider">Test Scenario 4: SAPS Police Inspection</h4>
            </div>
            <div className="pl-6 border-l-2 border-[#333] space-y-2 text-[11px] text-gray-300">
              <p>1. Go to <span className="text-white font-bold">"SAPS Register"</span> tab. Verify Form 21 records.</p>
              <p>2. Click <span className="text-white font-bold font-mono">"Police Inspection Mode"</span>.</p>
              <p>3. Verify audit banner appears and editing controls are masked.</p>
              <p>4. Click <span className="text-white font-bold">"Log Inspector Visit"</span>. Sign as <span className="italic text-gray-400">W/O D. Naidoo</span>.</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#111] border-t border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <Printer className="w-3 h-3" />
              <span>Offline Ready (PWA)</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-700"></div>
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <ShieldCheck className="w-3 h-3" />
              <span>ZPL & ESC/POS Enabled</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#C85A32] hover:bg-[#b04d29] text-white text-xs font-bold rounded-lg shadow-lg transition"
          >
            Close & Start Testing
          </button>
        </div>
      </div>
    </div>
  );
};
