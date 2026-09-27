import React, { useState, useMemo } from 'react';
import { SubscriptionItem } from '../types/finance';
import { INITIAL_SUBSCRIPTIONS } from '../data/mockData';
import { DAYS_IN_MONTH, MONTH, MONTH_LABEL, MONTH_PREFIX, TODAY, TODAY_DAY, TODAY_ISO, YEAR, addInterval, daysFromToday } from '../lib/clock';
import { shortDate } from '../lib/format';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Subscription12MonthChart } from './Subscription12MonthChart';
import { Sheet } from './Sheet';
import { useLang } from '../lib/i18n';

interface SubscriptionChartPoint {
  name: string;
  fullName: string;
  amount: number;
  annual: number;
  displayAmount: number;
  color: string;
  count: number;
}

interface SubscriptionViewProps {
  onClose?: () => void;
  onOpenAddModal?: () => void;
  /** App-wide list, so subscriptions added from Review show up here too. */
  subscriptions?: SubscriptionItem[];
  onAddSubscription?: (sub: SubscriptionItem) => void;
  onUpdateSubscription?: (id: string, patch: Partial<SubscriptionItem>) => void;
  onDeleteSubscription?: (id: string) => void;
}

const WEEKDAY_HEAD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A yearly plan's amount is what it charges once a year, not every month (rounded to a whole baht, like every other amount in the app). */
const monthlyOf = (s: SubscriptionItem) => (s.frequency === 'yearly' ? Math.round(s.amount / 12) : s.amount);
const annualOf = (s: SubscriptionItem) => (s.frequency === 'yearly' ? s.amount : s.amount * 12);

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  onClose,
  onOpenAddModal,
  subscriptions: sharedSubscriptions,
  onAddSubscription,
  onUpdateSubscription,
  onDeleteSubscription
}) => {
  const { t, lang, categoryLabel } = useLang();
  const monthLabelDisplay = useMemo(
    () => (lang === 'th' ? TODAY.toLocaleDateString('th-TH-u-ca-gregory', { month: 'long', year: 'numeric' }) : MONTH_LABEL),
    [lang]
  );
  const [localSubscriptions, setLocalSubscriptions] = useState<SubscriptionItem[]>(INITIAL_SUBSCRIPTIONS);
  const subscriptions = sharedSubscriptions ?? localSubscriptions;
  const addSubscription = (sub: SubscriptionItem) =>
    onAddSubscription ? onAddSubscription(sub) : setLocalSubscriptions(prev => [sub, ...prev]);
  const updateSubscription = (id: string, patch: Partial<SubscriptionItem>) =>
    onUpdateSubscription ? onUpdateSubscription(id, patch) : setLocalSubscriptions(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  const removeSubscription = (id: string) =>
    onDeleteSubscription ? onDeleteSubscription(id) : setLocalSubscriptions(prev => prev.filter(s => s.id !== id));

  // Renewals still to come, soonest first
  const upcoming = useMemo(
    () =>
      subscriptions
        .filter(s => s.status === 'active' && s.nextRenewalDate > TODAY_ISO)
        .sort((a, b) => a.nextRenewalDate.localeCompare(b.nextRenewalDate)),
    [subscriptions]
  );
  const dueThisWeek = upcoming.filter(s => daysFromToday(s.nextRenewalDate) <= 7);
  const dueThisWeekTotal = dueThisWeek.reduce((sum, s) => sum + s.amount, 0);

  const [activeTab, setActiveTab] = useState<'calendar' | 'savings'>('calendar');
  const [selectedDay, setSelectedDay] = useState<number>(() =>
    upcoming[0] && upcoming[0].nextRenewalDate.startsWith(MONTH_PREFIX) ? upcoming[0].billingDay : TODAY_DAY
  );
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Cloud / AI' | 'Entertainment' | 'Utilities'>('All');
  const [isCommitmentExpanded, setIsCommitmentExpanded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Savings analysis state
  const [savingsTimeframe, setSavingsTimeframe] = useState<'monthly' | 'annual'>('annual');
  const [simulatedDisabledIds, setSimulatedDisabledIds] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'category' | 'services'>('category');

  // New subscription form state
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmount, setNewSubAmount] = useState('');
  const [newSubLastPaid, setNewSubLastPaid] = useState(TODAY_ISO);
  const [newSubFrequency, setNewSubFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [newSubCategory, setNewSubCategory] = useState<'Entertainment' | 'Bills & Utilities'>('Bills & Utilities');

  // The subscription a person tapped, to mark as paid or remove
  const [manageSub, setManageSub] = useState<SubscriptionItem | null>(null);

  // Total monthly commitment (a yearly plan counts as 1/12th of its amount here, not the full charge)
  const totalCommitment = useMemo(() => {
    return subscriptions.reduce((sum, s) => sum + monthlyOf(s), 0);
  }, [subscriptions]);

  const annualCommitment = useMemo(() => {
    return subscriptions.reduce((sum, s) => sum + annualOf(s), 0);
  }, [subscriptions]);

  const mostExpensive = useMemo(
    () => [...subscriptions].sort((a, b) => monthlyOf(b) - monthlyOf(a))[0],
    [subscriptions],
  );

  // Active subscriptions under simulator
  const simulatedActiveSubscriptions = useMemo(() => {
    return subscriptions.filter(s => !simulatedDisabledIds.includes(s.id));
  }, [subscriptions, simulatedDisabledIds]);

  const simulatedMonthlyCost = useMemo(() => {
    return simulatedActiveSubscriptions.reduce((sum, s) => sum + monthlyOf(s), 0);
  }, [simulatedActiveSubscriptions]);

  const simulatedAnnualCost = useMemo(() => {
    return simulatedActiveSubscriptions.reduce((sum, s) => sum + annualOf(s), 0);
  }, [simulatedActiveSubscriptions]);
  const simulatedMonthlySavings = totalCommitment - simulatedMonthlyCost;
  const simulatedAnnualSavings = annualCommitment - simulatedAnnualCost;

  const toggleSimulation = (id: string) => {
    setSimulatedDisabledIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleResetSimulation = () => {
    setSimulatedDisabledIds([]);
  };

  // Group by category for Chart
  const categoryChartData: SubscriptionChartPoint[] = useMemo(() => {
    const map: { [cat: string]: { name: string; fullName: string; amount: number; annual: number; color: string; count: number } } = {
      'Home & Utilities': { name: t('sub.bucketHomeUtilities'), fullName: t('sub.bucketHomeUtilities'), amount: 0, annual: 0, color: '#5856D6', count: 0 },
      'Entertainment & Media': { name: t('sub.bucketEntertainmentShort'), fullName: t('sub.bucketEntertainmentFull'), amount: 0, annual: 0, color: '#FF2D55', count: 0 },
      'Cloud & AI Tools': { name: t('sub.bucketCloudShort'), fullName: t('sub.bucketCloudFull'), amount: 0, annual: 0, color: '#007AFF', count: 0 },
      'Telco & Mobile': { name: t('sub.bucketTelcoMobile'), fullName: t('sub.bucketTelcoMobile'), amount: 0, annual: 0, color: '#06C755', count: 0 }
    };

    subscriptions.forEach(s => {
      const m = monthlyOf(s);
      if (/Condo|MEA|MWA|Fib(er|re)/.test(s.name)) {
        map['Home & Utilities'].amount += m;
        map['Home & Utilities'].count += 1;
      } else if (s.iconName === 'cloud' || s.iconName === 'smart_toy') {
        map['Cloud & AI Tools'].amount += m;
        map['Cloud & AI Tools'].count += 1;
      } else if (s.category === 'Entertainment') {
        map['Entertainment & Media'].amount += m;
        map['Entertainment & Media'].count += 1;
      } else {
        map['Telco & Mobile'].amount += m;
        map['Telco & Mobile'].count += 1;
      }
    });

    return Object.values(map).map(cat => ({
      ...cat,
      annual: cat.amount * 12,
      displayAmount: savingsTimeframe === 'annual' ? cat.amount * 12 : cat.amount
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions, savingsTimeframe, t]);

  // Top individual subscriptions for services bar chart, ranked by their monthly-equivalent cost
  const servicesChartData: SubscriptionChartPoint[] = useMemo(() => {
    return [...subscriptions]
      .sort((a, b) => monthlyOf(b) - monthlyOf(a))
      .slice(0, 6)
      .map(s => ({
        name: s.name.length > 12 ? s.name.slice(0, 10) + '...' : s.name,
        fullName: s.name,
        amount: monthlyOf(s),
        annual: annualOf(s),
        displayAmount: savingsTimeframe === 'annual' ? annualOf(s) : monthlyOf(s),
        color: s.color,
        count: 1
      }));
  }, [subscriptions, savingsTimeframe]);

  // Filtered subscriptions based on category pill (for calendar view)
  const filteredSubscriptions = subscriptions.filter(sub => {
    if (categoryFilter === 'All') return true;
    if (categoryFilter === 'Cloud / AI') {
      return sub.iconName === 'cloud' || sub.iconName === 'smart_toy';
    }
    if (categoryFilter === 'Entertainment') {
      return sub.category === 'Entertainment';
    }
    if (categoryFilter === 'Utilities') {
      return sub.category === 'Bills & Utilities' && sub.iconName !== 'cloud';
    }
    return true;
  });

  // Category counts
  const cloudCount = subscriptions.filter(s => s.iconName === 'cloud' || s.iconName === 'smart_toy').length;
  const entertainmentCount = subscriptions.filter(s => s.category === 'Entertainment').length;

  // Subscriptions mapped by day
  const getSubsForDay = (day: number) => {
    return filteredSubscriptions.filter(s => s.billingDay === day);
  };

  const selectedDaySubs = getSubsForDay(selectedDay);
  const selectedDayTotal = selectedDaySubs.reduce((sum, s) => sum + s.amount, 0);

  // Calendar for the current month, built from the date: leading/trailing days
  // from neighbouring months, one dot per renewal (in the service's colour).
  const calendarWeeks = useMemo(() => {
    const firstDow = new Date(YEAR, MONTH, 1).getDay();
    const prevMonthDays = new Date(YEAR, MONTH, 0).getDate();
    const cells: { day: number; isCurrentMonth: boolean; dots?: string[] }[] = [];
    for (let i = firstDow - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, isCurrentMonth: false });
    for (let d = 1; d <= DAYS_IN_MONTH; d++) {
      const dots = filteredSubscriptions.filter(s => s.billingDay === d).map(s => s.color);
      cells.push({ day: d, isCurrentMonth: true, dots: dots.length ? dots.slice(0, 3) : undefined });
    }
    for (let d = 1; cells.length % 7; d++) cells.push({ day: d, isCurrentMonth: false });
    return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  }, [filteredSubscriptions]);

  const renewalDays = [...new Set(filteredSubscriptions.map(s => s.billingDay))].sort((a, b) => a - b);

  const handleAddNewSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubAmount) return;

    const parsedAmount = parseFloat(newSubAmount);
    if (!parsedAmount || parsedAmount <= 0) return;
    // "When did you last pay?" + how often it repeats is all that's needed: the next due date
    // follows automatically, and stays automatic every time it's marked paid from here on.
    const nextDate = addInterval(newSubLastPaid, newSubFrequency);
    const newSub: SubscriptionItem = {
      id: `sub-custom-${Date.now()}`,
      name: newSubName.trim(),
      planName: newSubFrequency === 'yearly' ? 'Yearly plan' : 'Monthly plan',
      provider: newSubName.trim(),
      category: newSubCategory,
      amount: parsedAmount,
      billingDay: Number(nextDate.slice(8, 10)),
      frequency: newSubFrequency,
      nextRenewalDate: nextDate,
      status: 'active',
      paymentMethod: 'KBank Auto Debit',
      iconName: newSubCategory === 'Entertainment' ? 'movie' : 'receipt_long',
      color: newSubCategory === 'Entertainment' ? '#FF2D55' : '#007AFF',
      remindDaysBefore: 2
    };

    addSubscription(newSub);
    setShowAddModal(false);
    setNewSubName('');
    setNewSubAmount('');
    setNewSubLastPaid(TODAY_ISO);
    setNewSubFrequency('monthly');
  };

  /** "I just paid this": today becomes the new last-paid date, and the next deadline follows automatically. */
  const handleMarkAsPaid = (sub: SubscriptionItem) => {
    const nextDate = addInterval(TODAY_ISO, sub.frequency);
    updateSubscription(sub.id, { nextRenewalDate: nextDate, billingDay: Number(nextDate.slice(8, 10)) });
    setManageSub(null);
  };

  const handleRemoveSubscription = (sub: SubscriptionItem) => {
    removeSubscription(sub.id);
    setManageSub(null);
  };

  return (
    <div className="space-y-4 pb-12 animate-fadeIn font-sans">
      {/* ============================================================ */}
      {/* TOP VIEW SWITCHER: Calendar View vs Cost & Savings Audit */}
      {/* ============================================================ */}
      <div className="flex items-center p-1 bg-[#E5E5EA]/70 dark:bg-neutral-800 rounded-2xl shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'calendar'
              ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs'
              : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">calendar_month</span>
          <span>{t('sub.renewalCalendar')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('savings')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'savings'
              ? 'bg-white dark:bg-neutral-900 text-[#008A3D] dark:text-[#06C755] shadow-xs'
              : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">savings</span>
          <span>{t('sub.costSavingsAudit')}</span>
          <span className="w-2 h-2 rounded-full bg-[#008A3D] dark:bg-[#06C755]" />
        </button>
      </div>

      {/* ============================================================ */}
      {/* VIEW A: RENEWAL CALENDAR (Exact match with screen.png) */}
      {/* ============================================================ */}
      {activeTab === 'calendar' && (
        <div className="space-y-4 animate-fadeIn">
          {/* 1. TOP CARD: MONTHLY COMMITMENT */}
          <section className="bg-white dark:bg-neutral-900 rounded-[26px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.05]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
                {t('sub.monthlyCommitment').toUpperCase()}
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="w-8 h-8 rounded-full bg-[#E8F9EE] dark:bg-emerald-950/60 text-[#06C755] flex items-center justify-center font-bold hover:scale-105 active:scale-95 transition cursor-pointer"
                aria-label={t('sub.addSubscription')}
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
            </div>

            {/* Big Amount */}
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[38px] font-extrabold text-black dark:text-white tracking-tight font-sans tabular-nums leading-none">
                ฿{totalCommitment.toLocaleString()}
              </span>
              <span className="text-[16px] font-medium text-[#8E8E93]">
                {t('sub.perMo')}
              </span>
            </div>

            {/* Dropdown status pill + Quick Savings Link */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCommitmentExpanded(!isCommitmentExpanded)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F2F2F7] dark:bg-neutral-800 text-[13px] font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200/70 transition"
              >
                <span className="w-2 h-2 rounded-full bg-[#06C755] shrink-0" />
                <span>{t('sub.activeRenewingThisWeek', { n: subscriptions.length, amount: `฿${dueThisWeekTotal.toLocaleString()}` })}</span>
                <span className="material-symbols-outlined text-[18px] text-[#8E8E93]">
                  {isCommitmentExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('savings')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#E8F9EE] dark:bg-emerald-950/50 text-[12px] font-bold text-[#008A3D] dark:text-[#06C755] hover:opacity-90 transition"
              >
                <span>{t('sub.annualPerYr', { amount: `฿${annualCommitment.toLocaleString()}` })}</span>
                <span className="text-[10px]">›</span>
              </button>
            </div>

            {/* Collapsible commitment breakdown */}
            {isCommitmentExpanded && (
              <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2 text-[12px] animate-fadeIn">
                {categoryChartData
                  .filter(c => c.count > 0)
                  .map(c => (
                    <div key={c.fullName} className="flex items-center justify-between text-[#6E6E73] dark:text-neutral-400">
                      <span>{c.fullName}:</span>
                      <span className="font-semibold text-black dark:text-white">
                        ฿{c.amount.toLocaleString()}{t('sub.perMoShort')} (฿{(c.amount * 12).toLocaleString()}{t('sub.perYrShort')})
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* MINI SPARKLINE: NEXT 12 MONTHS OUTLOOK */}
          <Subscription12MonthChart
            subscriptions={subscriptions}
            compact={true}
            onExploreSavings={() => setActiveTab('savings')}
          />

          {/* 2. UP NEXT SECTION */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
                {t('sub.upNext').toUpperCase()}
              </span>
              <span className="text-[12px] font-semibold text-[#06C755]">
                {t('sub.sortedByDate')}
              </span>
            </div>

            {/* Up Next List Card */}
            <div className="bg-white dark:bg-neutral-900 rounded-[24px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.05] overflow-hidden divide-y divide-[#F2F2F7] dark:divide-neutral-800">
              {upcoming.slice(0, 3).map((sub, i) => {
                const n = daysFromToday(sub.nextRenewalDate);
                return (
                  <div key={sub.id} onClick={() => setManageSub(sub)} className="p-4 flex items-center justify-between cursor-pointer active:bg-[#F2F2F7] dark:active:bg-neutral-800 transition">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ color: sub.color, background: `color-mix(in srgb, ${sub.color} 14%, var(--tile-base))` }}
                      >
                        <span className="material-symbols-outlined text-[24px]">{sub.iconName}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[16px] font-bold text-black dark:text-white leading-tight truncate">{sub.name}</h4>
                        <p className="text-[13px] text-[#6E6E73] dark:text-neutral-400 mt-0.5 leading-tight">
                          {t('sub.autoRenews', { date: shortDate(sub.nextRenewalDate) })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="money text-[17px] font-bold text-black dark:text-white tabular-nums block">฿{sub.amount.toLocaleString()}</span>
                      <span
                        className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          i === 0 && n <= 3
                            ? 'bg-[#FDE8E8] dark:bg-red-950/40 text-[#C62828] dark:text-red-400'
                            : 'bg-[#F2F2F7] dark:bg-neutral-800 text-[#6E6E73] dark:text-neutral-400'
                        }`}
                      >
                        {n === 1 ? t('sub.tomorrow') : t('sub.inNDays', { n })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. CATEGORY FILTER PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-[13px]">
            <button
              type="button"
              onClick={() => setCategoryFilter('All')}
              className={`px-4 py-2 rounded-full font-semibold transition active:scale-95 shrink-0 ${
                categoryFilter === 'All'
                  ? 'bg-[#06C755] text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 border border-[#E5E5EA] dark:border-neutral-800 text-neutral-800 dark:text-neutral-200'
              }`}
            >
              {t('sub.all')} ({subscriptions.length})
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('Cloud / AI')}
              className={`px-4 py-2 rounded-full font-medium transition active:scale-95 shrink-0 ${
                categoryFilter === 'Cloud / AI'
                  ? 'bg-[#06C755] text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-neutral-900 border border-[#E5E5EA] dark:border-neutral-800 text-neutral-800 dark:text-neutral-200'
              }`}
            >
              {t('sub.cloudAi')} ({cloudCount})
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('Entertainment')}
              className={`px-4 py-2 rounded-full font-medium transition active:scale-95 shrink-0 ${
                categoryFilter === 'Entertainment'
                  ? 'bg-[#06C755] text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-neutral-900 border border-[#E5E5EA] dark:border-neutral-800 text-neutral-800 dark:text-neutral-200'
              }`}
            >
              {t('sub.entertainment')} ({entertainmentCount})
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('Utilities')}
              className={`px-4 py-2 rounded-full font-medium transition active:scale-95 shrink-0 ${
                categoryFilter === 'Utilities'
                  ? 'bg-[#06C755] text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-neutral-900 border border-[#E5E5EA] dark:border-neutral-800 text-neutral-800 dark:text-neutral-200'
              }`}
            >
              {t('sub.utilities')}
            </button>
          </div>

          {/* 4. CALENDAR CARD (September 2026) */}
          <section className="bg-white dark:bg-neutral-900 rounded-[26px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.05]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-[18px] font-bold text-black dark:text-white tracking-tight">
                  {monthLabelDisplay}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedDay(TODAY_DAY)}
                  className="px-2 py-0.5 rounded-full bg-[#E8F9EE] dark:bg-emerald-950/60 text-[#008A3D] dark:text-[#06C755] text-[11px] font-bold"
                >
                  {t('sub.today')}
                </button>
              </div>
            </div>

            {/* Days of Week Row */}
            <div className="grid grid-cols-7 text-center text-[12px] font-semibold text-[#6E6E73] dark:text-neutral-400 mb-2">
              {WEEKDAY_HEAD.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            {/* Calendar Day Grid */}
            <div className="space-y-1">
              {calendarWeeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-cols-7 text-center">
                  {week.map((item, dIdx) => {
                    const isSelected = item.isCurrentMonth && item.day === selectedDay;

                    return (
                      <button
                        type="button"
                        key={dIdx}
                        onClick={() => {
                          if (item.isCurrentMonth) {
                            setSelectedDay(item.day);
                          }
                        }}
                        className={`h-11 flex flex-col items-center justify-center rounded-full transition relative group focus:outline-hidden ${
                          isSelected
                            ? 'cursor-default'
                            : item.isCurrentMonth
                            ? 'hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer'
                            : 'cursor-default'
                        }`}
                      >
                        {isSelected ? (
                          <div className="w-10 h-10 rounded-full bg-[#06C755] text-white flex flex-col items-center justify-center shadow-xs">
                            <span className="text-[14px] font-bold leading-none">{item.day}</span>
                            <div className="flex items-center gap-0.5 mt-0.5 h-1">
                              {(item.dots ?? []).map((_, i) => (
                                <span key={i} className="w-1 h-1 rounded-full bg-white" />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <span
                              className={`text-[14px] leading-tight font-sans ${
                                item.isCurrentMonth && item.day === TODAY_DAY
                                  ? 'font-bold text-[#008A3D] dark:text-[#06C755] underline underline-offset-4 decoration-2'
                                  : item.isCurrentMonth
                                  ? `font-medium ${item.day < TODAY_DAY ? 'text-neutral-400 dark:text-neutral-500' : 'text-black dark:text-white'}`
                                  : 'text-neutral-300 dark:text-neutral-700 font-normal'
                              }`}
                            >
                              {item.day}
                            </span>

                            <div className="h-1.5 flex items-center gap-0.5 justify-center mt-0.5">
                              {item.isCurrentMonth && item.dots && item.dots.map((dotColor, dotIdx) => (
                                <span
                                  key={dotIdx}
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: dotColor }}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          {/* 5. DAY RENEWAL BREAKDOWN (28 SEPTEMBER · ฿398 TOTAL) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div>
                <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                  {t('sub.dayTotal', { day: selectedDay, month: lang === 'th' ? monthLabelDisplay.split(' ')[0] : MONTH_LABEL.split(' ')[0].toUpperCase(), amount: `฿${selectedDayTotal.toLocaleString()}` })}
                </span>
                <span className="text-[13px] text-[#8E8E93] block mt-0.5">
                  {selectedDay < TODAY_DAY
                    ? selectedDaySubs.length === 1
                      ? t('sub.oneSubRenewed')
                      : t('sub.nSubsRenewed', { n: selectedDaySubs.length })
                    : selectedDaySubs.length === 1
                      ? t('sub.oneSubRenewing')
                      : t('sub.nSubsRenewing', { n: selectedDaySubs.length })}
                </span>
              </div>

              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#8E8E93]">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
              </div>
            </div>

            {/* Selected Day Subscriptions List */}
            <div className="space-y-2.5">
              {selectedDaySubs.length > 0 ? (
                selectedDaySubs.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => setManageSub(sub)}
                    className="p-4 bg-white dark:bg-neutral-900 rounded-[22px] border border-black/[0.04] dark:border-white/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center justify-between transition hover:shadow-xs cursor-pointer active:bg-[#F2F2F7] dark:active:bg-neutral-800"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ color: sub.color, background: `color-mix(in srgb, ${sub.color} 14%, var(--tile-base))` }}
                      >
                        <span className="material-symbols-outlined text-[24px]">{sub.iconName}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-bold text-black dark:text-white leading-tight truncate">
                          {sub.name}
                        </h4>
                        <p className="text-[12px] text-[#6E6E73] dark:text-neutral-400 mt-0.5 leading-tight truncate">
                          {sub.planName ?? categoryLabel(sub.category)} · {sub.paymentMethod} · {t('sub.dReminder', { n: sub.remindDaysBefore ?? 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[16px] font-bold text-black dark:text-white font-sans tabular-nums">
                        ฿{sub.amount}
                      </span>
                      <span className="material-symbols-outlined text-[20px] text-[#8E8E93]">
                        chevron_right
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 bg-white dark:bg-neutral-900 rounded-[22px] border border-black/[0.04] text-center">
                  <span className="material-symbols-outlined text-[28px] text-[#8E8E93] mb-1">event_available</span>
                  <p className="text-[14px] font-medium text-black dark:text-white">{t('sub.noRenewalsOnDay', { day: selectedDay })}</p>
                  <p className="text-[12px] text-[#6E6E73] dark:text-neutral-400 mt-0.5">
                    {t('sub.daysWithDotHaveRenewals', { days: renewalDays.join(', ') })}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW B: COST & RECURRING SAVINGS AUDIT (Requested by User!) */}
      {/* ============================================================ */}
      {activeTab === 'savings' && (
        <div className="space-y-4 animate-fadeIn">
          {/* 1. AGGREGATED METRIC HERO CARD */}
          <section className="bg-white dark:bg-neutral-900 rounded-[26px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.05]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
                {t('sub.recurringSpendAggregate').toUpperCase()}
              </span>

              {/* Monthly vs Annual Toggle */}
              <div className="flex items-center p-0.5 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSavingsTimeframe('monthly')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    savingsTimeframe === 'monthly'
                      ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs'
                      : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
                  }`}
                >
                  {t('sub.monthly')}
                </button>
                <button
                  type="button"
                  onClick={() => setSavingsTimeframe('annual')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    savingsTimeframe === 'annual'
                      ? 'bg-white dark:bg-neutral-900 text-[#008A3D] dark:text-[#06C755] shadow-xs'
                      : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
                  }`}
                >
                  {t('sub.annual12m')}
                </button>
              </div>
            </div>

            {/* Total Recurring Figures */}
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-[36px] font-black text-black dark:text-white tracking-tight font-sans tabular-nums leading-none">
                ฿{savingsTimeframe === 'annual' ? annualCommitment.toLocaleString() : totalCommitment.toLocaleString()}
              </span>
              <span className="text-[15px] font-medium text-[#8E8E93]">
                {savingsTimeframe === 'annual' ? t('sub.perYear') : t('sub.perMonth')}
              </span>
            </div>

            {/* 3-metric quick stat strip */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <div className="p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-neutral-800/60">
                <span className="text-[10px] font-bold text-[#8E8E93] uppercase block">{t('sub.activeSubs')}</span>
                <span className="text-[15px] font-bold text-black dark:text-white mt-0.5 block">{subscriptions.length} {t('sub.items')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-neutral-800/60">
                <span className="text-[10px] font-bold text-[#8E8E93] uppercase block">{t('sub.avgPerService')}</span>
                <span className="text-[15px] font-bold text-black dark:text-white mt-0.5 block">
                  ฿{Math.round(totalCommitment / subscriptions.length).toLocaleString()}<span className="text-[11px] font-normal text-[#8E8E93]">{t('sub.perMoShort')}</span>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-neutral-800/60 min-w-0">
                <span className="text-[10px] font-bold text-[#8E8E93] uppercase block">{t('sub.priciest')}</span>
                {mostExpensive ? (
                  <>
                    <span className="text-[15px] font-bold text-black dark:text-white mt-0.5 block truncate">{mostExpensive.name}</span>
                    <span className="text-[11px] text-[#8E8E93] block">
                      ฿{Math.round(monthlyOf(mostExpensive)).toLocaleString()}{t('sub.perMoShort')}
                    </span>
                  </>
                ) : (
                  <span className="text-[15px] font-bold text-black dark:text-white mt-0.5 block">—</span>
                )}
              </div>
            </div>
          </section>

          {/* 12-MONTH STACKED BAR / SPARKLINE DISTRIBUTION */}
          <Subscription12MonthChart
            subscriptions={subscriptions}
            compact={false}
          />

          {/* 2. VISUAL DISTRIBUTION CHART */}
          <section className="bg-white dark:bg-neutral-900 rounded-[26px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.05]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[15px] font-bold text-black dark:text-white leading-tight">
                  {t('sub.recurringCostAllocation')}
                </h3>
                <p className="text-[12px] text-[#8E8E93] mt-0.5">
                  {t('sub.breakdownByCategory', { timeframe: savingsTimeframe === 'annual' ? t('sub.annualProjection') : t('sub.monthlyCost') })}
                </p>
              </div>

              {/* Chart Mode Switcher */}
              <div className="flex bg-[#F2F2F7] dark:bg-neutral-800 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setChartType('category')}
                  className={`px-2 py-1 rounded-md font-semibold transition ${
                    chartType === 'category'
                      ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-2xs'
                      : 'text-[#8E8E93]'
                  }`}
                >
                  {t('sub.categories')}
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('services')}
                  className={`px-2 py-1 rounded-md font-semibold transition ${
                    chartType === 'services'
                      ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-2xs'
                      : 'text-[#8E8E93]'
                  }`}
                >
                  {t('sub.topSubs')}
                </button>
              </div>
            </div>

            {/* Recharts Chart */}
            <div className="h-44 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartType === 'category' ? categoryChartData : servicesChartData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#8E8E93', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#8E8E93', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `฿${val > 999 ? `${Math.round(val / 1000)}k` : val}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-neutral-800 p-2.5 rounded-xl shadow-lg border border-black/5 dark:border-white/10 text-[12px]">
                            <span className="font-bold text-black dark:text-white block">{data.fullName || data.name}</span>
                            <span className="text-[#008A3D] font-bold">
                              ฿{data.displayAmount ? data.displayAmount.toLocaleString() : data.amount.toLocaleString()}
                              <span className="text-[10px] text-neutral-500 font-normal"> ({savingsTimeframe === 'annual' ? t('sub.annual12m') : t('sub.monthly')})</span>
                            </span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="displayAmount" radius={[6, 6, 0, 0]}>
                    {(chartType === 'category' ? categoryChartData : servicesChartData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category percentage legends */}
            <div className="grid grid-cols-2 gap-2 pt-3 mt-2 border-t border-neutral-100 dark:border-neutral-800 text-[12px]">
              {categoryChartData.map((cat) => {
                const percent = Math.round((cat.amount / totalCommitment) * 100);
                return (
                  <div key={cat.name} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-neutral-700 dark:text-neutral-300 truncate">{cat.name}</span>
                    </div>
                    <span className="font-bold text-black dark:text-white tabular-nums shrink-0">
                      {percent}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. INTERACTIVE "WHAT IF YOU TRIM?" SIMULATOR */}
          <section className="bg-white dark:bg-neutral-900 rounded-[26px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.05] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-black dark:text-white leading-tight">
                  {t('sub.trimSimulator')}
                </h3>
                <p className="text-[12px] text-[#8E8E93] mt-0.5">
                  {t('sub.toggleOffToSee')}
                </p>
              </div>

              {simulatedDisabledIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetSimulation}
                  className="text-[11px] font-bold text-[#008A3D] dark:text-[#06C755] hover:underline"
                >
                  {t('sub.resetAll')}
                </button>
              )}
            </div>

            {/* Real-time simulation feedback banner */}
            {simulatedDisabledIds.length > 0 ? (
              <div className="p-3 bg-[#E8F9EE] dark:bg-emerald-950/50 rounded-2xl border border-[#008A3D]/20 flex items-center justify-between text-[13px] animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#008A3D]">check_circle</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {simulatedDisabledIds.length === 1 ? t('sub.pausedOneService') : t('sub.pausedNServices', { n: simulatedDisabledIds.length })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-black text-[#008A3D] dark:text-[#06C755] block">
                    {t('sub.saveAmountPerMo', { amount: `฿${simulatedMonthlySavings.toLocaleString()}` })}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                    {t('sub.amountPerYear', { amount: `฿${simulatedAnnualSavings.toLocaleString()}` })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-[#F2F2F7] dark:bg-neutral-800/60 rounded-xl text-[12px] text-[#8E8E93] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">touch_app</span>
                <span>{t('sub.uncheckToTest')}</span>
              </div>
            )}

            {/* List of subscriptions with toggle switches */}
            <div className="space-y-2 pt-1">
              {subscriptions.map((sub) => {
                const isPaused = simulatedDisabledIds.includes(sub.id);

                return (
                  <div
                    key={sub.id}
                    onClick={() => toggleSimulation(sub.id)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      isPaused
                        ? 'bg-neutral-100/60 dark:bg-neutral-800/40 border-dashed border-neutral-300 dark:border-neutral-700 opacity-60'
                        : 'bg-white dark:bg-neutral-900 border-black/[0.04] dark:border-white/[0.05] hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                          !isPaused
                            ? 'bg-[#008A3D] border-[#008A3D] text-white'
                            : 'border-neutral-400 bg-white dark:bg-neutral-800'
                        }`}
                      >
                        {!isPaused && <span className="material-symbols-outlined text-[15px]">check</span>}
                      </div>

                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 text-[16px]"
                        style={{ backgroundColor: sub.color }}
                      >
                        <span className="material-symbols-outlined text-[18px]">{sub.iconName}</span>
                      </div>

                      <div className="min-w-0">
                        <span className={`text-[13px] font-bold block truncate ${isPaused ? 'line-through text-[#8E8E93]' : 'text-black dark:text-white'}`}>
                          {sub.name}
                        </span>
                        <span className="text-[11px] text-[#8E8E93] block truncate">
                          {t('sub.next')} {shortDate(sub.nextRenewalDate)} · {sub.paymentMethod}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[14px] font-bold font-sans tabular-nums block ${isPaused ? 'line-through text-[#8E8E93]' : 'text-black dark:text-white'}`}>
                        ฿{sub.amount.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#8E8E93]">
                        {sub.frequency === 'monthly' ? t('sub.perMoShort') : t('sub.perYrShort')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ============================================================ */}
      {/* ADD SUBSCRIPTION MODAL */}
      {/* ============================================================ */}
      {showAddModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-[28px] p-6 w-full max-w-sm border border-black/10 dark:border-white/10 shadow-2xl space-y-4 max-h-[90%] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-bold text-black dark:text-white">
                {t('sub.addSubscription')}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddNewSubscription} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase block mb-1">
                  {t('sub.serviceName')}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Disney+ Hotstar"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-[14px] text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[#8E8E93] uppercase block mb-1">
                    {t('sub.fee')}
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="299"
                    value={newSubAmount}
                    onChange={(e) => setNewSubAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-[14px] text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#8E8E93] uppercase block mb-1">
                    {t('sub.charged')}
                  </label>
                  <div className="flex p-0.5 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl h-[38px]">
                    {(['monthly', 'yearly'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setNewSubFrequency(f)}
                        className={`flex-1 rounded-lg text-[13px] font-semibold transition ${
                          newSubFrequency === f ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs' : 'text-[#8E8E93]'
                        }`}
                      >
                        {f === 'monthly' ? t('sub.monthly') : t('sub.yearly')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase block mb-1">
                  {t('sub.whenDidYouLastPay')}
                </label>
                <input
                  type="date"
                  required
                  max={TODAY_ISO}
                  value={newSubLastPaid}
                  onChange={(e) => setNewSubLastPaid(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-[14px] text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
                />
                <p className="text-[11px] text-[#8E8E93] mt-1">
                  {t('sub.autoNextDueHint')}
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase block mb-1">
                  {t('sub.category')}
                </label>
                <select
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-[14px] text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
                >
                  <option value="Bills & Utilities">{t('sub.cloudAiUtilities')}</option>
                  <option value="Entertainment">{t('sub.entertainment')}</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#06C755] hover:bg-[#05B34C] text-white font-bold rounded-2xl shadow-xs active:scale-[0.99] transition"
                >
                  {t('sub.saveSubscription')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MANAGE A SUBSCRIPTION: mark it paid, or remove it */}
      {/* ============================================================ */}
      {manageSub && (
        <Sheet onClose={() => setManageSub(null)}>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ color: manageSub.color, background: `color-mix(in srgb, ${manageSub.color} 14%, var(--tile-base))` }}
            >
              <span className="material-symbols-outlined text-[24px]">{manageSub.iconName}</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-[17px] font-bold text-black dark:text-white leading-tight truncate">{manageSub.name}</h3>
              <p className="text-[13px] text-[#8E8E93]">
                ฿{manageSub.amount.toLocaleString()} {manageSub.frequency === 'yearly' ? t('sub.perYrShort') : t('sub.perMoShort')}
              </p>
            </div>
          </div>
          <p className="text-[13px] text-[#6E6E73] dark:text-neutral-400 mt-3">
            {t('sub.nextDueLabel')} <b className="text-black dark:text-white">{shortDate(manageSub.nextRenewalDate)}</b>
            {daysFromToday(manageSub.nextRenewalDate) >= 0 ? ` · ${t('sub.inNDays', { n: daysFromToday(manageSub.nextRenewalDate) })}` : ` · ${t('sub.overdue')}`}
          </p>
          <button
            type="button"
            onClick={() => handleMarkAsPaid(manageSub)}
            className="w-full mt-4 py-3.5 rounded-2xl bg-[#008A3D] text-white text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {t('sub.markAsPaidToday')}
          </button>
          <p className="text-[11px] text-[#8E8E93] text-center mt-2">
            {t('sub.movesNextDueTo', { date: shortDate(addInterval(TODAY_ISO, manageSub.frequency)) })}
          </p>
          <button
            type="button"
            onClick={() => handleRemoveSubscription(manageSub)}
            className="w-full mt-3 py-3 rounded-2xl bg-red-50 dark:bg-red-950/30 text-[#C62828] dark:text-red-400 text-[14px] font-semibold active:scale-[0.99] transition"
          >
            {t('sub.removeSubscription')}
          </button>
        </Sheet>
      )}
    </div>
  );
};
