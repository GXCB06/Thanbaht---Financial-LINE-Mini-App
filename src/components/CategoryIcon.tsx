import React from 'react';
import { CategoryType } from '../types/finance';
import { CATEGORY_META } from '../lib/categories';

interface CategoryIconProps {
  category: CategoryType | string;
  isIncome?: boolean;
  className?: string;
  size?: number;
}

/** Rounded tile tinted with the category's hue; the same hue is used in charts. */
export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  isIncome = false,
  className = 'w-9 h-9 rounded-[10px]',
  size = 19,
}) => {
  const meta = CATEGORY_META[(isIncome ? 'Income' : category) as CategoryType] ?? CATEGORY_META.Uncategorized;
  return (
    <div
      className={`${className} flex items-center justify-center shrink-0`}
      style={{
        color: meta.color,
        background: `color-mix(in srgb, ${meta.color} var(--tile-mix), var(--tile-base))`,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: size }}>
        {meta.icon}
      </span>
    </div>
  );
};
