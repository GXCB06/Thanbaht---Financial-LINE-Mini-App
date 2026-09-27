import { AccountId, CategoryType } from '../types/finance';

interface CategoryMeta {
  icon: string; // Material Symbols name
  /** CSS variable holding the category hue (defined for light + dark in index.css). */
  color: string;
}

export const CATEGORY_META: Record<CategoryType, CategoryMeta> = {
  'Food & Dining': { icon: 'restaurant', color: 'var(--c-food)' },
  Groceries: { icon: 'shopping_cart', color: 'var(--c-grocery)' },
  Transport: { icon: 'directions_car', color: 'var(--c-transport)' },
  Shopping: { icon: 'shopping_bag', color: 'var(--c-shopping)' },
  'Bills & Utilities': { icon: 'bolt', color: 'var(--c-bills)' },
  Entertainment: { icon: 'movie', color: 'var(--c-fun)' },
  Income: { icon: 'payments', color: 'var(--c-income)' },
  Transfer: { icon: 'swap_horiz', color: 'var(--c-transfer)' },
  Uncategorized: { icon: 'help', color: 'var(--c-unknown)' },
};

/** Categories that count as spending, in their fixed chart order. */
export const SPEND_CATEGORIES: CategoryType[] = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills & Utilities',
  'Entertainment',
];

/** Everything a user can pick when editing a record. */
export const EDITABLE_CATEGORIES: CategoryType[] = [...SPEND_CATEGORIES, 'Income', 'Transfer'];

interface AccountMeta {
  short: string;
  name: string;
  full: string;
  bg: string;
  fg: string;
}

export const ACCOUNTS: Record<AccountId, AccountMeta> = {
  kbank: { short: 'K', name: 'KBank', full: 'K PLUS ··8941', bg: '#138F2D', fg: '#FFFFFF' },
  scb: { short: 'SCB', name: 'SCB', full: 'SCB EASY ··2207', bg: '#4E2A84', fg: '#FFFFFF' },
  ktb: { short: 'KTB', name: 'Krungthai', full: 'Krungthai NEXT ··5530', bg: '#1BA5E1', fg: '#06283D' },
  tmn: { short: 'TM', name: 'TrueMoney', full: 'TrueMoney Wallet', bg: '#F58220', fg: '#2B1300' },
  bbl: { short: 'BBL', name: 'Bangkok Bank', full: 'Bualuang mBanking', bg: '#1E4598', fg: '#FFFFFF' },
  bay: { short: 'BAY', name: 'Krungsri', full: 'KMA Krungsri', bg: '#F5B301', fg: '#3A2A00' },
  ttb: { short: 'TTB', name: 'ttb', full: 'ttb touch', bg: '#0066B3', fg: '#FFFFFF' },
  gsb: { short: 'GSB', name: 'GSB', full: 'MyMo GSB', bg: '#E1177B', fg: '#FFFFFF' },
  other: { short: 'BANK', name: 'Other bank', full: 'Other bank', bg: '#6E6E73', fg: '#FFFFFF' },
  cash: { short: '฿', name: 'Cash', full: 'Cash', bg: '#6E6E73', fg: '#FFFFFF' },
};
