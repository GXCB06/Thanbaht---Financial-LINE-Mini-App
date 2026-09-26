import React from 'react';
import { ActiveTab } from '../types/finance';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenAddMoment: () => void;
  reviewBadgeCount: number;
}

const TABS: { tab: ActiveTab; icon: string; label: string }[] = [
  { tab: 'overview', icon: 'home', label: 'Home' },
  { tab: 'transactions', icon: 'format_list_bulleted', label: 'Activity' },
  { tab: 'review', icon: 'inbox', label: 'Review' },
  { tab: 'insights', icon: 'bar_chart', label: 'Insights' },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, onOpenAddMoment, reviewBadgeCount }) => {
  const tabButton = ({ tab, icon, label }: (typeof TABS)[number]) => {
    const active = activeTab === tab;
    return (
      <button
        key={tab}
        onClick={() => onTabChange(tab)}
        aria-current={active ? 'page' : undefined}
        className={`flex flex-col items-center justify-center flex-1 min-h-[44px] py-1 transition-colors ${
          active ? 'text-[#008A3D] dark:text-[#06C755] font-semibold' : 'text-[#6E6E73] dark:text-neutral-400 hover:text-[#1C1C1E] dark:hover:text-white'
        }`}
      >
        <span className="relative">
          <span className={`material-symbols-outlined text-[24px] ${active ? 'icon-fill' : ''}`}>{icon}</span>
          {tab === 'review' && reviewBadgeCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-[#A05A12] text-white text-[10px] font-bold px-1.5 min-w-[17px] h-[17px] rounded-full flex items-center justify-center border-2 border-white dark:border-[#1C1C1E]">
              {reviewBadgeCount}
            </span>
          )}
        </span>
        <span className="text-[11px] mt-0.5 tracking-tight font-medium">{label}</span>
      </button>
    );
  };

  return (
    <nav className="shrink-0 z-40 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border-t border-[#E5E5EA] dark:border-neutral-800 pb-[env(safe-area-inset-bottom)] transition-colors">
      <div className="h-[58px] flex items-center justify-between px-3">
        {TABS.slice(0, 2).map(tabButton)}

        {/* Centre add button */}
        <div className="flex-1 flex justify-center items-center">
          <button
            onClick={onOpenAddMoment}
            className="w-[52px] h-[52px] rounded-[18px] bg-[#008A3D] hover:bg-[#007333] text-white flex items-center justify-center shadow-[0_6px_16px_rgba(0,138,61,0.36)] -translate-y-3.5 active:scale-90 transition-all"
            aria-label="Add money moment"
            title="Add money moment"
          >
            <span className="material-symbols-outlined text-[30px] leading-none">add</span>
          </button>
        </div>

        {TABS.slice(2).map(tabButton)}
      </div>
    </nav>
  );
};
