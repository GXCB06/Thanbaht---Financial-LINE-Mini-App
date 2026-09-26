import React from 'react';
import { ActiveTab } from '../types/finance';
import { MascotAvatar } from './Mascot';

interface HeaderProps {
  activeTab: ActiveTab;
  /** Running inside LINE: LINE draws its own header with ⋯ and ✕. */
  inLine: boolean;
  onOpenMenu: () => void;
  onCloseApp: () => void;
  isFrameMode: boolean;
  onToggleFrameMode: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  privacy: boolean;
  onTogglePrivacy: () => void;
}

const SUBTITLE: Record<ActiveTab, string | null> = {
  overview: null,
  transactions: 'Activity',
  review: 'Review',
  insights: 'Insights',
};

const iconBtn =
  'w-8 h-8 rounded-full bg-[#E5E5EA]/80 active:bg-[#D1D1D6] dark:bg-neutral-800 flex items-center justify-center text-[#1C1C1E] dark:text-neutral-200 transition';

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  inLine,
  onOpenMenu,
  onCloseApp,
  isFrameMode,
  onToggleFrameMode,
  isDarkMode,
  onToggleDarkMode,
  privacy,
  onTogglePrivacy,
}) => {
  const subtitle = SUBTITLE[activeTab];
  const showDeviceChrome = isFrameMode && !inLine;

  return (
    <header className="shrink-0 z-40 bg-[#F2F2F7]/90 dark:bg-[#1a1c1a]/90 backdrop-blur-xl transition-all border-b border-black/[0.04] dark:border-white/[0.05]">
      {/* Device status bar: desktop phone-frame preview only */}
      {showDeviceChrome && (
        <div className="hidden sm:flex h-11 w-full pt-1 px-7 items-center justify-between text-black dark:text-white select-none" aria-hidden="true">
          <span className="text-[15px] font-semibold tracking-tight">9:41</span>
          <div className="w-[124px] h-[33px] bg-black rounded-full mx-auto self-start mt-0.5" />
          <div className="flex items-center gap-1.5 self-center">
            <svg className="w-4 h-3 fill-current" viewBox="0 0 17 12">
              <rect height="3" rx="0.8" width="3" x="0" y="9" />
              <rect height="6" rx="0.8" width="3" x="4.5" y="6" />
              <rect height="9" rx="0.8" width="3" x="9" y="3" />
              <rect height="12" rx="0.8" width="3" x="13.5" y="0" />
            </svg>
            <div className="w-[22px] h-[11.5px] rounded-[3.5px] border border-current p-[1px] flex items-center">
              <div className="h-full w-full bg-current rounded-[2px]" />
            </div>
          </div>
        </div>
      )}

      <div className="h-12 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <MascotAvatar size={32} />
          <div className="flex flex-col text-left min-w-0">
            <div className="flex items-baseline gap-1.5 leading-none whitespace-nowrap">
              <span className="text-[15px] font-semibold tracking-tight text-black dark:text-white">Thanbaht</span>
              <span className="text-[13px] font-normal text-[#6E6E73] dark:text-neutral-400 leading-none">(ธัญบาท)</span>
            </div>
            {subtitle && <span className="text-[11px] font-medium text-[#6E6E73] dark:text-neutral-400 mt-0.5 leading-tight">{subtitle}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onTogglePrivacy}
            className={iconBtn}
            aria-label={privacy ? 'Show amounts' : 'Hide amounts'}
            aria-pressed={privacy}
            title={privacy ? 'Show amounts' : 'Hide amounts'}
          >
            <span className="material-symbols-outlined text-[18px]">{privacy ? 'visibility_off' : 'visibility'}</span>
          </button>
          <button onClick={onToggleDarkMode} className={iconBtn} aria-label="Toggle theme" title={isDarkMode ? 'Light mode' : 'Dark mode'}>
            <span className="material-symbols-outlined text-[18px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>

          {!inLine && (
            <button
              onClick={onToggleFrameMode}
              title={isFrameMode ? 'Expand to full view' : 'View in phone frame'}
              aria-label={isFrameMode ? 'Expand to full view' : 'View in phone frame'}
              className={`hidden sm:flex ${iconBtn}`}
            >
              <span className="material-symbols-outlined text-[18px]">{isFrameMode ? 'fullscreen' : 'smartphone'}</span>
            </button>
          )}

          {inLine ? (
            <button onClick={onOpenMenu} className={iconBtn} aria-label="Settings">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </button>
          ) : (
            <>
              {/* Stand-ins for LINE's native ⋯ / ✕ in the browser preview */}
              <button onClick={onOpenMenu} className={iconBtn} aria-label="More actions">
                <span className="material-symbols-outlined text-[18px]">more_horiz</span>
              </button>
              <button onClick={onCloseApp} className={iconBtn} aria-label="Close">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
