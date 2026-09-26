export type CategoryType =
  | 'Food & Dining'
  | 'Groceries'
  | 'Transport'
  | 'Shopping'
  | 'Bills & Utilities'
  | 'Entertainment'
  | 'Income'
  | 'Transfer' // between your own accounts: shown, never counted
  | 'Uncategorized';

/** Where a record came from. Shown as a small icon on every row. */
export type TransactionSource = 'slip' | 'voice' | 'text' | 'manual';

export type AccountId = 'kbank' | 'scb' | 'ktb' | 'tmn' | 'cash';

/** Why the bot parked a record in Review instead of logging it. */
export type ReviewKind = 'who' | 'dup' | 'amount' | 'recurring';

export interface BankSlipInfo {
  bankName: string;
  bankCode: 'KBANK' | 'SCB' | 'BBL' | 'KTB' | 'TMN';
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
  time: string; // 24h "HH:mm"
  /** True only when the slip's QR / bank ref was checked, not merely read. */
  verifiedFromSlip: boolean;
  paymentMethod: string;
  account: AccountId;
  source: TransactionSource;
  status: 'ok' | 'review' | 'deleted';
  review?: { kind: ReviewKind; dupOf?: string };
  /** What the user said or typed, for voice / text records. */
  said?: string;
  note?: string;
  slip?: BankSlipInfo;
  isRecurring?: boolean;
  recurringFrequency?: 'monthly' | 'weekly' | 'yearly';
  billingDay?: number;
  recurringLabel?: string;
  excluded?: boolean;
  split?: { n: number };
  /** Category before it was marked as an own-account transfer. */
  prevCategory?: CategoryType;
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
