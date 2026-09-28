import React from 'react';
import { MascotAvatar } from './Mascot';
import { useLang } from '../lib/i18n';

interface MoreMenuModalProps {
  onClose: () => void;
  /** Only offered in the demo: real data must never be replaced by sample data. */
  onResetData?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  privacy: boolean;
  onTogglePrivacy: () => void;
}

export const MoreMenuModal: React.FC<MoreMenuModalProps> = ({
  onClose,
  onResetData,
  isDarkMode,
  onToggleDarkMode,
  privacy,
  onTogglePrivacy
}) => {
  const { lang, toggleLang, t } = useLang();
  return (
    <div
      className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-neutral-900 w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[24px] p-5 shadow-2xl border border-black/10 dark:border-white/10 space-y-4 animate-slideUp">
        {/* Grab bar for mobile */}
        <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto -mt-1 sm:hidden"></div>

        <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <MascotAvatar size={40} />
          <div>
            <h3 className="text-[16px] font-bold text-black dark:text-white leading-tight">
              Thanbaht (ธัญบาท)
            </h3>
            <span className="text-[12px] text-[#8E8E93]">LINE Mini App v2.4.0</span>
          </div>
        </div>

        <div className="space-y-1 text-[14px]">
          {/* Privacy: blur every amount */}
          <button
            onClick={onTogglePrivacy}
            className="w-full px-3 py-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between text-left transition"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-[#4A63E0]">{privacy ? 'visibility_off' : 'visibility'}</span>
              <span className="font-medium text-black dark:text-white">{t('more.hideAmountsInPublic')}</span>
            </div>
            <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {privacy ? t('more.on') : t('more.off')}
            </span>
          </button>

          {/* Dark / Light Mode Switch */}
          <button
            onClick={() => {
              onToggleDarkMode();
            }}
            className="w-full px-3 py-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between text-left transition"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-amber-500">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
              <span className="font-medium text-black dark:text-white">
                {isDarkMode ? t('more.switchToLight') : t('more.switchToDark')}
              </span>
            </div>
            <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {isDarkMode ? t('more.dark') : t('more.light')}
            </span>
          </button>

          {/* Language switch */}
          <button
            onClick={toggleLang}
            className="w-full px-3 py-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between text-left transition"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-[#008A3D]">translate</span>
              <span className="font-medium text-black dark:text-white">{t('more.language')}</span>
            </div>
            <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {lang === 'th' ? 'ไทย' : 'English'}
            </span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              alert('Copied LINE Mini App share link!');
              onClose();
            }}
            className="w-full px-3 py-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-3 text-left transition"
          >
            <span className="material-symbols-outlined text-[20px] text-[#06C755]">share</span>
            <span className="font-medium text-black dark:text-white">{t('more.shareToLine')}</span>
          </button>

          {onResetData && (
          <button
            onClick={() => {
              onResetData();
              onClose();
            }}
            className="w-full px-3 py-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-3 text-left transition"
          >
            <span className="material-symbols-outlined text-[20px] text-[#007AFF]">restart_alt</span>
            <span className="font-medium text-black dark:text-white">{t('more.resetDemo')}</span>
          </button>
          )}

          <div className="p-3 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-[12px] text-[#8E8E93] leading-relaxed mt-2">
            💡 <strong>Thanbaht</strong> harmonizes Japanese minimalist design with the LINE chat ecosystem, bringing effortless slip verification and serene money management.
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white font-semibold text-[14px] active:scale-98 transition"
        >
          {t('more.close')}
        </button>
      </div>
    </div>
  );
};
