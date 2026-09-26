import React, { useState } from 'react';
import { THANBAHT_MASCOT_URL, THANBAHT_MASCOT_FALLBACK } from '../data/mockData';
import { ActiveTab } from '../types/finance';

interface HeaderProps {
  activeTab: ActiveTab;
  onOpenMenu: () => void;
  onCloseApp: () => void;
  isFrameMode: boolean;
  onToggleFrameMode: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMenu,
  onCloseApp,
  isFrameMode,
  onToggleFrameMode,
  isDarkMode,
  onToggleDarkMode
}) => {
  const [imgSrc, setImgSrc] = useState(THANBAHT_MASCOT_URL);

  const getSubtitle = () => {
    switch (activeTab) {
      case 'overview':
        return null;
      case 'transactions':
        return 'Activity';
      case 'review':
        return 'Review';
      case 'insights':
        return 'Insights';
    }
  };

  const subtitle = getSubtitle();

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-[#F2F2F7]/90 dark:bg-[#1a1c1a]/90 backdrop-blur-xl transition-all border-b border-black/[0.04]">
      {/* iOS Status Bar & Dynamic Island */}
      <div className="h-11 w-full pt-1 px-7 flex items-center justify-between text-black dark:text-white select-none">
        <span className="text-[15px] font-semibold tracking-tight font-sans">9:41</span>
        
        {/* Dynamic Island */}
        <div className="w-[124px] h-[33px] bg-black rounded-full mx-auto self-start mt-0.5 flex items-center justify-between px-3 shadow-inner">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1c1c1e] border border-neutral-800"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#1c1c1e] border border-neutral-800"></div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-1.5 self-center">
          {/* Cellular */}
          <svg className="w-4 h-3 fill-current" viewBox="0 0 17 12">
            <rect height="3" rx="0.8" width="3" x="0" y="9"></rect>
            <rect height="6" rx="0.8" width="3" x="4.5" y="6"></rect>
            <rect height="9" rx="0.8" width="3" x="9" y="3"></rect>
            <rect height="12" rx="0.8" width="3" x="13.5" y="0"></rect>
          </svg>
          {/* Wifi */}
          <svg className="w-4 h-3 fill-current" viewBox="0 0 16 12">
            <path d="M8 9.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM4.9 7.7a4.5 4.5 0 016.2 0 .7.7 0 001-.9 5.9 5.9 0 00-8.2 0 .7.7 0 001 .9zm-3.2-3a9 9 0 0112.6 0 .7.7 0 001-.9 10.4 10.4 0 00-14.6 0 .7.7 0 001 .9z"></path>
          </svg>
          {/* Battery */}
          <div className="flex items-center">
            <div className="w-[22px] h-[11.5px] rounded-[3.5px] border border-current p-[1px] flex items-center">
              <div className="h-full w-full bg-current rounded-[2px]"></div>
            </div>
            <div className="w-[1px] h-[4px] bg-current rounded-r-sm ml-[0.5px]"></div>
          </div>
        </div>
      </div>

      {/* LINE Mini App Navigation Bar */}
      <div className="h-11 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white border border-black/5 flex items-center justify-center shadow-xs shrink-0">
            <img 
              alt="Thanbaht Logo" 
              className="w-full h-full object-cover" 
              src={imgSrc}
              onError={() => setImgSrc(THANBAHT_MASCOT_FALLBACK)}
            />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="text-[15px] font-semibold tracking-tight text-black dark:text-white">Thanbaht</span>
              <span className="text-[13px] font-normal text-[#8E8E93] leading-none">(ธัญบาท)</span>
            </div>
            {subtitle && (
              <span className="text-[11px] font-medium text-[#8E8E93] mt-0.5 leading-tight">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* LINE Mini App Controls */}
        <div className="flex items-center gap-1.5">
          {/* Dark / Light Mode Switch */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="w-8 h-8 rounded-full bg-[#E5E5EA]/80 active:bg-[#D1D1D6] dark:bg-neutral-800 flex items-center justify-center text-[#1C1C1E] dark:text-neutral-200 transition"
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Frame mode switch helper */}
          <button 
            onClick={onToggleFrameMode}
            title={isFrameMode ? "Expand to Full Mobile View" : "View in Phone Frame"}
            className="hidden sm:flex text-[11px] font-medium px-2 py-1 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-neutral-600 dark:text-neutral-300 active:scale-95 transition items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">
              {isFrameMode ? 'fullscreen' : 'smartphone'}
            </span>
            <span>{isFrameMode ? 'Expand' : 'Phone'}</span>
          </button>

          <button 
            onClick={onOpenMenu}
            className="w-8 h-8 rounded-full bg-[#E5E5EA]/80 active:bg-[#D1D1D6] dark:bg-neutral-800 flex items-center justify-center text-[#1C1C1E] dark:text-neutral-200 transition"
            aria-label="More actions"
          >
            <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          </button>
          <button 
            onClick={onCloseApp}
            className="w-8 h-8 rounded-full bg-[#E5E5EA]/80 active:bg-[#D1D1D6] dark:bg-neutral-800 flex items-center justify-center text-[#1C1C1E] dark:text-neutral-200 transition"
            aria-label="Close app"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>
    </header>
  );
};
