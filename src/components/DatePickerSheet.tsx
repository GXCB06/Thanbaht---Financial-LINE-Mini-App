import React, { useState } from 'react';
import { TODAY, TODAY_ISO } from '../lib/clock';
import { Sheet } from './Sheet';

type Cadence = 'Daily' | 'Monthly' | 'Yearly';

interface DatePickerSheetProps {
  cadence: Cadence;
  cursor: Date;
  onPick: (d: Date) => void;
  onClose: () => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map(m => m.slice(0, 3));
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

const navBtn = 'w-8 h-8 rounded-full bg-[#F2F2F7] dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 disabled:opacity-30 active:scale-95 transition';
const cell = 'py-3 rounded-2xl text-[13px] font-semibold border transition active:scale-95 disabled:opacity-30 disabled:active:scale-100';
const cellOn = 'border-[#06C755] ring-2 ring-[#06C755]/25 text-[#06C755]';
const cellOff = 'border-black/[0.06] dark:border-white/10 text-black dark:text-white';

/** A calendar-style picker: a day grid for Daily, a month grid for Monthly, a year grid for Yearly. */
export const DatePickerSheet: React.FC<DatePickerSheetProps> = ({ cadence, cursor, onPick, onClose }) => {
  const [view, setView] = useState(() => new Date(cursor.getFullYear(), cadence === 'Daily' ? cursor.getMonth() : 0, 1));
  const todayY = TODAY.getFullYear();
  const todayM = TODAY.getMonth();
  const y = view.getFullYear();

  const pick = (d: Date) => {
    onPick(d);
    onClose();
  };

  if (cadence === 'Yearly') {
    const years = Array.from({ length: 9 }, (_, i) => todayY - i);
    return (
      <Sheet onClose={onClose}>
        <h3 className="text-[18px] font-bold text-black dark:text-white mb-3">Jump to year</h3>
        <div className="grid grid-cols-3 gap-2">
          {years.map(yr => (
            <button key={yr} onClick={() => pick(new Date(yr, 0, 1))} className={`${cell} ${yr === cursor.getFullYear() ? cellOn : cellOff}`}>
              {yr}
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  if (cadence === 'Monthly') {
    const future = (mo: number) => y * 12 + mo > todayY * 12 + todayM;
    return (
      <Sheet onClose={onClose}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setView(new Date(y - 1, 0, 1))} className={navBtn} aria-label="Previous year">
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <h3 className="text-[17px] font-bold text-black dark:text-white">{y}</h3>
          <button onClick={() => setView(new Date(y + 1, 0, 1))} disabled={y >= todayY} className={navBtn} aria-label="Next year">
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MON.map((label, i) => {
            const isCurrent = y === cursor.getFullYear() && i === cursor.getMonth();
            return (
              <button key={label} disabled={future(i)} onClick={() => pick(new Date(y, i, 1))} className={`${cell} ${isCurrent ? cellOn : cellOff}`}>
                {label}
              </button>
            );
          })}
        </div>
      </Sheet>
    );
  }

  // Daily: a real month calendar
  const m = view.getMonth();
  const n = daysIn(y, m);
  const firstDow = new Date(y, m, 1).getDay();
  const atLatest = y * 12 + m >= todayY * 12 + todayM;
  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setView(new Date(y, m - 1, 1))} className={navBtn} aria-label="Previous month">
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <h3 className="text-[17px] font-bold text-black dark:text-white">
          {MONTHS[m]} {y}
        </h3>
        <button onClick={() => setView(new Date(y, m + 1, 1))} disabled={atLatest} className={navBtn} aria-label="Next month">
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] font-semibold text-[#8E8E93] mb-1">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: firstDow }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: n }, (_, i) => i + 1).map(d => {
          const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
          const isFuture = iso > TODAY_ISO;
          const isToday = iso === TODAY_ISO;
          const isSelected = y === cursor.getFullYear() && m === cursor.getMonth() && d === cursor.getDate();
          return (
            <div key={d} className="flex items-center justify-center py-0.5">
              <button
                disabled={isFuture}
                onClick={() => pick(new Date(y, m, d))}
                className={`w-9 h-9 rounded-full text-[13px] font-medium flex items-center justify-center transition active:scale-90 disabled:opacity-25 ${
                  isSelected
                    ? 'bg-[#06C755] text-white font-bold'
                    : isToday
                      ? 'border border-[#06C755] text-[#06C755] font-bold'
                      : 'text-black dark:text-white hover:bg-[#F2F2F7] dark:hover:bg-neutral-800'
                }`}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
};
