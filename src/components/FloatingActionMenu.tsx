import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, UserPlus, ShoppingCart, PackagePlus, X } from 'lucide-react';

export const FloatingActionMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { setActiveTab, showToast } = useApp();

  const actions = [
    { label: 'New Intake', icon: PackagePlus, tab: 'intake', color: 'bg-amber-500' },
    { label: 'New Sale', icon: ShoppingCart, tab: 'pos', color: 'bg-emerald-500' },
    { label: 'New Customer', icon: UserPlus, tab: 'intake', color: 'bg-blue-500' },
  ];

  const handleAction = (tab: any, label: string) => {
    setActiveTab(tab);
    setIsOpen(false);
    showToast(`Quick Action: ${label}`, `Switching to ${label} module`, 'info');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <div className="flex flex-col items-end gap-3 mb-2">
            {actions.map((action, i) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleAction(action.tab, action.label)}
                className="flex items-center gap-3 group"
              >
                <span className="px-3 py-1.5 rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] text-white text-xs font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  {action.label}
                </span>
                <div className={`w-12 h-12 rounded-2xl ${action.color} text-black flex items-center justify-center shadow-2xl shadow-black/40 hover:scale-110 transition-transform`}>
                  <action.icon className="w-5 h-5" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 ${
          isOpen ? 'bg-[#2A2A2A] text-white rotate-90' : 'bg-[#C85A32] text-white shadow-[#C85A32]/40'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  );
};
