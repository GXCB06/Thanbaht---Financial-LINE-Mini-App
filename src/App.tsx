import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActiveTab, CategoryType, SubscriptionItem, Transaction } from './types/finance';
import {
  DEFAULT_MONTHLY_BUDGET,
  INITIAL_SUBSCRIPTIONS,
  INITIAL_TRANSACTIONS,
  makeSubscriptionFromTransaction,
} from './data/mockData';
import { computeStats } from './lib/ledger';
import { IN_LINE, LIVE, MONTH_LABEL } from './lib/clock';
import { ApiError, closeApp, loadAll, saveChanges, signInAgain } from './lib/api';
import { diffAgainstServer, isEmpty, toTransaction, withUuids, writableOf, type ServerSnapshot, type ServerTx } from './lib/liveData';
import { payeeKey } from '../supabase/functions/_shared/names';
import { currentRoute } from './lib/route';
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
import { AddSheet } from './components/AddSheet';
import { ReviewTab } from './components/ReviewTab';
import { SubscriptionCalendarModal } from './components/SubscriptionCalendarModal';
import { ToastProvider, useToast } from './components/Toast';

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

  // A deep link from a bot card (…/review, …/tx/<id>) decides where the app opens
  const [route] = useState(() => currentRoute());
  const [activeTab, setActiveTab] = useState<ActiveTab>(route.tab ?? 'overview');
  // Live mode starts empty and fills from the server; demo mode starts with the built-in September data.
  const [transactions, setTransactions] = useState<Transaction[]>(LIVE ? [] : INITIAL_TRANSACTIONS);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>(LIVE ? [] : INITIAL_SUBSCRIPTIONS);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(LIVE ? 'loading' : 'ready');
  const [loadError, setLoadError] = useState<ApiError | null>(null);
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

  /* ---------------- live data: load from the server, save changes back ---------------- */

  /** What the server is known to hold, so only real changes are sent. */
  const server = useRef<ServerSnapshot>({ tx: new Map(), rules: {}, budget: DEFAULT_MONTHLY_BUDGET });
  const latest = useRef({ transactions, rules, budget: monthlyBudgetGoal });
  latest.current = { transactions, rules, budget: monthlyBudgetGoal };
  const saving = useRef(false);
  const saveAgain = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await loadAll();
      const txs = d.transactions.map(toTransaction);
      server.current = { tx: new Map(txs.map(t => [t.id, writableOf(t)])), rules: { ...d.rules }, budget: d.profile.monthly_budget };
      setTransactions(txs);
      setRules(d.rules);
      setMonthlyBudgetGoal(d.profile.monthly_budget);
      setLoadState('ready');
    } catch (e) {
      setLoadError(e instanceof ApiError ? e : new ApiError('server', String(e)));
      setLoadState('error');
    }
  }, []);

  const flush = useCallback(async () => {
    if (saving.current) {
      saveAgain.current = true; // something changed while saving: go round again when done
      return;
    }
    saving.current = true;
    try {
      for (let round = 0; round < 5; round++) {
        const sent = latest.current;
        const changes = diffAgainstServer(sent, server.current);
        if (isEmpty(changes)) break;
        const res = await saveChanges(changes);
        const failed = new Set(res.failed);
        changes.updates.forEach(u => failed.has(u.id) || server.current.tx.set(u.id, u.after));
        changes.adds.forEach(a => {
          const tx = sent.transactions.find(t => t.id === a.id);
          if (tx && !failed.has(a.id)) server.current.tx.set(a.id, writableOf(tx));
        });
        changes.rules.forEach(r => (server.current.rules[r.key] = r.category));
        if (changes.budget !== undefined) server.current.budget = changes.budget;
        if (res.failed.length) {
          toast("Couldn't save some changes · showing what is saved");
          await load();
          break;
        }
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') {
        setLoadError(e);
        setLoadState('error');
      } else {
        toast('Offline · your changes will save when you are back');
      }
    } finally {
      saving.current = false;
      if (saveAgain.current) {
        saveAgain.current = false;
        setTimeout(() => void flush(), 300);
      }
    }
  }, [load, toast]);

  useEffect(() => {
    if (LIVE) void load();
  }, [load]);

  // Save shortly after the last change
  useEffect(() => {
    if (!LIVE || loadState !== 'ready') return;
    const timer = setTimeout(() => void flush(), 600);
    return () => clearTimeout(timer);
  }, [transactions, rules, monthlyBudgetGoal, loadState, flush]);

  // Coming back to the app (say, after sending a slip in the chat): show what the bot logged meanwhile
  useEffect(() => {
    if (!LIVE) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || loadState !== 'ready' || saving.current) return;
      if (isEmpty(diffAgainstServer(latest.current, server.current))) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load, loadState]);

  // Open the record a card pointed at, once the records are here
  const routedTx = useRef(false);
  useEffect(() => {
    if (routedTx.current || !route.txId || loadState !== 'ready') return;
    routedTx.current = true;
    if (transactions.some(t => t.id === route.txId && t.status !== 'deleted')) setSelectedTxId(route.txId);
  }, [loadState, route.txId, transactions]);

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
        rules[payeeKey(t.title)] && t.review?.kind !== 'dup' ? { ...t, category: rules[payeeKey(t.title)], status: 'ok' as const, review: undefined } : t,
      );
      setTransactions(prev => [...(LIVE ? withUuids(withRules) : withRules), ...prev]);
      toast(message, { label: 'Undo', run: undo });
    },
    [rules, snapshotUndo, toast],
  );

  /** Records the backend saved for us (a slip, a voice note, typed words): they are already on the server. */
  const addServerRecords = useCallback((rows: ServerTx[]) => {
    const fresh = rows.map(toTransaction);
    fresh.forEach(t => server.current.tx.set(t.id, writableOf(t)));
    setTransactions(prev => [...fresh.filter(t => !prev.some(p => p.id === t.id)), ...prev]);
  }, []);

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
      if (always) setRules(r => ({ ...r, [payeeKey(tx.title)]: category }));
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
      if (always && category) setRules(r => ({ ...r, [payeeKey(tx.title)]: category }));
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
        {LIVE && loadState !== 'ready' ? (
          <LoadStatus state={loadState} error={loadError} onRetry={() => (loadError?.code === 'unauthorized' ? signInAgain() : (setLoadState('loading'), void load()))} />
        ) : selectedTx ? (
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
            hasRule={!!rules[payeeKey(selectedTx.title)]}
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
                onOpenInsights={() => goToTab('insights')}
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

      {LIVE ? (
        <AddSheet
          isOpen={isAddMoneyMomentOpen}
          onClose={() => setIsAddMoneyMomentOpen(false)}
          onRecords={addServerRecords}
          onOpenReview={() => goToTab('review')}
          onOpenLineChat={() => (IN_LINE ? closeApp() : toast('Open the Thanbaht chat in LINE'))}
        />
      ) : (
      <AddMoneyMomentModal
        isOpen={isAddMoneyMomentOpen}
        onClose={() => setIsAddMoneyMomentOpen(false)}
        onAddTransactions={addTransactions}
        live={LIVE}
        onOpenReview={() => goToTab('review')}
        transactions={transactions}
        onOpenLineChat={() => {
          setIsAddMoneyMomentOpen(false);
          toast(IN_LINE ? 'Back to the Thanbaht chat' : 'In LINE, this closes the app and opens the Thanbaht chat');
        }}
      />
      )}

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
          onResetData={LIVE ? undefined : handleResetData}
          isDarkMode={isDarkMode}
          onToggleDarkMode={onToggleDarkMode}
          privacy={privacy}
          onTogglePrivacy={onTogglePrivacy}
        />
      )}
    </>
  );
}

