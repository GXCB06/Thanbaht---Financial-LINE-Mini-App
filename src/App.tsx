import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActiveTab, CategoryType, SubscriptionItem, Transaction } from './types/finance';
import {
  DEFAULT_MONTHLY_BUDGET,
  INITIAL_SUBSCRIPTIONS,
  INITIAL_TRANSACTIONS,
  makeSubscriptionFromTransaction,
} from './data/mockData';
import { computeStats } from './lib/ledger';
import { MONTH_LABEL } from './lib/clock';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { OverviewTab } from './components/OverviewTab';
import { TransactionsTab } from './components/TransactionsTab';
import { InsightsTab } from './components/InsightsTab';
import { TransactionDetailView } from './components/TransactionDetailView';
import { LineChatModal } from './components/LineChatModal';
import { EditTransactionModal } from './components/EditTransactionModal';
import { MoreMenuModal } from './components/MoreMenuModal';
import { BudgetGoalModal } from './components/BudgetGoalModal';
import { AddMoneyMomentModal } from './components/AddMoneyMomentModal';
import { ReviewTab } from './components/ReviewTab';
import { SubscriptionCalendarModal } from './components/SubscriptionCalendarModal';
import { ToastProvider, useToast } from './components/Toast';

/** Inside LINE the native Mini App header (with ⋯ and ✕) is drawn by LINE itself. */
const IN_LINE = typeof navigator !== 'undefined' && /\bLine\//i.test(navigator.userAgent);

const readPref = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writePref = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: preference just won't persist */
  }
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = readPref('thanbaht_theme');
    if (saved) return saved === 'dark';
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [privacy, setPrivacy] = useState(() => readPref('thanbaht_privacy') === '1');
  const [isFrameMode, setIsFrameMode] = useState(!IN_LINE);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    writePref('thanbaht_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);
  useEffect(() => writePref('thanbaht_privacy', privacy ? '1' : ''), [privacy]);

  return (
    <div
      className={`${isDarkMode ? 'dark' : ''} min-h-[100dvh] bg-[#E5E5EA] dark:bg-black flex items-center justify-center sm:py-6 selection:bg-[#06C755]/20 transition-colors duration-200`}
    >
      <div
        className={`${privacy ? 'privacy' : ''} relative w-full h-[100dvh] overflow-hidden bg-[#F2F2F7] dark:bg-[#121212] text-[#1C1C1E] dark:text-neutral-100 flex flex-col transition-all ${
          isFrameMode
            ? 'sm:max-w-[420px] sm:h-[880px] sm:max-h-[calc(100dvh-48px)] sm:rounded-[48px] sm:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] sm:border-[10px] sm:border-[#1E1E1E]'
            : 'max-w-md mx-auto shadow-sm'
        }`}
      >
        <ToastProvider>
          <Shell
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(d => !d)}
            privacy={privacy}
            onTogglePrivacy={() => setPrivacy(p => !p)}
            isFrameMode={isFrameMode}
            onToggleFrameMode={() => setIsFrameMode(f => !f)}
          />
        </ToastProvider>
      </div>
    </div>
  );
}

interface ShellProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  privacy: boolean;
  onTogglePrivacy: () => void;
  isFrameMode: boolean;
  onToggleFrameMode: () => void;
}

