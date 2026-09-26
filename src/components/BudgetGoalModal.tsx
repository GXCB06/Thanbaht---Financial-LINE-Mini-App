import React, { useState } from 'react';

interface BudgetGoalModalProps {
  currentGoal: number;
  totalSpent: number;
  month: string;
  onSave: (newGoal: number) => void;
  onClose: () => void;
}

export const BudgetGoalModal: React.FC<BudgetGoalModalProps> = ({
  currentGoal,
  totalSpent,
  month,
  onSave,
  onClose
}) => {
  const [goal, setGoal] = useState(currentGoal.toString());
  const presets = [15000, 20000, 22000, 25000, 30000];

  const parsedGoal = parseFloat(goal) || 0;
  const remaining = Math.max(0, parsedGoal - totalSpent);
  const percentSpent = parsedGoal > 0 ? ((totalSpent / parsedGoal) * 100).toFixed(1) : '0';
  const dailyPace = remaining > 0 ? Math.round(remaining / 7) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedGoal > 0) {
      onSave(parsedGoal);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-neutral-900 rounded-[24px] max-w-sm w-full p-5 shadow-2xl border border-black/10 dark:border-neutral-800 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#E8F9EE] dark:bg-emerald-950/60 text-[#06C755] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">track_changes</span>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-black dark:text-white leading-tight">
                Monthly Budget Goal
              </h3>
              <span className="text-[11px] text-[#8E8E93]">{month}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-black dark:hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick presets */}
          <div>
            <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1.5">
              Quick Suggestions
            </label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setGoal(val.toString())}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition ${
                    parsedGoal === val
                      ? 'bg-[#06C755] text-white shadow-xs font-semibold'
                      : 'bg-[#F2F2F7] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  ฿{val.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">
              Budget Target (THB)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-lg font-bold text-neutral-400">
                ฿
              </span>
              <input
                type="number"
                step="500"
                min="1000"
                required
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-lg font-bold text-black dark:text-white font-sans tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
              />
            </div>
          </div>

          {/* Live projection preview */}
          <div className="p-3 bg-[#F2F2F7] dark:bg-neutral-800/70 rounded-xl space-y-1.5 text-[12px]">
            <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
              <span>Current Spending:</span>
              <span className="font-semibold text-black dark:text-white font-sans tabular-nums">
                ฿{totalSpent.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
              <span>Budget Utilized:</span>
              <span className={`font-semibold font-sans tabular-nums ${
                parseFloat(percentSpent) > 100 ? 'text-[#FF3B30]' : 'text-[#06C755]'
              }`}>
                {percentSpent}%
              </span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-300 pt-1 border-t border-neutral-200 dark:border-neutral-700">
              <span>Remaining for 7 days:</span>
              <span className="font-bold text-black dark:text-white font-sans tabular-nums">
                ฿{remaining.toLocaleString()} (~฿{dailyPace}/day)
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-semibold text-[13px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#06C755] hover:bg-[#05B34C] text-white font-semibold text-[13px] shadow-xs active:scale-98 transition"
            >
              Set Budget
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
