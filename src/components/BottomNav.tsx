import React from 'react';
import { ActiveTab } from '../types/finance';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenAddMoment: () => void;
  reviewBadgeCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenAddMoment,
  reviewBadgeCount = 3
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border-t border-[#E5E5EA] dark:border-neutral-800 transition-colors">
      <div className="max-w-md mx-auto h-[58px] flex items-center justify-between px-3">
        {/* Tab 1: Home */}
        <button
          onClick={() => onTabChange('overview')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'overview'
              ? 'text-[#008A3D] dark:text-[#06C755] font-semibold'
              : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
          }`}
          aria-label="Home tab"
        >
          <span className="material-symbols-outlined text-[24px]">home</span>
          <span className="text-[11px] mt-0.5 tracking-tight font-medium">Home</span>
        </button>

        {/* Tab 2: Activity */}
        <button
          onClick={() => onTabChange('transactions')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'transactions'
              ? 'text-[#008A3D] dark:text-[#06C755] font-semibold'
              : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
          }`}
          aria-label="Activity tab"
        >
          <span className="material-symbols-outlined text-[24px]">format_list_bulleted</span>
          <span className="text-[11px] mt-0.5 tracking-tight font-medium">Activity</span>
        </button>

        {/* CENTER PROMINENT ADD BUTTON (Squircle +) */}
        <div className="flex-1 flex justify-center items-center">
          <button
            onClick={onOpenAddMoment}
            className="w-[52px] h-[52px] rounded-[18px] bg-[#008A3D] hover:bg-[#007333] text-white flex items-center justify-center shadow-[0_6px_16px_rgba(0,138,61,0.36)] -translate-y-3.5 active:scale-90 transition-all cursor-pointer focus:outline-hidden"
            aria-label="Add money moment"
            title="Add money moment"
          >
            <span className="material-symbols-outlined text-[30px] font-normal leading-none">add</span>
          </button>
        </div>

        {/* Tab 3: Review (with badge 3) */}
        <button
          onClick={() => onTabChange('review')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            activeTab === 'review'
              ? 'text-[#008A3D] dark:text-[#06C755] font-semibold'
              : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
          }`}
          aria-label="Review tab"
        >
          <div className="relative">
            <span className="material-symbols-outlined text-[24px]">inbox</span>
            {reviewBadgeCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-[#A05A12] text-white text-[10px] font-bold px-1.5 min-w-[17px] h-[17px] rounded-full flex items-center justify-center shadow-xs">
                {reviewBadgeCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight font-medium">Review</span>
        </button>

        {/* Tab 4: Insights */}
        <button
          onClick={() => onTabChange('insights')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'insights'
              ? 'text-[#008A3D] dark:text-[#06C755] font-semibold'
              : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
          }`}
          aria-label="Insights tab"
        >
          <span className="material-symbols-outlined text-[24px]">bar_chart</span>
          <span className="text-[11px] mt-0.5 tracking-tight font-medium">Insights</span>
        </button>
      </div>

      {/* iOS Home Indicator Pill */}
      <div className="h-4 w-full flex items-center justify-center pb-1">
        <div className="w-[134px] h-[4px] bg-black/40 dark:bg-white/40 rounded-full"></div>
      </div>
    </nav>
  );
};
