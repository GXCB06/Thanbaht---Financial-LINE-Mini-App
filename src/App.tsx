import React, { useState, useEffect } from 'react';
import { ActiveTab, Transaction, CategoryType, SubscriptionItem } from './types/finance';
import { INITIAL_TRANSACTIONS, INITIAL_SUBSCRIPTIONS } from './data/mockData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { OverviewTab } from './components/OverviewTab';
import { TransactionsTab } from './components/TransactionsTab';
import { InsightsTab } from './components/InsightsTab';
import { TransactionDetailView } from './components/TransactionDetailView';
import { LineChatModal } from './components/LineChatModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { EditTransactionModal } from './components/EditTransactionModal';
import { MoreMenuModal } from './components/MoreMenuModal';
import { BudgetGoalModal } from './components/BudgetGoalModal';
import { AddMoneyMomentModal } from './components/AddMoneyMomentModal';
import { ReviewTab } from './components/ReviewTab';
import { SubscriptionCalendarModal } from './components/SubscriptionCalendarModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('September 2026');
  
  // Monthly Budget Goal (Default: ฿22,000)
  const [monthlyBudgetGoal, setMonthlyBudgetGoal] = useState<number>(22000);
  const [isBudgetGoalModalOpen, setIsBudgetGoalModalOpen] = useState(false);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('thanbaht_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('thanbaht_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('thanbaht_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddMoneyMomentOpen, setIsAddMoneyMomentOpen] = useState(false);
  const [isSubCalendarOpen, setIsSubCalendarOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>(INITIAL_SUBSCRIPTIONS);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [lineModalTx, setLineModalTx] = useState<Transaction | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isFrameMode, setIsFrameMode] = useState(true);

  // Handlers
  const handleSelectTransaction = (tx: Transaction) => {
    setSelectedTx(tx);
  };

  const handleBackFromDetail = () => {
    setSelectedTx(null);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
  };

  const handleSaveEditedTransaction = (updatedTx: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
    if (selectedTx && selectedTx.id === updatedTx.id) {
      setSelectedTx(updatedTx);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (selectedTx && selectedTx.id === id) {
      setSelectedTx(null);
    }
  };

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
    setSelectedTx(newTx);
  };

  const handleResetData = () => {
    setTransactions(INITIAL_TRANSACTIONS);
    setSelectedTx(null);
    setMonthlyBudgetGoal(22000);
  };

  // Compute total spending for budget goal modal
  const totalSpending = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} min-h-screen bg-[#E5E5EA] dark:bg-black flex items-center justify-center sm:py-6 selection:bg-[#06C755]/20 selection:text-[#004c1b] transition-colors duration-200`}>
      {/* Device wrapper / container */}
      <div
        className={`w-full bg-[#F2F2F7] dark:bg-[#121212] min-h-screen text-[#1C1C1E] dark:text-neutral-100 flex flex-col relative transition-all ${
          isFrameMode
            ? 'sm:max-w-[420px] sm:min-h-[880px] sm:max-h-[920px] sm:rounded-[48px] sm:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] sm:border-[10px] sm:border-[#1E1E1E] sm:overflow-hidden'
            : 'max-w-md mx-auto shadow-sm'
        }`}
      >
        {/* Sticky Mobile Header */}
        <Header
          activeTab={activeTab}
          onOpenMenu={() => setIsMoreMenuOpen(true)}
          onCloseApp={() => {
            if (selectedTx) {
              setSelectedTx(null);
            } else {
              setIsMoreMenuOpen(true);
            }
          }}
          isFrameMode={isFrameMode}
          onToggleFrameMode={() => setIsFrameMode(!isFrameMode)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />

        {/* Scrollable Main Stage */}
        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-24">
          {selectedTx ? (
            /* Transaction Detail View (Image 5) */
            <TransactionDetailView
              transaction={selectedTx}
              onBack={handleBackFromDetail}
              onEdit={handleEditTransaction}
              onDelete={handleDeleteTransaction}
              onViewOriginalInLine={(tx) => setLineModalTx(tx)}
            />
          ) : (
            /* Main 3 Tabs */
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  transactions={transactions}
                  onSelectTransaction={handleSelectTransaction}
                  onViewAllTransactions={() => setActiveTab('transactions')}
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                  monthlyBudgetGoal={monthlyBudgetGoal}
                  onOpenBudgetGoalModal={() => setIsBudgetGoalModalOpen(true)}
                  onOpenSubscriptionCalendar={() => setIsSubCalendarOpen(true)}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsTab
                  transactions={transactions}
                  onSelectTransaction={handleSelectTransaction}
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                  onOpenAddModal={() => setIsAddMoneyMomentOpen(true)}
                />
              )}

              {activeTab === 'review' && (
                <ReviewTab
                  transactions={transactions}
                  onSelectTransaction={handleSelectTransaction}
                  onOpenAddMoment={() => setIsAddMoneyMomentOpen(true)}
                  onOpenSubscriptionCalendar={() => setIsSubCalendarOpen(true)}
                />
              )}

              {activeTab === 'insights' && (
                <InsightsTab
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                  transactions={transactions}
                  monthlyBudgetGoal={monthlyBudgetGoal}
                  onSelectCategoryFilter={(_cat: CategoryType) => {
                    setActiveTab('transactions');
                  }}
                />
              )}
            </>
          )}
        </main>

        {/* Fixed Native iOS Tab Bar (Only show when not in detail view) */}
        {!selectedTx && (
          <BottomNav
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenAddMoment={() => setIsAddMoneyMomentOpen(true)}
          />
        )}

        {/* LINE Chat Slip Verification Simulation Modal */}
        {lineModalTx && (
          <LineChatModal
            transaction={lineModalTx}
            onClose={() => setLineModalTx(null)}
          />
        )}

        {/* Thanbaht Add Money Moment Flow (Screenshots 1-5) */}
        <AddMoneyMomentModal
          isOpen={isAddMoneyMomentOpen}
          onClose={() => setIsAddMoneyMomentOpen(false)}
          onAddTransaction={handleAddTransaction}
          onOpenLineChat={() => {
            setIsAddMoneyMomentOpen(false);
            setLineModalTx(transactions[0] || null);
          }}
        />

        {/* Add Transaction Modal (Manual form fallback) */}
        {isAddModalOpen && (
          <AddTransactionModal
            onAdd={handleAddTransaction}
            onClose={() => setIsAddModalOpen(false)}
          />
        )}

        {/* Edit Transaction Modal */}
        {editingTx && (
          <EditTransactionModal
            transaction={editingTx}
            onSave={handleSaveEditedTransaction}
            onClose={() => setEditingTx(null)}
          />
        )}

        {/* Budget Goal Modal */}
        {isBudgetGoalModalOpen && (
          <BudgetGoalModal
            currentGoal={monthlyBudgetGoal}
            totalSpent={totalSpending}
            month={selectedMonth}
            onSave={(newGoal) => setMonthlyBudgetGoal(newGoal)}
            onClose={() => setIsBudgetGoalModalOpen(false)}
          />
        )}

        {/* Subscription Calendar & Renewal Tracker Modal */}
        <SubscriptionCalendarModal
          isOpen={isSubCalendarOpen}
          onClose={() => setIsSubCalendarOpen(false)}
          subscriptions={subscriptions}
          onAddSubscription={(newSub) => setSubscriptions(prev => [newSub, ...prev])}
        />

        {/* More Actions Menu */}
        {isMoreMenuOpen && (
          <MoreMenuModal
            onClose={() => setIsMoreMenuOpen(false)}
            onResetData={handleResetData}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        )}
      </div>
    </div>
  );
}
