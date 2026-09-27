import React, { useEffect, useRef, useState } from 'react';
import { captureSlip, captureText, captureVoice, type CaptureResult } from '../lib/api';
import { MediaError, VoiceRecorder, prepareImage, type PreparedImage } from '../lib/media';
import { toTransaction, type ServerTx } from '../lib/liveData';
import { baht } from '../lib/format';
import { CategoryIcon } from './CategoryIcon';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called as soon as records are saved, so they appear behind the sheet while it is still open. */
  onRecords: (txs: ServerTx[]) => void;
  onOpenReview: () => void;
  onOpenLineChat: () => void;
}

type View = 'menu' | 'upload' | 'say' | 'type';

const MAX_SLIPS = 6;
const MAX_SECONDS = 30;
const EXAMPLES = ['กาแฟ 65', 'ข้าวมันไก่ 60', 'grab 145', 'ได้ค่าจ้าง 1500'];

const tone = {
  ok: 'text-[#15803D] dark:text-[#4ADE80]',
  warn: 'text-[#9A5B00] dark:text-amber-300',
  bad: 'text-[#C62828] dark:text-red-400',
};

interface SlipRow {
  id: number;
  name: string;
  thumb?: string;
  state: 'wait' | 'reading' | 'done';
  label?: string;
  tone?: keyof typeof tone;
  tx?: ServerTx;
  retry?: boolean;
}

const optionCard = 'bg-[#F5F6F5] dark:bg-neutral-800/80 hover:bg-[#EBEEEB] dark:hover:bg-neutral-800 p-4 rounded-[22px] text-left transition active:scale-[0.98] border border-black/[0.02] dark:border-white/[0.04] flex flex-col justify-between h-[118px]';
const primaryBtn = 'w-full h-12 rounded-2xl bg-[#008A3D] hover:bg-[#007333] text-white text-[16px] font-semibold active:scale-[0.99] transition disabled:opacity-40 disabled:active:scale-100';
const ghostBtn = 'w-full h-12 rounded-2xl bg-[#F2F2F7] dark:bg-neutral-800 text-black dark:text-white text-[16px] font-semibold active:scale-[0.99] transition';

const Spinner = () => <span className="inline-block w-5 h-5 rounded-full border-2 border-[#008A3D]/25 border-t-[#008A3D] animate-spin" aria-label="Working" />;

/** What each kind of answer means to a person. */
function describe(res: CaptureResult): { label: string; tone: keyof typeof tone; retry?: boolean } {
  switch (res.result) {
    case 'saved':
      return res.tx?.status === 'review'
        ? { label: res.tx.review_kind === 'dup' ? 'Duplicate?' : 'Who is this?', tone: 'warn' }
        : { label: 'Logged ✓', tone: 'ok' };
    case 'notSlip':
      return { label: 'Not a slip', tone: 'bad' };
    case 'unreadable':
      return { label: 'Couldn’t read it', tone: 'bad' };
    case 'busy':
      return res.reason === 'quota' ? { label: 'Reading limit reached', tone: 'warn' } : { label: 'Busy, try again', tone: 'warn', retry: true };
    case 'slow_down':
      return { label: 'Too many, wait a bit', tone: 'warn' };
    default:
      return { label: 'Can’t use this file', tone: 'bad' };
  }
}

