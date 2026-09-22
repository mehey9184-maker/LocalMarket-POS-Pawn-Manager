import React, { useState } from 'react';
import { LoansLedger } from './LoansLedger';
import { OutrightBuysLedger } from './OutrightBuysLedger';
import { SapsRegister } from './SapsRegister';
import { motion } from 'motion/react';
import { History, ShieldCheck, ShoppingBag } from 'lucide-react';

export const Registry: React.FC = () => {
  const [registryMode, setRegistryMode] = useState<'loans' | 'buys' | 'saps'>('loans');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#121212]">
      {/* Registry Sub-Navigation: Consolidating Audit and History */}
      <div className="px-6 py-3 bg-[#1A1A1A] border-b border-[#2A2A2A] flex items-center justify-between gap-4 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setRegistryMode('loans')}
            className={`flex items-center gap-2 pb-1.5 border-b-2 transition-all whitespace-nowrap ${
              registryMode === 'loans'
                ? 'border-[#C85A32] text-[#E87A5D]'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">30-Day Pawn Loans (NCR)</span>
          </button>

          <button
            onClick={() => setRegistryMode('buys')}
            className={`flex items-center gap-2 pb-1.5 border-b-2 transition-all whitespace-nowrap ${
              registryMode === 'buys'
                ? 'border-[#C85A32] text-[#E87A5D]'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Outright Buys (Inventory)</span>
          </button>
          
          <button
            onClick={() => setRegistryMode('saps')}
            className={`flex items-center gap-2 pb-1.5 border-b-2 transition-all whitespace-nowrap ${
              registryMode === 'saps'
                ? 'border-[#C85A32] text-[#E87A5D]'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">SAPS Register (Form 21)</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[10px] text-gray-500 font-mono italic">
          Statutory Compliance: ACTIVE
        </div>
      </div>

      {/* Unified Registry Viewport */}
      <div className="flex-1 overflow-hidden">
        {registryMode === 'loans' ? (
          <motion.div 
            key="ledger"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="h-full"
          >
            <LoansLedger />
          </motion.div>
        ) : registryMode === 'buys' ? (
          <motion.div 
            key="buys"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
          >
            <OutrightBuysLedger />
          </motion.div>
        ) : (
          <motion.div 
            key="saps"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="h-full"
          >
            <SapsRegister />
          </motion.div>
        )}
      </div>
    </div>
  );
};
