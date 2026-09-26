import React from 'react';

interface SheetProps {
  onClose: () => void;
  children: React.ReactNode;
  /** 'sheet' slides up from the bottom; 'dialog' is centred. */
  variant?: 'sheet' | 'dialog';
  className?: string;
}

/**
 * Overlay that stays inside the app frame (absolute, not fixed), so it never
 * escapes the phone preview on desktop.
 */
export const Sheet: React.FC<SheetProps> = ({ onClose, children, variant = 'sheet', className = '' }) => (
  <div
    className={`absolute inset-0 z-50 flex justify-center bg-black/45 backdrop-blur-[2px] animate-fadeIn ${
      variant === 'sheet' ? 'items-end' : 'items-center p-4'
    }`}
    role="dialog"
    aria-modal="true"
  >
    <div className="absolute inset-0" onClick={onClose} />
    <div
      className={`relative z-10 w-full bg-white dark:bg-neutral-900 shadow-2xl border-black/5 dark:border-white/10 max-h-[90%] overflow-y-auto ${
        variant === 'sheet'
          ? 'rounded-t-[28px] border-t px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] animate-slideUp'
          : 'max-w-sm rounded-[22px] border p-5 animate-scaleIn'
      } ${className}`}
    >
      {variant === 'sheet' && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="block w-10 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full mx-auto mb-3"
        />
      )}
      {children}
    </div>
  </div>
);

export const Switch: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    className={`relative w-[46px] h-7 rounded-full shrink-0 transition-colors ${
      on ? 'bg-[#008A3D] dark:bg-[#06C755]' : 'bg-neutral-300 dark:bg-neutral-700'
    }`}
  >
    <span
      className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-transform ${
        on ? 'translate-x-[18px]' : ''
      }`}
    />
  </span>
);
