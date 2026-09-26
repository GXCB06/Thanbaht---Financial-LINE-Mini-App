import React, { useState, useMemo } from 'react';
import { SubscriptionItem } from '../types/finance';

interface SubscriptionCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptions: SubscriptionItem[];
  onAddSubscription?: (sub: SubscriptionItem) => void;
  onUpdateSubscription?: (sub: SubscriptionItem) => void;
}

export const SubscriptionCalendarModal: React.FC<SubscriptionCalendarModalProps> = ({
  isOpen,
  onClose,
  subscriptions: initialSubscriptions,
  onAddSubscription
}) => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>(initialSubscriptions);
  const [selectedMonth, setSelectedMonth] = useState<'September 2026' | 'October 2026'>('September 2026');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'All' | 'Entertainment' | 'Utilities' | 'Cloud/AI'>('All');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New subscription form state
  const [newName, setNewName] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDay, setNewDay] = useState(15);
  const [newCategory, setNewCategory] = useState<'Entertainment' | 'Bills & Utilities'>('Entertainment');
  const [newPayment, setNewPayment] = useState('Credit Card Auto');

  // Reminders state
  const [reminders, setReminders] = useState<{ [id: string]: boolean }>({
    'sub-icloud': true,
    'sub-youtube': true,
    'sub-rabbit': true,
    'sub-netflix': true,
    'sub-truevisions': true
  });

  const toggleReminder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReminders(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Month metadata
  // Reference date: 2026-09-25
  const isSeptember = selectedMonth === 'September 2026';
  const daysInMonth = isSeptember ? 30 : 31;
  // 1 Sep 2026 was a Tuesday (day index 2, where Sun = 0)
  // 1 Oct 2026 was a Thursday (day index 4)
  const firstDayOfWeek = isSeptember ? 2 : 4; 

  const totalMonthlyCost = useMemo(() => {
    return subscriptions
      .filter(s => s.status === 'active')
      .reduce((sum, s) => sum + s.amount, 0);
  }, [subscriptions]);

  // Calculate days remaining from Sep 25, 2026
  const getDaysUntilRenewal = (sub: SubscriptionItem) => {
    const todayDay = 25; // Sep 25, 2026
    if (isSeptember) {
      if (sub.billingDay >= todayDay) {
        return sub.billingDay - todayDay;
      } else {
        // Renews next month
        return (30 - todayDay) + sub.billingDay;
      }
    } else {
      // In October
      return sub.billingDay;
    }
  };

  // Subscriptions mapped by day of month
  const subsByDay = useMemo(() => {
    const map: { [day: number]: SubscriptionItem[] } = {};
    subscriptions.forEach(sub => {
      if (!map[sub.billingDay]) {
        map[sub.billingDay] = [];
      }
      map[sub.billingDay].push(sub);
    });
    return map;
  }, [subscriptions]);

  // Filtered subscriptions list
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(sub => {
      if (selectedDayFilter !== null && sub.billingDay !== selectedDayFilter) {
        return false;
      }

      if (activeCategoryTab === 'Entertainment') {
        return sub.category === 'Entertainment';
      }
      if (activeCategoryTab === 'Utilities') {
        return sub.category === 'Bills & Utilities' && sub.iconName !== 'cloud' && sub.iconName !== 'smart_toy';
      }
      if (activeCategoryTab === 'Cloud/AI') {
        return sub.iconName === 'cloud' || sub.iconName === 'smart_toy';
      }

      return true;
    }).sort((a, b) => {
      const daysA = getDaysUntilRenewal(a);
      const daysB = getDaysUntilRenewal(b);
      return daysA - daysB;
    });
  }, [subscriptions, selectedDayFilter, activeCategoryTab, isSeptember]);

  // Upcoming in next 7 days from Sep 25
  const upcomingSoon = useMemo(() => {
    return subscriptions.filter(s => {
      const days = getDaysUntilRenewal(s);
      return days >= 0 && days <= 7;
    });
  }, [subscriptions]);

  const handleAddNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newAmount) return;

    const parsedAmount = parseFloat(newAmount) || 199;
    const newSub: SubscriptionItem = {
      id: `sub-custom-${Date.now()}`,
      name: newName.trim(),
      planName: newPlan.trim() || 'Standard Plan',
      provider: newName.trim(),
      category: newCategory,
      amount: parsedAmount,
      billingDay: newDay,
      frequency: 'monthly',
      nextRenewalDate: `2026-10-${newDay.toString().padStart(2, '0')}`,
      status: 'active',
      paymentMethod: newPayment,
      iconName: newCategory === 'Entertainment' ? 'movie' : 'receipt_long',
      color: '#008A3D',
      remindDaysBefore: 3
    };

    setSubscriptions(prev => [newSub, ...prev]);
    if (onAddSubscription) onAddSubscription(newSub);

    setIsAddingNew(false);
    setNewName('');
    setNewPlan('');
    setNewAmount('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn p-0 sm:p-4">
      {/* Click outside backdrop to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Card Container */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-neutral-900 rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden animate-slideUp">
        {/* Top Header */}
        <div className="p-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#E8F9EE] dark:bg-emerald-950/50 flex items-center justify-center text-[#008A3D] dark:text-[#06C755] shadow-xs">
                <span className="material-symbols-outlined text-[22px]">calendar_month</span>
              </div>
              <div>
                <h2 className="text-[19px] font-bold text-black dark:text-white leading-tight">
                  Subscription Calendar
                </h2>
                <p className="text-[12px] text-[#8E8E93] leading-tight">
                  Renewal schedule & auto-payment planner
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white flex items-center justify-center transition"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Month Navigator Pills */}
          <div className="flex items-center justify-between mt-3 pt-1">
            <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
              {(['September 2026', 'October 2026'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setSelectedMonth(m);
                    setSelectedDayFilter(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition ${
                    selectedMonth === m
                      ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs'
                      : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="text-[12px] font-bold text-[#008A3D] dark:text-[#06C755] flex items-center gap-1 hover:underline"
            >
              <span className="material-symbols-outlined text-[16px]">{isAddingNew ? 'close' : 'add'}</span>
              <span>{isAddingNew ? 'Cancel' : 'Add Service'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Add Subscription Form (Collapsible) */}
          {isAddingNew && (
            <form onSubmit={handleAddNewSubmit} className="p-4 bg-[#F5F6F5] dark:bg-neutral-800/80 rounded-2xl border border-black/5 dark:border-white/5 space-y-3 animate-fadeIn">
              <h3 className="text-[14px] font-bold text-black dark:text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#008A3D]">add_circle</span>
                <span>Track New Subscription</span>
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[#8E8E93] uppercase block mb-1">Service Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Disney+ Hotstar"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[13px] text-black dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#008A3D]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#8E8E93] uppercase block mb-1">Monthly Cost (฿)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 299"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[13px] text-black dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#008A3D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[#8E8E93] uppercase block mb-1">Plan / Tier</label>
                  <input
                    type="text"
                    placeholder="e.g. Premium 4K"
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[13px] text-black dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#008A3D]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#8E8E93] uppercase block mb-1">Renewal Day of Month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newDay}
                    onChange={(e) => setNewDay(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[13px] text-black dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#008A3D]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-[#008A3D] text-white font-semibold rounded-xl text-[13px] shadow-xs active:scale-95 transition"
              >
                Save Subscription
              </button>
            </form>
          )}

          {/* Monthly Financial Summary Banner */}
          <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-black/[0.03] dark:border-white/[0.04]">
            <div>
              <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                Committed Subscriptions
              </span>
              <span className="text-[18px] font-black text-black dark:text-white font-sans tabular-nums mt-0.5 block">
                ฿{totalMonthlyCost.toLocaleString()}<span className="text-[12px] font-normal text-[#8E8E93]">/mo</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                Next 7 Days Due
              </span>
              <span className="text-[18px] font-black text-[#FF3B30] font-sans tabular-nums mt-0.5 block">
                ฿{upcomingSoon.reduce((sum, s) => sum + s.amount, 0).toLocaleString()}
                <span className="text-[12px] font-normal text-[#8E8E93]"> ({upcomingSoon.length} due)</span>
              </span>
            </div>
          </div>

          {/* Imminent Renewal Alert Pill (Today is Sep 25) */}
          {upcomingSoon.length > 0 && isSeptember && (
            <div className="p-3 bg-[#FFF8E6] dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/50 rounded-2xl text-[12px] text-amber-900 dark:text-amber-200 flex items-start gap-2.5 shadow-2xs">
              <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">
                notifications_active
              </span>
              <div className="min-w-0">
                <span className="font-bold block">
                  ⚡ Upcoming Renewals This Week:
                </span>
                <span className="text-amber-800 dark:text-amber-300">
                  {upcomingSoon.map(s => `${s.name} (฿${s.amount}) on ${s.billingDay} Sep`).join(' · ')}
                </span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* INTERACTIVE MONTH CALENDAR GRID */}
          {/* ============================================================ */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-3.5 border border-black/5 dark:border-white/5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
                {selectedMonth} Renewal Map
              </span>
              {selectedDayFilter !== null && (
                <button
                  onClick={() => setSelectedDayFilter(null)}
                  className="text-[11px] font-bold text-[#008A3D] dark:text-[#06C755] hover:underline"
                >
                  Show Full Month
                </button>
              )}
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#8E8E93] pb-1.5">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {/* Padding empty days */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10 rounded-lg opacity-10" />
              ))}

              {/* Day cells 1 to daysInMonth */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const hasSubs = subsByDay[dayNum] && subsByDay[dayNum].length > 0;
                const isSelected = selectedDayFilter === dayNum;
                const isToday = isSeptember && dayNum === 25; // Sep 25 reference

                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => {
                      if (hasSubs) {
                        setSelectedDayFilter(selectedDayFilter === dayNum ? null : dayNum);
                      }
                    }}
                    className={`h-11 rounded-xl flex flex-col items-center justify-between py-1 transition relative ${
                      isSelected
                        ? 'bg-[#008A3D] text-white shadow-xs'
                        : isToday
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#008A3D] font-bold ring-1.5 ring-[#008A3D]'
                        : hasSubs
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer'
                        : 'text-neutral-400 dark:text-neutral-600 hover:text-black'
                    }`}
                  >
                    <span className="text-[11px] leading-tight font-sans font-semibold">
                      {dayNum}
                    </span>

                    {/* Subscription Dot Indicators */}
                    <div className="flex items-center gap-0.5 justify-center h-2">
                      {hasSubs && (
                        subsByDay[dayNum].slice(0, 3).map((sub, idx) => (
                          <span
                            key={idx}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: isSelected ? '#FFFFFF' : sub.color
                            }}
                          />
                        ))
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="flex items-center justify-between text-[10px] text-[#8E8E93] pt-3 border-t border-neutral-100 dark:border-neutral-800 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#008A3D] ring-2 ring-emerald-200" />
                <span>Today (25 Sep)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E50914]" />
                <span className="w-2 h-2 rounded-full bg-[#007AFF]" />
                <span>Renewal Scheduled</span>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* CATEGORY FILTER TABS */}
          {/* ============================================================ */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px]">
            {(['All', 'Entertainment', 'Utilities', 'Cloud/AI'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveCategoryTab(tab)}
                className={`px-3 py-1 rounded-full whitespace-nowrap transition font-medium ${
                  activeCategoryTab === tab
                    ? 'bg-black dark:bg-white text-white dark:text-black font-semibold shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-black'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ============================================================ */}
          {/* SUBSCRIPTIONS TIMELINE & RENEWAL LIST */}
          {/* ============================================================ */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-bold text-black dark:text-white">
                {selectedDayFilter !== null
                  ? `Renewals on Day ${selectedDayFilter} (${filteredSubscriptions.length})`
                  : `All Scheduled Subscriptions (${filteredSubscriptions.length})`}
              </span>
              <span className="text-[11px] text-[#8E8E93]">
                Total: ฿{filteredSubscriptions.reduce((sum, s) => sum + s.amount, 0).toLocaleString()}
              </span>
            </div>

            {filteredSubscriptions.map(sub => {
              const daysLeft = getDaysUntilRenewal(sub);
              const isDueVerySoon = isSeptember && daysLeft >= 0 && daysLeft <= 3;
              const hasReminder = reminders[sub.id] ?? true;

              return (
                <div
                  key={sub.id}
                  className={`p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border transition-all ${
                    isDueVerySoon
                      ? 'border-amber-400 dark:border-amber-600/70 shadow-xs'
                      : 'border-black/[0.04] dark:border-white/[0.05] shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Icon & Service info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: sub.color }}
                      >
                        <span className="material-symbols-outlined text-[20px]">{sub.iconName}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-[14px] font-bold text-black dark:text-white leading-tight truncate">
                            {sub.name}
                          </h4>
                          {isDueVerySoon && (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold rounded-md shrink-0">
                              Due in {daysLeft}d
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#8E8E93] leading-tight truncate mt-0.5">
                          {sub.planName || sub.provider} · {sub.paymentMethod}
                        </p>
                      </div>
                    </div>

                    {/* Right: Price & Frequency */}
                    <div className="text-right shrink-0">
                      <span className="text-[15px] font-bold text-black dark:text-white font-sans tabular-nums block">
                        ฿{sub.amount.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-[#8E8E93] font-medium block">
                        /{sub.frequency === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Renewal Timeline Bar */}
                  <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-[#8E8E93]">
                      <span className="material-symbols-outlined text-[15px] text-[#008A3D]">event_repeat</span>
                      <span>
                        Billing day: <strong className="text-black dark:text-white font-semibold">Day {sub.billingDay}</strong>
                        {isSeptember && (
                          <span className="ml-1 text-neutral-500">
                            ({daysLeft === 0 ? 'Today!' : daysLeft > 0 ? `in ${daysLeft} days` : 'renewed'})
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Reminder Bell Toggle */}
                    <button
                      type="button"
                      onClick={(e) => toggleReminder(sub.id, e)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition ${
                        hasReminder
                          ? 'bg-[#E8F9EE] text-[#008A3D] dark:bg-emerald-950/40 dark:text-[#06C755] font-semibold'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                      }`}
                      title={hasReminder ? 'Reminder enabled' : 'Click to enable reminder'}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {hasReminder ? 'notifications_active' : 'notifications_off'}
                      </span>
                      <span>{hasReminder ? 'Alert ON' : 'Alert'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Done Bar */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#008A3D] hover:bg-[#007032] text-white font-bold text-[15px] rounded-2xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-1.5"
          >
            <span>Close Calendar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