/** Shown instead of the app while the real data is loading, or when it could not be loaded. */
function LoadStatus({ state, error, onRetry }: { state: 'loading' | 'ready' | 'error'; error: ApiError | null; onRetry: () => void }) {
  if (state === 'loading') {
    return (
      <div className="h-full min-h-[50dvh] flex flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
        <span className="material-symbols-outlined text-[36px] text-[#008A3D] dark:text-[#06C755] animate-pulse">savings</span>
        <p className="text-[15px] font-semibold text-black dark:text-white">Loading your money…</p>
      </div>
    );
  }
  const message =
    error?.code === 'unauthorized'
      ? 'Your LINE session expired. Sign in again to continue.'
      : error?.code === 'no_id_token'
        ? error.message
        : error?.code === 'network'
          ? 'Could not reach Thanbaht. Check your connection and try again.'
          : 'Something went wrong while loading your records.';
  return (
    <div className="h-full min-h-[50dvh] flex flex-col items-center justify-center gap-4 text-center px-6" role="alert">
      <span className="material-symbols-outlined text-[36px] text-[#B94444]">cloud_off</span>
      <p className="text-[14px] text-[#3A3A3C] dark:text-neutral-300 leading-snug">{message}</p>
      <button
        onClick={onRetry}
        className="px-5 py-2.5 rounded-full bg-[#008A3D] text-white text-[14px] font-semibold active:scale-[0.98] transition"
      >
        {error?.code === 'unauthorized' ? 'Sign in again' : 'Try again'}
      </button>
    </div>
  );
}
