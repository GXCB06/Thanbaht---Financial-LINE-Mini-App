// Exporting the user's own records to a plain CSV file: a spreadsheet, or a tax-season backup.

import { Transaction } from '../types/finance';
import { ACCOUNTS } from './categories';

const HEADER = ['Date', 'Time', 'Title', 'Category', 'Amount', 'Account', 'Status', 'Source', 'Note'];

/** Quotes a field only when it needs it, per RFC 4180. */
const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per record, oldest first. Amount keeps its sign: negative for expenses, positive for income. */
export function transactionsToCsv(transactions: Transaction[]): string {
  const rows = transactions
    .filter(t => t.status !== 'deleted')
    .slice()
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map(t => [t.date, t.time, t.title, t.category, t.amount.toFixed(2), ACCOUNTS[t.account]?.name ?? t.account, t.status, t.source, t.note ?? '']);
  return [HEADER, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** Saves a text file via a throwaway download link. Works in any browser, including LINE's in-app one. */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
