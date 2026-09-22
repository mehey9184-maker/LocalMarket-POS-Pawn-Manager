import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, Trash2, Archive, Fingerprint } from 'lucide-react';

interface OnboardingOverlayProps {
  screenId: 'pos' | 'vault';
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ screenId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const storageKey = `onboarding_dismissed_${screenId}`;

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
  };

  const steps = screenId === 'pos' ? [
    {
      icon: <Trash2 className="w-6 h-6 text-red-400" />,
      title: "Swipe Left to Remove",
      description: "Made a mistake? Swipe any item in the order tray to the left to remove it instantly.",
      gesture: "left"
    },
    {
      icon: <Fingerprint className="w-6 h-6 text-emerald-400" />,
      title: "Tactile Handles",
      description: "Look for the vertical bars on the side of items—they indicate gesture-ready areas.",
      gesture: "handle"
    }
  ] : [
    {
      icon: <Archive className="w-6 h-6 text-blue-400" />,
      title: "Swipe Right to Archive",
      description: "Relocating stock? Swipe items to the right to move them into the long-term vault storage.",
      gesture: "right"
    },
    {
      icon: <Trash2 className="w-6 h-6 text-red-400" />,
      title: "Swipe Left for Removal",
      description: "Remove expired or invalid entries by swiping left on the ledger card.",
      gesture: "left"
    }
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-md bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-[#2A2A2A] flex items-center justify-between bg-gradient-to-r from-[#C85A32]/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C85A32]/20 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-[#C85A32]" />
                </div>
                <div>
                  <h3 className="text-white font-bold tracking-tight">Gesture Training</h3>
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">New Cashier Protocol</p>
                </div>
              </div>
              <button 
                onClick={handleDismiss}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-8">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-5">
                  <div className="shrink-0 pt-1">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                      {step.icon}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-gray-100">{step.title}</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {step.description}
                    </p>
                    
                    {/* Visual Animation Placeholder */}
                    <div className="pt-3 flex items-center gap-2">
                      <div className="w-full h-1 bg-white/5 rounded-full relative overflow-hidden">
                        <motion.div 
                          className={`absolute inset-y-0 w-1/3 bg-[#C85A32] rounded-full`}
                          animate={step.gesture === 'left' ? { x: [-20, 100], opacity: [0, 1, 0] } : { x: [100, -20], opacity: [0, 1, 0] }}
                          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-6 bg-[#0A0A0A] border-t border-[#2A2A2A]">
              <button
                onClick={handleDismiss}
                className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors"
              >
                Got it, Captain
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
