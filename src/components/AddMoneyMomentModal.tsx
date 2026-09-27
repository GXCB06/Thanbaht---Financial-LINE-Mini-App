import React, { useState, useEffect } from 'react';
import { Transaction, CategoryType, TransactionSource } from '../types/finance';
import { detectCategoryFromTitle } from '../utils/categoryMatcher';
import { TODAY_ISO, nowTime } from '../lib/clock';
import { baht, slipDateTime } from '../lib/format';

interface AddMoneyMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Adds records and shows an undo toast; the user stays where they are. */
  onAddTransactions: (txs: Transaction[], message: string) => void;
  onOpenReview: () => void;
  onOpenLineChat: () => void;
  /** Real data: slips and voice notes are read by the bot in the chat, so those two cards point there instead of the demo. */
  live?: boolean;
  /** Used to spot a slip that was already logged (same bank reference). */
  transactions: Transaction[];
}

const OWNER = 'นาย ธัญญ์พิสิษฐ์ โ.';

type ModalView = 'menu' | 'upload' | 'say' | 'type';

export const AddMoneyMomentModal: React.FC<AddMoneyMomentModalProps> = ({
  isOpen,
  onClose,
  onAddTransactions,
  onOpenReview,
  onOpenLineChat,
  live = false,
  transactions
}) => {
  const [view, setView] = useState<ModalView>('menu');

  // "Type it" state
  const [typeInput, setTypeInput] = useState('กาแฟ 65');
  const [inputError, setInputError] = useState<string | null>(null);

  // "Upload slips" state
  const [slip1Logged, setSlip1Logged] = useState(true);
  const [slip2Logged, setSlip2Logged] = useState(false);
  const [slip3Logged, setSlip3Logged] = useState(false);

  // "Say it" state
  const [spokenResult, setSpokenResult] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(true);

  // Reset view on modal open
  useEffect(() => {
    if (isOpen) {
      setView('menu');
      setTypeInput('กาแฟ 65');
      setInputError(null);
      setSlip1Logged(true);
      setSlip2Logged(false);
      setSlip3Logged(false);
      setSpokenResult(null);
      setIsListening(true);
    }
  }, [isOpen]);

  // Handle upload progress simulation when view switches to 'upload'
  useEffect(() => {
    if (view === 'upload') {
      const timer1 = setTimeout(() => {
        setSlip2Logged(true);
      }, 1200);

      const timer2 = setTimeout(() => {
        setSlip3Logged(true);
      }, 2400);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [view]);

  // Handle Speech Recognition Web API (if supported) when in 'say' view
  useEffect(() => {
    if (view === 'say') {
      setIsListening(true);
      setSpokenResult(null);

      // Web Speech API
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'th-TH';
          recognition.continuous = false;
          recognition.interimResults = false;

          recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
              handleProcessSpokenText(transcript);
            }
          };

          recognition.onerror = () => {
            setIsListening(false);
          };

          recognition.onend = () => {
            setIsListening(false);
          };

          recognition.start();

          return () => {
            try {
              recognition.stop();
            } catch (_) {}
          };
        } catch (_) {
          setIsListening(false);
        }
      }
    }
  }, [view]);

  if (!isOpen) return null;

  // Parser for natural text like "กาแฟ 65" or "ได้ค่าจ้าง 1500".
  // No amount → null (we ask again instead of inventing one).
  const parseNaturalInput = (input: string) => {
    const text = input.trim();
    const numberMatch = text.replace(/,/g, '').match(/\d+(\.\d+)?/);
    if (!numberMatch) return null;
    const amountVal = parseFloat(numberMatch[0]);
    const merchantTitle = text.replace(/,/g, '').replace(numberMatch[0], '').replace(/บาท|baht|฿/gi, '').trim() || 'Quick add';
    const matched = detectCategoryFromTitle(text);
    const category: CategoryType = matched ? matched.category : 'Uncategorized';
    const isIncome = category === 'Income';
    return { title: merchantTitle, amount: isIncome ? amountVal : -amountVal, category, isIncome };
  };

  const buildQuickTx = (text: string, source: TransactionSource): Transaction | null => {
    const parsed = parseNaturalInput(text);
    if (!parsed) return null;
    const unknown = parsed.category === 'Uncategorized';
    return {
      id: `tx-${source}-${Date.now()}`,
      title: parsed.title,
      amount: parsed.amount,
      category: parsed.category,
      date: TODAY_ISO,
      time: nowTime(),
      verifiedFromSlip: false,
      paymentMethod: 'Cash',
      account: 'cash',
      source,
      said: text,
      // Not sure what it is? Park it in Review rather than guessing
      status: unknown ? 'review' : 'ok',
      review: unknown ? { kind: 'who' } : undefined,
    };
  };

  const quickMessage = (tx: Transaction) =>
    tx.status === 'review'
      ? `Saved ${baht(tx.amount)} · pick a category in Review`
      : `Logged ${tx.amount > 0 ? '+' : '−'}${baht(tx.amount)} · ${tx.category}`;

  const handleProcessSpokenText = (text: string) => {
    setSpokenResult(text);
    setIsListening(false);
    const tx = buildQuickTx(text, 'voice');
    if (!tx) {
      setInputError('I didn’t catch an amount. Try “ค่าแท็กซี่ 180”.');
      return;
    }
    setInputError(null);
    setTimeout(() => {
      onAddTransactions([tx], quickMessage(tx));
      onClose();
    }, 900);
  };

  const handleAddTypedTransaction = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typeInput.trim()) return;
    const tx = buildQuickTx(typeInput, 'text');
    if (!tx) {
      setInputError('Add an amount, e.g. “กาแฟ 65”.');
      return;
    }
    onAddTransactions([tx], quickMessage(tx));
    onClose();
  };

  // The third slip in the demo batch was already logged earlier today: same bank ref
  const alreadyLogged = transactions.find(
    t => t.status === 'ok' && t.title === "Lotus's Rama 4" && t.date === TODAY_ISO && t.slip,
  );

  const handleDoneUploadSlips = () => {
    const slip = (
      id: string,
      title: string,
      amount: number,
      category: CategoryType,
      time: string,
      account: Transaction['account'],
      bank: { name: string; code: 'KBANK' | 'TMN' | 'KTB'; type: string },
      recipient: string,
      ref: string,
    ): Transaction => ({
      id: `${id}-${Date.now()}`,
      title,
      amount: -amount,
      category,
      date: TODAY_ISO,
      time,
      verifiedFromSlip: false,
      paymentMethod: bank.type,
      account,
      source: 'slip',
      status: 'ok',
      slip: {
        bankName: bank.name,
        bankCode: bank.code,
        slipType: bank.type,
        status: 'โอนเงินสำเร็จ',
        amount,
        senderName: OWNER,
        recipientName: recipient,
        recipientPromptPay: '0105537024190',
        refNo: ref,
        dateTimeStr: slipDateTime(TODAY_ISO, time),
      },
    });

    const batch: Transaction[] = [
      slip('tx-slip-gourmet', 'Gourmet Market', 312, 'Groceries', '20:55', 'kbank', { name: 'KBank', code: 'KBANK', type: 'K PLUS · e-Slip' }, 'Gourmet Market Co., Ltd.', 'KB-20260923-339102'),
      slip('tx-slip-7eleven', '7-Eleven (TrueMoney)', 145, 'Groceries', '21:10', 'tmn', { name: 'TrueMoney', code: 'TMN', type: 'TrueMoney · e-Slip' }, 'CP All Public Co., Ltd.', 'TM-20260923-881902'),
    ];
    if (alreadyLogged?.slip) {
      batch.push({
        ...slip('tx-slip-lotus', "Lotus's Rama 4", Math.abs(alreadyLogged.amount), 'Groceries', alreadyLogged.time, 'ktb', { name: 'Krungthai', code: 'KTB', type: 'Krungthai NEXT · e-Slip' }, "Lotus's Rama 4", alreadyLogged.slip.refNo),
        status: 'review',
        review: { kind: 'dup', dupOf: alreadyLogged.id },
      });
    } else {
      batch.push(slip('tx-slip-amazon', 'Cafe Amazon (KTB)', 85, 'Food & Dining', '21:20', 'ktb', { name: 'Krungthai', code: 'KTB', type: 'Krungthai NEXT · e-Slip' }, 'Cafe Amazon Siam', 'KTB-20260923-774011'));
    }

    const dupes = batch.filter(t => t.status === 'review').length;
    onAddTransactions(
      batch,
      dupes ? `Logged ${batch.length - dupes} of ${batch.length} slips · ${dupes} needs a look in Review` : `Logged ${batch.length} slips`,
    );
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs animate-fadeIn">
      {/* Click outside backdrop to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Bottom Sheet Container */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-neutral-900 rounded-t-[32px] p-6 shadow-2xl border-t border-black/5 dark:border-white/10 animate-slideUp">
        {/* Pull-down handle bar */}
        <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full mx-auto mb-4 cursor-pointer" onClick={onClose} />

        {/* Back navigation button if in sub-flow */}
        {view !== 'menu' && (
          <button
            onClick={() => setView('menu')}
            className="mb-3 -ml-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#008A3D] dark:text-[#06C755] hover:opacity-80 transition"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Back to options</span>
          </button>
        )}

        {/* ============================================================ */}
        {/* VIEW 1: MAIN MENU (Screenshot 2: Add money moment) */}
        {/* ============================================================ */}
        {view === 'menu' && (
          <div>
            <h2 className="text-[22px] font-bold text-black dark:text-white tracking-tight">
              Add money moment
            </h2>
            <p className="text-[14px] text-[#737373] dark:text-neutral-400 mt-1 leading-snug">
              Fastest: forward slips to the Thanbaht chat. Everything lands here.
            </p>

            {/* 2x2 Grid of Function Cards */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              {/* Card 1: Upload slips */}
              <button
                type="button"
                onClick={() => (live ? (onClose(), onOpenLineChat()) : setView('upload'))}
                className="bg-[#F5F6F5] dark:bg-neutral-800/80 hover:bg-[#EBEEEB] dark:hover:bg-neutral-800 p-4 rounded-[22px] text-left transition active:scale-[0.98] border border-black/[0.02] dark:border-white/[0.04] flex flex-col justify-between h-[135px]"
              >
                <div className="w-7 h-7 flex items-center justify-center text-[#008A3D] dark:text-[#06C755]">
                  <span className="material-symbols-outlined text-[26px]">image</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-black dark:text-white leading-tight">
                    Upload slips
                  </h3>
                  <p className="text-[12px] text-[#737373] dark:text-neutral-400 mt-1 leading-snug">
                    {live ? 'Send them in the chat' : 'Pick many at once from any bank app'}
                  </p>
                </div>
              </button>

              {/* Card 2: Say it */}
              <button
                type="button"
                onClick={() => (live ? (onClose(), onOpenLineChat()) : setView('say'))}
                className="bg-[#F5F6F5] dark:bg-neutral-800/80 hover:bg-[#EBEEEB] dark:hover:bg-neutral-800 p-4 rounded-[22px] text-left transition active:scale-[0.98] border border-black/[0.02] dark:border-white/[0.04] flex flex-col justify-between h-[135px]"
              >
                <div className="w-7 h-7 flex items-center justify-center text-[#008A3D] dark:text-[#06C755]">
                  <span className="material-symbols-outlined text-[26px]">mic</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-black dark:text-white leading-tight">
                    Say it
                  </h3>
                  <p className="text-[12px] text-[#737373] dark:text-neutral-400 mt-1 leading-snug">
                    {live ? 'Send a voice note in the chat' : '“ค่าแท็กซี่ 180”'}
                  </p>
                </div>
              </button>

              {/* Card 3: Type it */}
              <button
                type="button"
                onClick={() => setView('type')}
                className="bg-[#F5F6F5] dark:bg-neutral-800/80 hover:bg-[#EBEEEB] dark:hover:bg-neutral-800 p-4 rounded-[22px] text-left transition active:scale-[0.98] border border-black/[0.02] dark:border-white/[0.04] flex flex-col justify-between h-[135px]"
              >
                <div className="w-7 h-7 flex items-center justify-center text-[#008A3D] dark:text-[#06C755]">
                  <span className="material-symbols-outlined text-[26px]">text_fields</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-black dark:text-white leading-tight">
                    Type it
                  </h3>
                  <p className="text-[12px] text-[#737373] dark:text-neutral-400 mt-1 leading-snug">
                    “กาแฟ 65” · “ได้ค่าจ้าง 1500”
                  </p>
                </div>
              </button>

              {/* Card 4: Open chat */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLineChat();
                }}
                className="bg-[#F5F6F5] dark:bg-neutral-800/80 hover:bg-[#EBEEEB] dark:hover:bg-neutral-800 p-4 rounded-[22px] text-left transition active:scale-[0.98] border border-black/[0.02] dark:border-white/[0.04] flex flex-col justify-between h-[135px]"
              >
                <div className="w-7 h-7 flex items-center justify-center text-[#008A3D] dark:text-[#06C755]">
                  <span className="material-symbols-outlined text-[26px]">chat_bubble</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-black dark:text-white leading-tight">
                    Open chat
                  </h3>
                  <p className="text-[12px] text-[#737373] dark:text-neutral-400 mt-1 leading-snug">
                    Send slips, voice or text
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: UPLOAD SLIPS (Screenshot 3: Reading 3 slips...) */}
        {/* ============================================================ */}
        {view === 'upload' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-[22px] font-bold text-black dark:text-white tracking-tight">
                Reading 3 slips...
              </h2>
              <p className="text-[14px] text-[#737373] dark:text-neutral-400 mt-1 leading-snug">
                Checking the QR ref on each slip for duplicates
              </p>
            </div>

            {/* List of scanned slips */}
            <div className="space-y-2.5 pt-1">
              {/* Slip 1: Gourmet Market */}
              <div className="flex items-center justify-between p-3.5 bg-[#F5F6F5] dark:bg-neutral-800/80 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#008A3D] text-white font-bold flex items-center justify-center text-[14px] shrink-0 shadow-xs">
                    K
                  </div>
                  <span className="text-[15px] font-medium text-black dark:text-white">
                    Gourmet Market · ฿312
                  </span>
                </div>
                <span className="text-[14px] font-semibold text-[#008A3D] dark:text-[#06C755] flex items-center gap-0.5">
                  Logged ✓
                </span>
              </div>

              {/* Slip 2: TrueMoney */}
              <div className="flex items-center justify-between p-3.5 bg-[#F5F6F5] dark:bg-neutral-800/80 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FF6A00] text-white font-bold flex items-center justify-center text-[12px] shrink-0 shadow-xs">
                    TM
                  </div>
                  <span className="text-[15px] font-medium text-black dark:text-white">
                    {slip2Logged ? '7-Eleven · ฿145' : 'TrueMoney slip'}
                  </span>
                </div>
                {slip2Logged ? (
                  <span className="text-[14px] font-semibold text-[#008A3D] dark:text-[#06C755] flex items-center gap-0.5 animate-fadeIn">
                    Logged ✓
                  </span>
                ) : (
                  <div className="w-1.5 h-4 bg-[#008A3D] dark:bg-[#06C755] rounded-full animate-pulse mr-2" />
                )}
              </div>

              {/* Slip 3: Krungthai */}
              <div className="flex items-center justify-between p-3.5 bg-[#F5F6F5] dark:bg-neutral-800/80 rounded-2xl border border-black/[0.02] dark:border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#00A5E5] text-white font-bold flex items-center justify-center text-[11px] shrink-0 shadow-xs">
                    KTB
                  </div>
                  <span className="text-[15px] font-medium text-black dark:text-white">
                    {slip3Logged ? (alreadyLogged ? `Lotus's Rama 4 · ${baht(alreadyLogged.amount)}` : 'Cafe Amazon · ฿85') : 'Krungthai slip'}
                  </span>
                </div>
                {slip3Logged ? (
                  alreadyLogged ? (
                    <span className="text-[14px] font-semibold text-[#9A5B00] dark:text-amber-300 flex items-center gap-0.5 animate-fadeIn">
                      Duplicate?
                    </span>
                  ) : (
                    <span className="text-[14px] font-semibold text-[#008A3D] dark:text-[#06C755] flex items-center gap-0.5 animate-fadeIn">
                      Logged ✓
                    </span>
                  )
                ) : (
                  <div className="w-1.5 h-4 bg-[#008A3D] dark:bg-[#06C755] rounded-full animate-pulse mr-2" />
                )}
              </div>
            </div>

            {/* Done button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDoneUploadSlips}
                disabled={!slip3Logged}
                className="w-full py-3.5 px-4 bg-[#008A3D] hover:bg-[#007333] disabled:bg-[#6bb58f] disabled:cursor-wait text-white text-[16px] font-semibold rounded-2xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: SAY IT (Screenshot 4: Listening...) */}
        {/* ============================================================ */}
        {view === 'say' && (
          <div className="py-4 space-y-6 text-center">
            <h2 className="text-[24px] font-bold text-black dark:text-white tracking-tight">
              {isListening ? 'Listening...' : 'Processed!'}
            </h2>

            {/* Green animated sound waveform */}
            <div className="flex items-center justify-center gap-1.5 h-16 py-2">
              <span className="w-2 bg-[#008A3D] dark:bg-[#06C755] rounded-full animate-[pulse_1s_ease-in-out_infinite] h-8" />
              <span className="w-2 bg-[#008A3D] dark:bg-[#06C755] rounded-full animate-[pulse_1.2s_ease-in-out_infinite] h-14" />
              <span className="w-2 bg-[#008A3D] dark:bg-[#06C755] rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-10" />
              <span className="w-2 bg-[#008A3D] dark:bg-[#06C755] rounded-full animate-[pulse_1.4s_ease-in-out_infinite] h-6" />
              <span className="w-2 bg-[#008A3D] dark:bg-[#06C755] rounded-full animate-[pulse_0.9s_ease-in-out_infinite] h-12" />
              <span className="w-2 bg-[#008A3D] dark:bg-[#06C755] rounded-full animate-[pulse_1.1s_ease-in-out_infinite] h-7" />
            </div>

            {/* Prompt sample or transcribed speech */}
            <p className="text-[17px] text-[#737373] dark:text-neutral-400 font-medium">
              {spokenResult ? `“${spokenResult}”` : '“ค่าแท็กซี่ 180”'}
            </p>
            {inputError && (
              <p role="alert" className="text-[13px] font-medium text-[#9A5B00] dark:text-amber-300 -mt-3">
                {inputError}
              </p>
            )}

            {/* Interactive speech test chips */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-2">
                Or tap to simulate saying:
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {['ค่าแท็กซี่ 180', 'ข้าวมันไก่ 60', 'กาแฟ 65', 'Grab 145'].map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => handleProcessSpokenText(phrase)}
                    className="px-3 py-1.5 rounded-full bg-[#F5F6F5] dark:bg-neutral-800 hover:bg-[#008A3D] hover:text-white dark:hover:bg-[#06C755] text-[13px] font-medium text-black dark:text-white transition active:scale-95 border border-black/5 dark:border-white/5"
                  >
                    “{phrase}”
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 4: TYPE IT (Screenshot 5: Type it) */}
        {/* ============================================================ */}
        {view === 'type' && (
          <form onSubmit={handleAddTypedTransaction} className="space-y-4">
            <div>
              <h2 className="text-[22px] font-bold text-black dark:text-white tracking-tight">
                Type it
              </h2>
              <p className="text-[14px] text-[#737373] dark:text-neutral-400 mt-1 leading-snug">
                Amount + a word or two. Thanbaht guesses the category.
              </p>
            </div>

            {/* Green outlined text input */}
            <div className="pt-1">
              <input
                type="text"
                autoFocus
                value={typeInput}
                onChange={(e) => {
                  setTypeInput(e.target.value);
                  setInputError(null);
                }}
                placeholder="e.g. กาแฟ 65 หรือ ค่าแท็กซี่ 180"
                aria-invalid={!!inputError}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border-2 border-[#008A3D] dark:border-[#06C755] rounded-2xl text-[16px] text-black dark:text-white focus:outline-hidden shadow-xs"
              />
              {inputError && (
                <p role="alert" className="mt-2 text-[13px] font-medium text-[#9A5B00] dark:text-amber-300">
                  {inputError}
                </p>
              )}
            </div>

            {/* Quick Suggestion Pills */}
            <div className="flex flex-wrap gap-2 pt-0.5">
              {['กาแฟ 65', 'ข้าวมันไก่ 60', 'grab 145', 'ได้ค่าจ้าง 1500'].map((chip) => (
                <button
                  type="button"
                  key={chip}
                  onClick={() => {
                    setTypeInput(chip);
                    setInputError(null);
                  }}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition active:scale-95 border ${
                    typeInput === chip
                      ? 'bg-[#008A3D] text-white border-[#008A3D]'
                      : 'bg-[#F5F6F5] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-black/5 dark:border-white/5 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Add action button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-[#008A3D] hover:bg-[#007032] text-white text-[16px] font-bold rounded-2xl shadow-md transition active:scale-[0.99] flex items-center justify-center"
              >
                Add
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