function Shell({ isDarkMode, onToggleDarkMode, privacy, onTogglePrivacy, isFrameMode, onToggleFrameMode }: ShellProps) {
  const toast = useToast();
  const mainRef = useRef<HTMLElement>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>(INITIAL_SUBSCRIPTIONS);
  const [monthlyBudgetGoal, setMonthlyBudgetGoal] = useState(DEFAULT_MONTHLY_BUDGET);
  const [noSpendDays, setNoSpendDays] = useState<Set<number>>(new Set());
  /** Payee → category rules created with "Always file this payee". */
  const [rules, setRules] = useState<Record<string, CategoryType>>({});
  const [activityFilter, setActivityFilter] = useState<{ category?: CategoryType; review?: boolean } | null>(null);

  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [isAddMoneyMomentOpen, setIsAddMoneyMomentOpen] = useState(false);
  const [isSubCalendarOpen, setIsSubCalendarOpen] = useState(false);
  const [isBudgetGoalModalOpen, setIsBudgetGoalModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [lineModalTxId, setLineModalTxId] = useState<string | null>(null);

  const stats = useMemo(
    () => computeStats(transactions, { budget: monthlyBudgetGoal, noSpendDays }),
    [transactions, monthlyBudgetGoal, noSpendDays],
  );

  const find = (id: string | null) => (id ? transactions.find(t => t.id === id && t.status !== 'deleted') ?? null : null);
  const selectedTx = find(selectedTxId);

  // The scroller is <main>, not window: reset it whenever the screen changes.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeTab, selectedTxId]);

  /* ---------------- transaction actions ---------------- */

  const updateTx = useCallback((id: string, patch: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const snapshotUndo = useCallback(() => {
    const before = transactions;
    return () => setTransactions(before);
  }, [transactions]);

  const addTransactions = useCallback(
    (txs: Transaction[], message: string) => {
      const undo = snapshotUndo();
      // A saved payee rule answers "who is this?" automatically, but never hides a duplicate
      const withRules = txs.map(t =>
        rules[t.title] && t.review?.kind !== 'dup' ? { ...t, category: rules[t.title], status: 'ok' as const, review: undefined } : t,
      );
      setTransactions(prev => [...withRules, ...prev]);
      toast(message, { label: 'Undo', run: undo });
    },
    [rules, snapshotUndo, toast],
  );

  const deleteTx = useCallback(
    (id: string) => {
      const undo = snapshotUndo();
      updateTx(id, { status: 'deleted' });
      setSelectedTxId(null);
      toast('Deleted', { label: 'Undo', run: undo });
    },
    [snapshotUndo, toast, updateTx],
  );

  /** Set a category; optionally remember it for every record from this payee. */
  const setCategory = useCallback(
    (id: string, category: CategoryType, always: boolean) => {
      const undo = snapshotUndo();
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;
      setTransactions(prev =>
        prev.map(t =>
          t.id === id || (always && t.title === tx.title)
            ? { ...t, category, ...(t.status === 'review' && t.review?.kind !== 'dup' ? { status: 'ok' as const, review: undefined } : {}) }
            : t,
        ),
      );
      if (always) setRules(r => ({ ...r, [tx.title]: category }));
      toast(`${always ? 'Rule saved · ' : ''}Filed as ${category}`, { label: 'Undo', run: undo });
    },
    [snapshotUndo, toast, transactions],
  );

  /** Resolve a Review card. */
  const resolveReview = useCallback(
    (id: string, action: 'confirm' | 'discard' | 'split' | 'subscribe', category?: CategoryType, always?: boolean) => {
      const undo = snapshotUndo();
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;
      if (action === 'discard') {
        updateTx(id, { status: 'deleted' });
        toast('Duplicate discarded', { label: 'Undo', run: undo });
        return;
      }
      const patch: Partial<Transaction> = { status: 'ok', review: undefined };
      if (category) patch.category = category;
      if (action === 'split') {
        patch.split = { n: 2 };
        patch.category = category ?? 'Food & Dining';
      }
      if (action === 'subscribe') {
        Object.assign(patch, { isRecurring: true, recurringFrequency: 'monthly', billingDay: Number(tx.date.slice(8)), recurringLabel: 'Subscription' });
      }
      updateTx(id, patch);
      if (always && category) setRules(r => ({ ...r, [tx.title]: category }));
      if (action === 'subscribe') {
        const sub = makeSubscriptionFromTransaction({ ...tx, ...patch });
        const prevSubs = subscriptions;
        setSubscriptions(s => [sub, ...s]);
        toast(`${tx.title} added to subscriptions`, {
          label: 'Undo',
          run: () => {
            undo();
            setSubscriptions(prevSubs);
          },
        });
        return;
      }
      toast(
        action === 'split' ? 'Logged · split 2 ways, IOU tracked' : category ? `${always ? 'Rule saved · ' : ''}Filed as ${category}` : 'Logged ✓',
        { label: 'Undo', run: undo },
      );
    },
    [snapshotUndo, subscriptions, toast, transactions, updateTx],
  );

  const markNoSpend = useCallback(
    (days: number[]) => {
      const before = noSpendDays;
      setNoSpendDays(prev => new Set([...prev, ...days]));
      toast(days.length > 1 ? 'Marked as no-spend days' : 'Marked as a no-spend day', { label: 'Undo', run: () => setNoSpendDays(before) });
    },
    [noSpendDays, toast],
  );

  const goToTab = (tab: ActiveTab) => {
    setSelectedTxId(null);
    setActiveTab(tab);
  };

  const handleResetData = () => {
    setTransactions(INITIAL_TRANSACTIONS);
    setSubscriptions(INITIAL_SUBSCRIPTIONS);
    setNoSpendDays(new Set());
    setRules({});
    setSelectedTxId(null);
    setMonthlyBudgetGoal(DEFAULT_MONTHLY_BUDGET);
    toast('Demo data reset');
  };

  const editingTx = find(editingTxId);
  const lineModalTx = find(lineModalTxId);

  return (
    <>
      <Header
        activeTab={activeTab}
        inLine={IN_LINE}
        onOpenMenu={() => setIsMoreMenuOpen(true)}
        onCloseApp={() => (selectedTx ? setSelectedTxId(null) : setIsMoreMenuOpen(true))}
        isFrameMode={isFrameMode}
        onToggleFrameMode={onToggleFrameMode}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        privacy={privacy}
        onTogglePrivacy={onTogglePrivacy}
      />

      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-3 pb-6">
        {selectedTx ? (
          <TransactionDetailView
            key={selectedTx.id}
            transaction={selectedTx}
            transactions={transactions}
            onBack={() => setSelectedTxId(null)}
            onEdit={tx => setEditingTxId(tx.id)}
            onDelete={deleteTx}
            onUpdate={updateTx}
            onSetCategory={setCategory}
            onShowInChat={tx => setLineModalTxId(tx.id)}
            hasRule={!!rules[selectedTx.title]}
          />
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                stats={stats}
                monthLabel={MONTH_LABEL}
                subscriptions={subscriptions}
                onSelectTransaction={tx => setSelectedTxId(tx.id)}
                onViewAllTransactions={() => goToTab('transactions')}
                onOpenBudgetGoalModal={() => setIsBudgetGoalModalOpen(true)}
                onOpenSubscriptionCalendar={() => setIsSubCalendarOpen(true)}
                onOpenReview={() => goToTab('review')}
                onOpenAddMoment={() => setIsAddMoneyMomentOpen(true)}
                onMarkNoSpend={markNoSpend}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsTab
                transactions={transactions}
                stats={stats}
                initialFilter={activityFilter}
                onConsumeFilter={() => setActivityFilter(null)}
                onSelectTransaction={tx => setSelectedTxId(tx.id)}
                onOpenAddModal={() => setIsAddMoneyMomentOpen(true)}
                onMarkNoSpend={markNoSpend}
              />
            )}

            {activeTab === 'review' && (
              <ReviewTab
                stats={stats}
                transactions={transactions}
                subscriptions={subscriptions}
                onResolve={resolveReview}
                onSelectTransaction={tx => setSelectedTxId(tx.id)}
                onOpenAddMoment={() => setIsAddMoneyMomentOpen(true)}
                onOpenSubscriptionCalendar={() => setIsSubCalendarOpen(true)}
                onGoHome={() => goToTab('overview')}
              />
            )}

            {activeTab === 'insights' && (
              <InsightsTab
                stats={stats}
                monthLabel={MONTH_LABEL}
                subscriptions={subscriptions}
                onAddSubscription={sub => setSubscriptions(prev => [sub, ...prev])}
                onSelectTransaction={tx => setSelectedTxId(tx.id)}
                onSelectCategoryFilter={category => {
                  setActivityFilter({ category });
                  goToTab('transactions');
                }}
                onShare={() => toast('September recap ready · share it in LINE')}
              />
            )}
          </>
        )}
      </main>

      {!selectedTx && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={goToTab}
          onOpenAddMoment={() => setIsAddMoneyMomentOpen(true)}
          reviewBadgeCount={stats.review.length}
        />
      )}

      {lineModalTx && <LineChatModal transaction={lineModalTx} onClose={() => setLineModalTxId(null)} />}

      <AddMoneyMomentModal
        isOpen={isAddMoneyMomentOpen}
        onClose={() => setIsAddMoneyMomentOpen(false)}
        onAddTransactions={addTransactions}
        onOpenReview={() => goToTab('review')}
        transactions={transactions}
        onOpenLineChat={() => {
          setIsAddMoneyMomentOpen(false);
          toast(IN_LINE ? 'Back to the Thanbaht chat' : 'In LINE, this closes the app and opens the Thanbaht chat');
        }}
      />

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          onSave={updated => {
            const undo = snapshotUndo();
            updateTx(updated.id, updated);
            toast('Saved', { label: 'Undo', run: undo });
          }}
          onClose={() => setEditingTxId(null)}
        />
      )}

      {isBudgetGoalModalOpen && (
        <BudgetGoalModal
          currentGoal={monthlyBudgetGoal}
          totalSpent={stats.spent}
          month={MONTH_LABEL}
          onSave={setMonthlyBudgetGoal}
          onClose={() => setIsBudgetGoalModalOpen(false)}
        />
      )}

      <SubscriptionCalendarModal
        isOpen={isSubCalendarOpen}
        onClose={() => setIsSubCalendarOpen(false)}
        subscriptions={subscriptions}
        onAddSubscription={sub => setSubscriptions(prev => [sub, ...prev])}
      />

      {isMoreMenuOpen && (
        <MoreMenuModal
          onClose={() => setIsMoreMenuOpen(false)}
          onResetData={handleResetData}
          isDarkMode={isDarkMode}
          onToggleDarkMode={onToggleDarkMode}
          privacy={privacy}
          onTogglePrivacy={onTogglePrivacy}
        />
      )}
    </>
  );
}
