export type CategoryType = 
  | 'Food & Dining' 
  | 'Bills & Utilities' 
  | 'Shopping' 
  | 'Transport' 
  | 'Entertainment' 
  | 'Food & Grocery' 
  | 'Income';

export interface BankSlipInfo {
  bankName: string;
  bankCode: 'KBANK' | 'SCB' | 'BBL' | 'KTB';
  slipType: string;
  status: string;
  amount: number;
  senderName: string;
  senderAccount?: string;
  recipientName: string;
  recipientPromptPay: string;
  refNo: string;
  dateTimeStr: string;
  rawLineMessageId?: string;
}

export interface Transaction {
  id: string;
  title: string;
  category: CategoryType;
  amount: number; // Negative for expense, positive for income
  date: string; // YYYY-MM-DD
  time: string; // e.g. "12:42 PM"
  verifiedFromSlip: boolean;
  paymentMethod: string;
  note?: string;
  slip?: BankSlipInfo;
  isRecurring?: boolean;
  recurringFrequency?: 'monthly' | 'weekly' | 'yearly';
  billingDay?: number;
  recurringLabel?: string;
}

export interface CategorySummary {
  category: CategoryType;
  amount: number;
  percentage: number;
  count: number;
  iconName: string;
}

export type ActiveTab = 'overview' | 'transactions' | 'insights' | 'review';

export interface BudgetGoal {
  monthlyGoal: number;
  month: string;
}

export interface SubscriptionItem {
  id: string;
  name: string;
  provider: string;
  category: CategoryType;
  amount: number;
  billingDay: number; // day of month 1-31
  frequency: 'monthly' | 'yearly';
  nextRenewalDate: string; // YYYY-MM-DD
  status: 'active' | 'cancelling' | 'paused';
  paymentMethod: string;
  iconName: string;
  color: string;
  planName?: string;
  remindDaysBefore?: number;
}
