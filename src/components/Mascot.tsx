import React from 'react';

/** Thanbaht's periwinkle wallet. Appears only when the assistant speaks. */
export const Mascot: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={`shrink-0 ${className}`} aria-hidden="true">
    <rect x="5" y="12" width="38" height="30" rx="10" fill="#6B8CFF" />
    <path d="M9 14l22-8a4 4 0 0 1 5 3l1 4" fill="#8FA8FF" />
    <rect x="30" y="22" width="15" height="11" rx="5.5" fill="#4A63E0" />
    <circle cx="37" cy="27.5" r="2.2" fill="#fff" />
    <circle cx="16" cy="26" r="2.6" fill="#1B1F3B" />
    <circle cx="25" cy="26" r="2.6" fill="#1B1F3B" />
    <circle cx="16.8" cy="25.2" r=".9" fill="#fff" />
    <circle cx="25.8" cy="25.2" r=".9" fill="#fff" />
    <path d="M17.5 32q3 2.6 6 0" stroke="#1B1F3B" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <circle cx="12" cy="31" r="2" fill="#FF9DB5" opacity=".7" />
    <circle cx="29" cy="31" r="2" fill="#FF9DB5" opacity=".7" />
  </svg>
);

/** Round avatar version for headers. */
export const MascotAvatar: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <div
    className="rounded-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0 overflow-hidden"
    style={{ width: size, height: size }}
  >
    <Mascot size={size * 0.82} />
  </div>
);
