// Types shared by the LINE webhook. Only plain TypeScript, no Deno or Node APIs,
// so the same code runs in Supabase Edge Functions and in the local tests.

export type Category =
  | 'Food & Dining'
  | 'Groceries'
  | 'Transport'
  | 'Shopping'
  | 'Bills & Utilities'
  | 'Entertainment'
  | 'Income'
  | 'Transfer'
  | 'Uncategorized';

export type AccountId = 'kbank' | 'scb' | 'ktb' | 'bbl' | 'bay' | 'ttb' | 'gsb' | 'tmn' | 'cash' | 'other';
export type Source = 'slip' | 'voice' | 'text' | 'manual';
export type Status = 'ok' | 'review' | 'deleted';
export type ReviewKind = 'who' | 'dup' | 'amount' | 'recurring';

export interface Profile {
  line_user_id: string;
  display_name: string | null;
  owner_names: string[];
  monthly_budget: number;
}

/** A row of public.transactions. */
export interface TxRow {
  id: string;
  user_id: string;
  title: string;
  category: Category;
  amount: number; // signed: expenses negative
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  account: AccountId;
  source: Source;
  status: Status;
  review_kind: ReviewKind | null;
  review_dup_of: string | null;
  said: string | null;
  note: string | null;
  trans_ref: string | null;
  verified: boolean;
  slip: SlipDetails | null;
  image_path: string | null;
  excluded: boolean;
  split_n: number | null;
  prev_category: Category | null;
  allow_dup: boolean;
  created_at: string;
}

export type NewTx = Omit<TxRow, 'id' | 'created_at'>;

/** Stored in transactions.slip. Field names match BankSlipInfo in the Mini App. */
export interface SlipDetails {
  bankName: string;
  slipType: string;
  status: string;
  amount: number;
  senderName: string;
  senderAccount?: string;
  recipientName: string;
  recipientPromptPay: string;
  refNo: string;
  dateTimeStr: string;
}

export interface SlipRecord {
  message_id: string;
  user_id: string;
  set_id: string | null;
  set_index: number | null;
  set_total: number | null;
  image_path: string | null;
  status: 'ok' | 'review' | 'failed';
  transaction_id: string | null;
  error: string | null;
}

/** What the model read off a bank slip. */
export interface SlipReading {
  isSlip: boolean;
  bank: AccountId | null;
  /** 'out' = the user paid someone. 'in' = money received. */
  direction: 'out' | 'in';
  amount: number | null;
  senderName: string | null;
  senderAccount: string | null;
  receiverName: string | null;
  receiverAccount: string | null;
  ref: string | null;
  /** Bangkok local time, "YYYY-MM-DDTHH:mm". */
  datetime: string | null;
  memo: string | null;
  confidence: number;
}

/* ---------------- LINE webhook payloads (only the fields we use) ---------------- */

export interface LineSource {
  type: 'user' | 'group' | 'room';
  userId?: string;
}

interface BaseEvent {
  type: string;
  webhookEventId?: string;
  source?: LineSource;
  replyToken?: string;
  timestamp?: number;
  deliveryContext?: { isRedelivery: boolean };
}

export interface MessageEvent extends BaseEvent {
  type: 'message';
  message:
    | { type: 'text'; id: string; text: string }
    | {
        type: 'image';
        id: string;
        contentProvider?: { type: 'line' | 'external' };
        imageSet?: { id: string; index: number; total: number };
      }
    | { type: 'audio'; id: string; duration?: number; contentProvider?: { type: 'line' | 'external' } }
    | { type: string; id: string };
}

export interface PostbackEvent extends BaseEvent {
  type: 'postback';
  postback: { data: string };
}

export interface FollowEvent extends BaseEvent {
  type: 'follow';
}

export type LineEvent = MessageEvent | PostbackEvent | FollowEvent | (BaseEvent & { type: string });

export interface WebhookBody {
  destination?: string;
  events: LineEvent[];
}

/** A LINE message object (text, flex, ...) as sent to the Messaging API. */
export type LineMessage = Record<string, unknown> & { type: string };
