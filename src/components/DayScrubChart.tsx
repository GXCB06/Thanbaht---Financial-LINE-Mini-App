import React, { useRef, useState } from 'react';
import { Stats } from '../lib/ledger';
import { DAYS_IN_MONTH, MONTH_LABEL, TODAY_DAY, isoOf } from '../lib/clock';
import { baht, dayLabel, kbaht, niceTicks } from '../lib/format';

interface Props {
  stats: Stats;
  /** The day kept by a tap. It stays until tapped again or cleared. */
  pinned: number | null;
  onPin: (day: number | null) => void;
  /** The day under a finger (or the mouse) right now, or null when nothing is touching the chart. */
  onScrub: (day: number | null) => void;
}

const W = 340;
const H = 132;
const BOTTOM = 18;
const TOP = 14;
const MOVE_THRESHOLD = 8; // px: below this, a press is a tap; above it, a slide

const card = 'bg-white dark:bg-neutral-900 rounded-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]';

/**
 * Daily spending for the month.
 *  - Press and slide a finger (or move the mouse) across the bars: the day under it is read out
 *    live, and the list below follows.
 *  - Tap a bar to keep that day. Tap it again, or press Clear, to let go.
 */
export const DayScrubChart: React.FC<Props> = ({ stats, pinned, onPin, onScrub }) => {
  const box = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; moved: boolean; day: number } | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [learned, setLearned] = useState(false); // the hint goes away once someone has slid across the bars

  const shown = active ?? pinned;
  const bw = W / DAYS_IN_MONTH;
  const ticks = niceTicks(Math.max(...stats.byDay.slice(1), 1), 2);
  const max = ticks[ticks.length - 1];
  const y = (v: number) => H - BOTTOM - (v / max) * (H - BOTTOM - TOP);

  const dayAt = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const f = Math.min(0.999999, Math.max(0, (clientX - r.left) / r.width));
    return Math.min(TODAY_DAY, Math.floor(f * DAYS_IN_MONTH) + 1); // days to come have nothing to show
  };

  const look = (day: number | null) => {
    if (day !== null && day !== active) navigator.vibrate?.(4); // a tiny tick on phones that support it
    setActive(day);
    onScrub(day);
  };

  const onDown = (e: React.PointerEvent) => {
    const day = dayAt(e.clientX);
    press.current = { x: e.clientX, moved: false, day };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    look(day);
  };
  const onMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p) {
      if (Math.abs(e.clientX - p.x) > MOVE_THRESHOLD) {
        if (!p.moved) setLearned(true);
        p.moved = true;
      }
      look(dayAt(e.clientX));
    } else if (e.pointerType === 'mouse') {
      look(dayAt(e.clientX)); // desktop: just hover
    }
  };
  const onUp = () => {
    const p = press.current;
    press.current = null;
    if (p && !p.moved) onPin(pinned === p.day ? null : p.day); // a tap keeps the day
    look(null);
  };
  const onCancel = () => {
    press.current = null;
    look(null);
  };
  const onLeave = (e: React.PointerEvent) => {
    if (!press.current && e.pointerType === 'mouse') look(null);
  };

  const spentOn = shown ? stats.byDay[shown] : 0;
  const countOn = shown ? stats.countByDay[shown] : 0;

  return (
    <section className={`${card} p-4 select-none`}>
      {/* The readout keeps a fixed height so the chart never jumps while you slide */}
      <div className="flex items-start justify-between h-[58px]">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-neutral-400">
            {shown ? dayLabel(isoOf(shown)) : MONTH_LABEL}
          </p>
          <p className="money text-[30px] leading-9 font-bold tracking-tight tabular-nums text-black dark:text-white">
            {baht(shown ? spentOn : stats.spent)}
          </p>
        </div>
        <div className="text-right pt-0.5">
          {shown ? (
            <>
              <p className="text-[13px] font-medium text-[#6E6E73] dark:text-neutral-400">
                {countOn ? `${countOn} ${countOn === 1 ? 'record' : 'records'}` : 'Nothing logged'}
              </p>
              {pinned === shown && !active && (
                <button
                  onClick={() => onPin(null)}
                  className="mt-1 inline-flex items-center gap-0.5 h-7 px-2.5 rounded-full bg-[#F2F2F7] dark:bg-neutral-800 text-[12px] font-semibold text-black dark:text-white active:scale-95 transition"
                >
                  Clear <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              )}
            </>
          ) : (
            <p className="money text-[14px] font-semibold text-[#15803D] dark:text-[#4ADE80] tabular-nums">+{baht(stats.income)}</p>
          )}
        </div>
      </div>

      <div
        ref={box}
        className="relative mt-2 touch-pan-y cursor-crosshair"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onPointerLeave={onLeave}
        role="img"
        aria-label="Daily spending this month. Press and slide to look at a day, tap to keep it."
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible pointer-events-none">
          {ticks.slice(1).map(v => (
            <g key={v}>
              <line x1="0" x2={W} y1={y(v)} y2={y(v)} className="stroke-[#E5E5EA] dark:stroke-neutral-800" strokeDasharray="3 3" />
              <text x={W} y={y(v) - 3} textAnchor="end" fontSize="10" className="fill-[#6E6E73] dark:fill-neutral-400">
                {kbaht(v)}
              </text>
            </g>
          ))}

          {shown && <line x1={(shown - 0.5) * bw} x2={(shown - 0.5) * bw} y1={TOP - 6} y2={H - BOTTOM} className="stroke-[#06C755]" strokeWidth="1.5" strokeDasharray="3 3" />}

          {Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1).map(d => {
            const x = (d - 1) * bw + 1.5;
            const w = bw - 3;
            const v = stats.byDay[d];
            const base = H - BOTTOM;
            if (d > TODAY_DAY) return <rect key={d} x={x} y={base - 8} width={w} height={8} rx={3} fill="none" className="stroke-[#D1D1D6] dark:stroke-neutral-700" strokeDasharray="2 2" />;
            if (!stats.countByDay[d]) {
              const missed = stats.unloggedDays.includes(d);
              return (
                <g key={d}>
                  <rect x={x} y={base - (missed ? 8 : 2)} width={w} height={missed ? 8 : 2} rx={missed ? 3 : 1} fill={missed ? 'none' : undefined} stroke={missed ? '#9A5B00' : undefined} strokeDasharray={missed ? '2 1.5' : undefined} className={missed ? '' : 'fill-[#E5E5EA] dark:fill-neutral-700'} />
                  {missed && (
                    <text x={x + w / 2} y={base - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#9A5B00">
                      ?
                    </text>
                  )}
                </g>
              );
            }
            const h = Math.max(4, base - y(v));
            const on = shown === d;
            const fill = on ? 'fill-[#06C755]' : d === TODAY_DAY ? 'fill-[#1C1C1E] dark:fill-white' : shown ? 'fill-[#D8DDD9] dark:fill-neutral-700' : 'fill-[#B9C2BC] dark:fill-neutral-600';
            return <path key={d} d={`M${x},${base} v${-(h - 3)} q0,-3 3,-3 h${w - 6} q3,0 3,3 v${h - 3}z`} className={`${fill} transition-colors duration-100`} />;
          })}

          {[1, 8, 15, DAYS_IN_MONTH]
            .filter(d => Math.abs(d - TODAY_DAY) > 2)
            .map(d => (
              <text key={d} x={(d - 0.5) * bw} y={H - 4} textAnchor="middle" fontSize="10" className="fill-[#6E6E73] dark:fill-neutral-400">
                {d}
              </text>
            ))}
          <text x={(TODAY_DAY - 0.5) * bw} y={H - 4} textAnchor="middle" fontSize="10" fontWeight="700" className="fill-black dark:fill-white">
            {TODAY_DAY}
          </text>
          {shown && shown !== TODAY_DAY && Math.abs(shown - TODAY_DAY) > 1 && (
            <text x={(shown - 0.5) * bw} y={H - 4} textAnchor="middle" fontSize="10" fontWeight="700" className="fill-[#008A3D]">
              {shown}
            </text>
          )}
        </svg>
      </div>

      {!learned && !shown && (
        <p className="mt-1 flex items-center justify-center gap-1 text-[12px] text-[#6E6E73] dark:text-neutral-400">
          <span className="material-symbols-outlined text-[16px]">swipe</span>
          Hold and slide across the days
        </p>
      )}
    </section>
  );
};
