import React from 'react';
import { Check } from 'lucide-react';
import { StepperStep } from './buyPawnTypes';

interface BuyPawnStepperProps {
  steps: StepperStep[];
  currentStepIndex: number;
}

export const BuyPawnStepper: React.FC<BuyPawnStepperProps> = ({ steps, currentStepIndex }) => {
  return (
    <div className="flex items-center gap-2 mb-8 px-2">
      {steps.map((s, i) => {
        const isActive = i === currentStepIndex;
        const isPast = i < currentStepIndex;
        return (
          <React.Fragment key={s.id}>
            <div
              className={`flex items-center gap-2 ${
                isActive ? 'text-[#C85A32]' : isPast ? 'text-emerald-600' : 'text-gray-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition ${
                  isActive
                    ? 'border-[#C85A32] bg-[#FDF0EA] text-[#C85A32]'
                    : isPast
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-600'
                    : 'border-gray-300 bg-white text-gray-400'
                }`}
              >
                {isPast ? <Check className="w-3 h-3 stroke-[3]" /> : i + 1}
              </div>
              <span className="text-xs font-semibold hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 ${
                  i < currentStepIndex ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
