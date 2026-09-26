import React from 'react';
import { CategoryType } from '../types/finance';
import { CATEGORY_META } from '../lib/categories';

interface CategoryIconProps {
  category: CategoryType | string;
  isIncome?: boolean;
  className?: string;
  size?: number;
  /** Tint the tile with the category's hue (charts use the same hue). The default is the calm neutral tile. */
  tinted?: boolean;
}

/** Category tile: neutral grey with a dark icon, and a soft green one for income. */
export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  isIncome = false,
  className = 'w-9 h-9 rounded-[10px]',
  size = 19,
  tinted = false,
}) => {
  const income = isIncome || category === 'Income';
  const meta = CATEGORY_META[(income ? 'Income' : category) as CategoryType] ?? CATEGORY_META.Uncategorized;

  if (tinted) {
    return (
      <div
        className={`${className} flex items-center justify-center shrink-0`}
        style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} var(--tile-mix), var(--tile-base))` }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: size }}>
          {meta.icon}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${className} shrink-0 flex items-center justify-center border ${
        income
          ? 'bg-[#E8F9EE] dark:bg-emerald-950/50 border-[#06C755]/15 text-[#06C755]'
          : 'bg-[#F5F5F7] dark:bg-neutral-800 border-black/[0.05] dark:border-white/10 text-[#1C1C1E] dark:text-neutral-200'
      }`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: size }}>
        {meta.icon}
      </span>
    </div>
  );
};
