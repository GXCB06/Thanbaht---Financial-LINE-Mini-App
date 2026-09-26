import React from 'react';
import { CategoryType } from '../types/finance';

interface CategoryIconProps {
  category: CategoryType | string;
  isIncome?: boolean;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  isIncome = false,
  className = "w-9 h-9 rounded-[10px]",
  size = 18
}) => {
  if (isIncome || category === 'Income') {
    return (
      <div className={`${className} bg-[#E8F9EE] border border-[#06C755]/15 flex items-center justify-center text-[#06C755] shrink-0`}>
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect height="12" rx="2" width="18" x="3" y="6"></rect>
          <circle cx="12" cy="12" r="2.5"></circle>
          <path d="M3 10a2 2 0 0 0 2-2M21 10a2 2 0 0 1-2-2M3 14a2 2 0 0 1 2 2M21 14a2 2 0 0 0-2 2"></path>
        </svg>
      </div>
    );
  }

  const getIcon = () => {
    switch (category) {
      case 'Food & Dining':
        return (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M18 2v20M21 2v4a3 3 0 0 1-3 3M3 2v7a4 4 0 0 0 4 4v9M7 2v4"></path>
          </svg>
        );
      case 'Transport':
        return (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M5 17h14M7 9l1.5-4h7L17 9M4 17V10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M4 17a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2M15 17a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2"></path>
            <circle cx="7.5" cy="13.5" r="1" fill="currentColor"></circle>
            <circle cx="16.5" cy="13.5" r="1" fill="currentColor"></circle>
          </svg>
        );
      case 'Shopping':
        return (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        );
      case 'Bills & Utilities':
        return (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        );
      case 'Entertainment':
        return (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
            <line x1="7" y1="2" x2="7" y2="22"></line>
            <line x1="17" y1="2" x2="17" y2="22"></line>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="2" y1="7" x2="7" y2="7"></line>
            <line x1="2" y1="17" x2="7" y2="17"></line>
            <line x1="17" y1="17" x2="22" y2="17"></line>
            <line x1="17" y1="7" x2="22" y2="7"></line>
          </svg>
        );
      default:
        return (
          <span className="material-symbols-outlined" style={{ fontSize: `${size}px` }}>
            payments
          </span>
        );
    }
  };

  return (
    <div className={`${className} bg-[#F2F2F7] dark:bg-neutral-800 border border-black/5 dark:border-white/5 flex items-center justify-center text-[#1C1C1E] dark:text-neutral-200 shrink-0`}>
      {getIcon()}
    </div>
  );
};