export const AddSheet: React.FC<Props> = ({ isOpen, onClose, onRecords, onOpenReview, onOpenLineChat }) => {
  const [view, setView] = useState<View>('menu');
  const picker = useRef<HTMLInputElement>(null);

  // upload
  const [rows, setRows] = useState<SlipRow[]>([]);
  const files = useRef(new Map<number, File>());
  const prepared = useRef(new Map<number, PreparedImage>());
  const seq = useRef(0);

  // say
  const recorder = useRef<VoiceRecorder | null>(null);
  const [voice, setVoice] = useState<{ phase: 'listening' | 'reading' | 'done' | 'error'; secs: number; transcript?: string; txs?: ServerTx[]; error?: string; canRetry?: boolean }>({ phase: 'listening', secs: 0 });

  // type
  const [words, setWords] = useState('');
  const [typing, setTyping] = useState<{ busy: boolean; txs?: ServerTx[]; message?: string }>({ busy: false });

  useEffect(() => {
    if (!isOpen) return;
    setView('menu');
    setRows([]);
    files.current.clear();
    prepared.current.clear();
    setWords('');
    setTyping({ busy: false });
  }, [isOpen]);

  // the recording clock
  useEffect(() => {
    if (view !== 'say' || voice.phase !== 'listening') return;
    const t = setInterval(() => setVoice(v => (v.phase === 'listening' ? { ...v, secs: v.secs + 1 } : v)), 1000);
    return () => clearInterval(t);
  }, [view, voice.phase]);
  useEffect(() => {
    if (view === 'say' && voice.phase === 'listening' && voice.secs >= MAX_SECONDS) void stopSay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.secs]);

  if (!isOpen) return null;

  const close = () => {
    recorder.current?.cancel();
    recorder.current = null;
    onClose();
  };

  /* ---------------- upload slips ---------------- */

  const setRow = (id: number, patch: Partial<SlipRow>) => setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const readSlip = async (id: number) => {
    setRow(id, { state: 'reading', label: undefined, retry: false });
    try {
      let img = prepared.current.get(id);
      if (!img) {
        img = await prepareImage(files.current.get(id)!);
        prepared.current.set(id, img);
        setRow(id, { thumb: img.thumb });
      }
      const res = await captureSlip(img.mime, img.data);
      if (res.tx) onRecords([res.tx]);
      const d = describe(res);
      setRow(id, { state: 'done', label: d.label, tone: d.tone, retry: d.retry, tx: res.tx ?? undefined });
    } catch (e) {
      const notPicture = e instanceof MediaError;
      setRow(id, { state: 'done', label: notPicture ? 'Not a picture' : 'Couldn’t send', tone: 'bad', retry: !notPicture });
    }
  };

  const chooseSlips = async (list: FileList | null) => {
    if (!list?.length) return;
    const picked = [...list].slice(0, MAX_SLIPS);
    const first = seq.current;
    seq.current += picked.length;
    picked.forEach((f, i) => files.current.set(first + i, f));
    setView('upload');
    setRows(picked.map((f, i) => ({ id: first + i, name: f.name, state: 'wait' as const })));
    for (let i = 0; i < picked.length; i++) await readSlip(first + i); // one at a time: kind to the reading service
    if (picker.current) picker.current.value = '';
  };

  const openPicker = () => picker.current?.click();

  const finished = rows.length > 0 && rows.every(r => r.state === 'done');
  const logged = rows.filter(r => r.tx && r.tx.status === 'ok').length;
  const needCheck = rows.filter(r => r.tx && r.tx.status === 'review').length;
  const failed = rows.filter(r => r.state === 'done' && !r.tx).length;

  /* ---------------- say it ---------------- */

  const startSay = async () => {
    setView('say');
    setVoice({ phase: 'listening', secs: 0 });
    recorder.current = new VoiceRecorder();
    try {
      await recorder.current.start();
    } catch (e) {
      const m = e as MediaError;
      setVoice({
        phase: 'error',
        secs: 0,
        error: m.code === 'denied' ? 'The microphone is blocked. Allow it, or send a voice note in the chat.' : 'Recording isn’t available here. Send a voice note in the chat instead.',
      });
    }
  };

  async function stopSay() {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    setVoice(v => ({ ...v, phase: 'reading' }));
    try {
      const audio = await rec.stop();
      const res = await captureVoice(audio.mime, audio.data);
      if (res.txs?.length) onRecords(res.txs);
      if (res.result === 'saved') setVoice({ phase: 'done', secs: 0, transcript: res.transcript, txs: res.txs });
      else
        setVoice({
          phase: 'error',
          secs: 0,
          transcript: res.transcript,
          canRetry: true,
          error:
            res.result === 'nohear'
              ? res.transcript
                ? `I heard “${res.transcript}” but no amount. Try “ค่าแท็กซี่ 180”.`
                : 'I couldn’t hear that. Try again a bit closer.'
              : res.result === 'busy'
                ? res.reason === 'quota'
                  ? 'The reading limit is used up for now. Type it instead, or try later.'
                  : 'Voice reading is busy right now. Try again in a moment.'
                : res.result === 'slow_down'
                  ? 'That’s a lot of voice notes. Wait a few minutes.'
                  : 'That recording couldn’t be used.',
        });
    } catch (e) {
      setVoice({ phase: 'error', secs: 0, canRetry: true, error: e instanceof MediaError ? e.message : 'Couldn’t send the recording. Check your connection.' });
    }
  }

  /* ---------------- type it ---------------- */

  const submitWords = async () => {
    const text = words.trim();
    if (!text || typing.busy) return;
    setTyping({ busy: true });
    try {
      const res = await captureText(text);
      if (res.txs?.length) onRecords(res.txs);
      setTyping(res.result === 'saved' ? { busy: false, txs: res.txs } : { busy: false, message: 'Add an amount, like “กาแฟ 65”.' });
    } catch {
      setTyping({ busy: false, message: 'Couldn’t save. Check your connection.' });
    }
  };

  /* ---------------- layout ---------------- */

  const TxLine: React.FC<{ tx: ServerTx; note?: string; noteTone?: keyof typeof tone }> = ({ tx, note, noteTone }) => {
    const t = toTransaction(tx);
    return (
      <div className="flex items-center gap-3 min-w-0">
        <CategoryIcon category={t.category} isIncome={t.amount > 0} className="w-10 h-10 rounded-[12px]" size={20} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-black dark:text-white truncate">{t.title}</p>
          {note && <p className={`text-[12px] font-semibold ${tone[noteTone ?? 'ok']}`}>{note}</p>}
        </div>
        <span className="money text-[15px] font-bold tabular-nums text-black dark:text-white">
          {t.amount > 0 ? '+' : '−'}
          {baht(t.amount)}
        </span>
      </div>
    );
  };

  const wave = (
    <div className="flex items-center justify-center gap-1.5 h-[60px]" aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <i key={i} className="block w-1.5 rounded-full bg-[#008A3D] dark:bg-[#06C755] animate-wave" style={{ animationDelay: `${i * 0.11}s`, height: 10 }} />
      ))}
    </div>
  );

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="absolute inset-0" onClick={close} />
      <input ref={picker} type="file" accept="image/*" multiple className="hidden" onChange={e => void chooseSlips(e.target.files)} />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-neutral-900 rounded-t-[32px] px-5 pt-3 pb-6 shadow-2xl border-t border-black/5 dark:border-white/10 animate-slideUp max-h-[92%] overflow-y-auto">
        <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full mx-auto mb-4 cursor-pointer" onClick={close} />

        {view !== 'menu' && (
          <button
            onClick={() => {
              recorder.current?.cancel();
              recorder.current = null;
              setView('menu');
            }}
            className="mb-2 -ml-1 inline-flex items-center gap-0.5 text-[14px] font-semibold text-[#008A3D] dark:text-[#06C755]"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>Back
          </button>
        )}

        {/* ---------- menu ---------- */}
        {view === 'menu' && (
          <div>
            <h2 className="text-[24px] font-bold text-black dark:text-white tracking-tight">Add money moment</h2>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => {
                  openPicker(); // the tap is what lets the browser open the photo picker
                  setView('upload');
                  setRows([]);
                }}
                className={optionCard}
              >
                <span className="material-symbols-outlined text-[28px] text-[#008A3D] dark:text-[#06C755]">image</span>
                <span>
                  <b className="block text-[16px] text-black dark:text-white">Upload slips</b>
                  <span className="text-[13px] text-[#6E6E73] dark:text-neutral-400">From your photos</span>
                </span>
              </button>
              <button onClick={() => void startSay()} className={optionCard}>
                <span className="material-symbols-outlined text-[28px] text-[#008A3D] dark:text-[#06C755]">mic</span>
                <span>
                  <b className="block text-[16px] text-black dark:text-white">Say it</b>
                  <span className="text-[13px] text-[#6E6E73] dark:text-neutral-400">“ค่าแท็กซี่ 180”</span>
                </span>
              </button>
              <button
                onClick={() => {
                  setView('type');
                  setTyping({ busy: false });
                  setWords('');
                }}
                className={optionCard}
              >
                <span className="material-symbols-outlined text-[28px] text-[#008A3D] dark:text-[#06C755]">text_fields</span>
                <span>
                  <b className="block text-[16px] text-black dark:text-white">Type it</b>
                  <span className="text-[13px] text-[#6E6E73] dark:text-neutral-400">“กาแฟ 65”</span>
                </span>
              </button>
              <button
                onClick={() => {
                  close();
                  onOpenLineChat();
                }}
                className={optionCard}
              >
                <span className="material-symbols-outlined text-[28px] text-[#008A3D] dark:text-[#06C755]">chat_bubble</span>
                <span>
                  <b className="block text-[16px] text-black dark:text-white">Open chat</b>
                  <span className="text-[13px] text-[#6E6E73] dark:text-neutral-400">Send it there</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ---------- upload slips ---------- */}
        {view === 'upload' && (
          <div className="space-y-4">
            {rows.length === 0 ? (
              <div className="py-6 text-center space-y-4">
                <span className="material-symbols-outlined text-[44px] text-[#008A3D] dark:text-[#06C755]">add_photo_alternate</span>
                <p className="text-[18px] font-bold text-black dark:text-white">Pick your slips</p>
                <button onClick={openPicker} className={primaryBtn}>
                  Choose photos
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-[22px] font-bold text-black dark:text-white tracking-tight">
                  {finished ? (failed + needCheck === 0 ? `Logged ${logged}` : `Logged ${logged} of ${rows.length}`) : `Reading ${rows.length} ${rows.length === 1 ? 'slip' : 'slips'}…`}
                </h2>
                <div className="space-y-2.5">
                  {rows.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#F5F6F5] dark:bg-neutral-800/70 min-h-[64px]">
                      {r.tx ? (
                        <div className="flex-1 min-w-0">
                          <TxLine tx={r.tx} note={r.label} noteTone={r.tone} />
                        </div>
                      ) : (
                        <>
                          {r.thumb ? (
                            <img src={r.thumb} alt="" className="w-10 h-10 rounded-[12px] object-cover shrink-0" />
                          ) : (
                            <span className="w-10 h-10 rounded-[12px] bg-white dark:bg-neutral-700 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[20px] text-neutral-400">image</span>
                            </span>
                          )}
                          <span className="flex-1 min-w-0">
                            <span className="block text-[14px] font-medium text-black dark:text-white truncate">{r.name}</span>
                            {r.label && <span className={`block text-[12px] font-semibold ${tone[r.tone ?? 'bad']}`}>{r.label}</span>}
                          </span>
                        </>
                      )}
                      {(r.state === 'reading' || r.state === 'wait') && <Spinner />}
                      {r.retry && (
                        <button onClick={() => void readSlip(r.id)} className="h-9 px-3 rounded-full bg-white dark:bg-neutral-700 text-[13px] font-semibold text-black dark:text-white active:scale-95 transition shrink-0">
                          Retry
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-1">
                  <button onClick={close} disabled={!finished} className={primaryBtn}>
                    Done
                  </button>
                  {finished && needCheck > 0 && (
                    <button
                      onClick={() => {
                        close();
                        onOpenReview();
                      }}
                      className={ghostBtn}
                    >
                      Check {needCheck}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ---------- say it ---------- */}
        {view === 'say' && (
          <div className="space-y-4 text-center">
            {voice.phase === 'listening' && (
              <>
                <h2 className="text-[22px] font-bold text-black dark:text-white">Listening…</h2>
                {wave}
                <p className="text-[15px] font-semibold tabular-nums text-[#6E6E73] dark:text-neutral-400">
                  0:{String(voice.secs).padStart(2, '0')}
                </p>
                <button onClick={() => void stopSay()} className={primaryBtn}>
                  Done
                </button>
              </>
            )}
            {voice.phase === 'reading' && (
              <div className="py-8 space-y-4">
                <Spinner />
                <p className="text-[17px] font-semibold text-black dark:text-white">Reading…</p>
              </div>
            )}
            {voice.phase === 'done' && (
              <div className="space-y-4 text-left">
                <p className="text-center text-[15px] text-[#6E6E73] dark:text-neutral-400">“{voice.transcript}”</p>
                <div className="space-y-2.5">
                  {voice.txs?.map(t => (
                    <div key={t.id} className="p-2.5 rounded-2xl bg-[#F5F6F5] dark:bg-neutral-800/70">
                      <TxLine tx={t} note={t.status === 'review' ? 'Who is this?' : 'Logged ✓'} noteTone={t.status === 'review' ? 'warn' : 'ok'} />
                    </div>
                  ))}
                </div>
                <button onClick={close} className={primaryBtn}>
                  Done
                </button>
              </div>
            )}
            {voice.phase === 'error' && (
              <div className="py-4 space-y-4">
                <span className="material-symbols-outlined text-[40px] text-[#9A5B00] dark:text-amber-300">mic_off</span>
                <p className="text-[15px] text-black dark:text-white leading-snug px-2">{voice.error}</p>
                {voice.canRetry ? (
                  <button onClick={() => void startSay()} className={primaryBtn}>
                    Try again
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      close();
                      onOpenLineChat();
                    }}
                    className={primaryBtn}
                  >
                    Open chat
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------- type it ---------- */}
        {view === 'type' && (
          <div className="space-y-3">
            {typing.txs ? (
              <div className="space-y-4">
                <h2 className="text-[22px] font-bold text-black dark:text-white tracking-tight">Logged {typing.txs.length}</h2>
                <div className="space-y-2.5">
                  {typing.txs.map(t => (
                    <div key={t.id} className="p-2.5 rounded-2xl bg-[#F5F6F5] dark:bg-neutral-800/70">
                      <TxLine tx={t} note={t.status === 'review' ? 'Who is this?' : 'Logged ✓'} noteTone={t.status === 'review' ? 'warn' : 'ok'} />
                    </div>
                  ))}
                </div>
                <button onClick={close} className={primaryBtn}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-[22px] font-bold text-black dark:text-white tracking-tight">Type it</h2>
                <textarea
                  autoFocus
                  rows={2}
                  value={words}
                  onChange={e => {
                    setWords(e.target.value);
                    if (typing.message) setTyping({ busy: false });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void submitWords();
                    }
                  }}
                  placeholder="กาแฟ 65"
                  enterKeyHint="done"
                  className="w-full resize-none rounded-2xl bg-[#F5F6F5] dark:bg-neutral-800 px-4 py-3 text-[17px] text-black dark:text-white placeholder-[#9A9AA0] focus:outline-hidden focus:ring-2 focus:ring-[#06C755]/40"
                />
                {typing.message && <p className="text-[13px] font-medium text-[#9A5B00] dark:text-amber-300">{typing.message}</p>}
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
                  {EXAMPLES.map(x => (
                    <button
                      key={x}
                      onClick={() => setWords(w => (w.trim() ? `${w.trim()}\n${x}` : x))}
                      className="h-9 px-3.5 rounded-full bg-[#F2F2F7] dark:bg-neutral-800 text-[14px] font-medium text-black dark:text-white shrink-0 active:scale-95 transition"
                    >
                      {x}
                    </button>
                  ))}
                </div>
                <button onClick={() => void submitWords()} disabled={!words.trim() || typing.busy} className={primaryBtn}>
                  {typing.busy ? 'Adding…' : 'Add'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
