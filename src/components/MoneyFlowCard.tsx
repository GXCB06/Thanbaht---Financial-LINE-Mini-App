import React, { useRef, useState } from 'react';
import { baht } from '../lib/format';

export interface FlowBar {
  /** shown in the readout when this bar is under a finger, e.g. "23 Sep" */
  label: string;
  amount: number;
  /** records of any kind in this bar */
  count: number;
  /** a bar that lies in the future: drawn faint and not selectable */
  future?: boolean;
}

interface Props {
  bars: FlowBar[];
  /** what the readout says when no bar is picked: the whole period */
  summary: { label: string; amount: number; count: number };
  /** tick labels under the bars: the bar index and its text */
  ticks: { index: number; text: string }[];
  pinned: number | null;
  onPin: (index: number | null) => void;
  onScrub: (index: number | null) => void;
}

const MOVE_THRESHOLD = 8; // px: below this a press is a tap, above it a slide

/**
 * The Money Flow card.
 *  - Press and slide a finger (or hover the mouse) across the bars: the readout follows, and so does the list below.
 *  - Tap a bar to keep it. Tap it again to let go.
 */
export const MoneyFlowCard: React.FC<Props> = ({ bars, summary, ticks, pinned, onPin, onScrub }) => {
  const box = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; moved: boolean; index: number } | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [learned, setLearned] = useState(false);

  const shown = scrub ?? pinned;
  const max = Math.max(...bars.map(b => b.amount), 1);
  const lastPickable = bars.reduce((last, b, i) => (b.future ? last : i), 0);

  const indexAt = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const f = Math.min(0.999999, Math.max(0, (clientX - r.left) / r.width));
    return Math.min(lastPickable, Math.floor(f * bars.length));
  };
  const look = (i: number | null) => {
    if (i !== null && i !== scrub) navigator.vibrate?.(4);
    setScrub(i);
    onScrub(i);
  };

  const onDown = (e: React.PointerEvent) => {
    const i = indexAt(e.clientX);
    press.current = { x: e.clientX, moved: false, index: i };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    look(i);
  };
  const onMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p) {
      if (Math.abs(e.clientX - p.x) > MOVE_THRESHOLD) {
        if (!p.moved) setLearned(true);
        p.moved = true;
      }
      look(indexAt(e.clientX));
    } else if (e.pointerType === 'mouse') look(indexAt(e.clientX));
  };
  const onUp = () => {
    const p = press.current;
    press.current = null;
    if (p && !p.moved) onPin(pinned === p.index ? null : p.index);
    look(null);
  };
  const onCancel = () => {
    press.current = null;
    look(null);
  };

  const info = shown !== null ? bars[shown] : null;

  return (
    <section className="bg-white dark:bg-neutral-900 rounded-[22px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#06C755]" />
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">MONEY FLOW</span>
        </div>
        <span className="text-[11px] font-medium text-[#8E8E93]">{learned || pinned !== null ? 'Tap a bar to keep it' : 'Hold and slide, or tap'}</span>
      </div>

      {/* The readout keeps one height, so nothing jumps while you slide */}
      <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-[#F2F2F7] dark:bg-neutral-800/60 mb-3 h-[46px]">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-black dark:text-white min-w-0">
          <span className="truncate">{info ? info.label : summary.label}</span>
          <span className="text-[#8E8E93] font-normal">·</span>
          <span className="text-[#8E8E93] font-normal text-[13px] shrink-0">
            {(info ? info.count : summary.count)} {(info ? info.count : summary.count) === 1 ? 'Transaction' : 'Transactions'}
          </span>
        </div>
        <span className="money text-[16px] font-bold text-black dark:text-white tabular-nums shrink-0 pl-2">{baht(info ? info.amount : summary.amount)}</span>
      </div>

      <div
        ref={box}
        className="h-28 flex items-end justify-between gap-[3px] pt-1 pb-1 touch-pan-y cursor-crosshair"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onPointerLeave={e => {
          if (!press.current && e.pointerType === 'mouse') look(null);
        }}
        role="img"
        aria-label="Money flow. Press and slide to look at each bar, tap to keep one."
      >
        {bars.map((b, i) => {
          const on = shown === i;
          const h = b.amount > 0 ? Math.max(12, (b.amount / max) * 100) : b.future ? 6 : 6;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full pointer-events-none">
              <div
                className={`w-full rounded-t-[3px] transition-colors duration-150 ${
                  on
                    ? 'bg-[#06C755] shadow-xs'
                    : b.future
                      ? 'bg-[#EEEEF1] dark:bg-neutral-800/60'
                      : b.amount > 0
                        ? shown !== null
                          ? 'bg-[#E5E5EA] dark:bg-neutral-700'
                          : 'bg-[#DADDE0] dark:bg-neutral-600'
                        : 'bg-[#EEEEF1] dark:bg-neutral-800'
                }`}
                style={{ height: `${h}%` }}
              />
              <div className="h-2 w-full flex items-center justify-center mt-1">{on && <span className="w-1.5 h-1.5 rounded-full bg-[#06C755]" />}</div>
            </div>
          );
        })}
      </div>

      <div className="relative h-4 text-[11px] font-medium text-[#8E8E93] pt-1 mx-1">
        {ticks.map(t => {
          const center = ((t.index + 0.5) / bars.length) * 100;
          const edge = t.index === 0 ? 'translate-x-0' : t.index === bars.length - 1 ? '-translate-x-full' : '-translate-x-1/2';
          const left = t.index === 0 ? 0 : t.index === bars.length - 1 ? 100 : center;
          return (
            <span key={t.index} className={`absolute whitespace-nowrap ${edge} ${shown === t.index ? 'text-[#06C755] font-semibold' : ''}`} style={{ left: `${left}%` }}>
              {t.text}
            </span>
          );
        })}
      </div>
    </section>
  );
};
