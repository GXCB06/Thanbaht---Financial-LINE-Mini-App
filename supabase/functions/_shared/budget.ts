import type { Category } from './types.ts';

// Share of the monthly budget each category gets. Mirrors CATEGORY_BUDGET_SHARE in the
// Mini App (src/data/mockData.ts), which sums to 1.
const SHARE: Partial<Record<Category, number>> = {
  'Food & Dining': 6500 / 22000,
  Groceries: 2500 / 22000,
  Transport: 2000 / 22000,
  Shopping: 3500 / 22000,
  'Bills & Utilities': 5500 / 22000,
  Entertainment: 2000 / 22000,
};

export const SPEND_CATEGORIES = Object.keys(SHARE) as Category[];

export const categoryBudget = (category: Category, monthlyBudget: number) => Math.round((SHARE[category] ?? 0) * monthlyBudget);
