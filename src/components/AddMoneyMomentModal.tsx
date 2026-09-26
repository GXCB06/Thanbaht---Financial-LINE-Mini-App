import React, { useState, useEffect } from 'react';
import { Transaction, CategoryType } from '../types/finance';
import { detectCategoryFromTitle } from '../utils/categoryMatcher';

interface AddMoneyMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (newTx: Transaction) => void;
  onOpenLineChat: () => void;
}

type ModalView = 'menu' | 'upload' | 'say' | 'type';

export const AddMoneyMomentModal: React.FC<AddMoneyMomentModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  onOpenLineChat
}) => {
  const [view, setView] = useState<ModalView>('menu');

  // "Type it" state
  const [typeInput, setTypeInput] = useState('กาแฟ 65');

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

  // Parser helper for natural text like "กาแฟ 65" or "ได้ค่าจ้าง 1500"
  const parseNaturalInput = (input: string) => {
    const text = input.trim();
    // Find numbers (integer or decimal)
    const numberMatch = text.match(/\d+(\.\d+)?/);
    const amountVal = numberMatch ? parseFloat(numberMatch[0]) : 65;

    // Remaining text as merchant / title
    const merchantTitle = text.replace(/\d+(\.\d+)?/, '').trim() || 'General Expense';

    // Check if income
    const lower = text.toLowerCase();
    const isIncome =
      lower.includes('ได้ค่าจ้าง') ||
      lower.includes('เงินเดือน') ||
      lower.includes('โอนเข้า') ||
      lower.includes('income') ||
      lower.includes('salary');

    const matched = detectCategoryFromTitle(merchantTitle);
    const category: CategoryType = isIncome
      ? 'Income'
      : matched
      ? matched.category
      : 'Food & Dining';

    return {
      title: merchantTitle,
      amount: isIncome ? amountVal : -amountVal,
      category,
      isIncome
    };
  };

  const handleProcessSpokenText = (text: string) => {
    setSpokenResult(text);
    setIsListening(false);

    const parsed = parseNaturalInput(text);
    const newTx: Transaction = {
      id: `tx-voice-${Date.now()}`,
      title: parsed.title,
      amount: parsed.amount,
      category: parsed.category,
      date: '2026-09-25',
      time: '14:20 PM',
      verifiedFromSlip: false,
      paymentMethod: 'Voice Input',
      note: `Added via Say it voice: "${text}"`
    };

    setTimeout(() => {
      onAddTransaction(newTx);
      onClose();
    }, 900);
  };

  const handleAddTypedTransaction = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typeInput.trim()) return;

    const parsed = parseNaturalInput(typeInput);
    const newTx: Transaction = {
      id: `tx-typed-${Date.now()}`,
      title: parsed.title,
      amount: parsed.amount,
      category: parsed.category,
      date: '2026-09-25',
      time: '14:25 PM',
      verifiedFromSlip: false,
      paymentMethod: 'PromptPay',
      note: `Added via Type it: "${typeInput}"`
    };

    onAddTransaction(newTx);
    onClose();
  };

  const handleDoneUploadSlips = () => {
    // Add the 3 scanned slips to the state
    const slipTransactions: Transaction[] = [
      {
        id: `tx-slip-gourmet-${Date.now()}`,
        title: 'Gourmet Market',
        amount: -312,
        category: 'Food & Dining',
        date: '2026-09-25',
        time: '13:45 PM',
        verifiedFromSlip: true,
        paymentMethod: 'KBank Transfer',
        note: 'Scanned from K PLUS e-Slip',
        slip: {
          bankName: 'KBank',
          bankCode: 'KBANK',
          slipType: 'PromptPay Transfer',
          status: 'SUCCESS',
          amount: 312,
          senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
          recipientName: 'Gourmet Market Co., Ltd.',
          recipientPromptPay: '0105537024190',
          refNo: 'KB-20260925-339102',
          dateTimeStr: '25 Sep 2026 · 13:45'
        }
      },
      {
        id: `tx-slip-truemoney-${Date.now() + 1}`,
        title: '7-Eleven (TrueMoney)',
        amount: -145,
        category: 'Shopping',
        date: '2026-09-25',
        time: '12:30 PM',
        verifiedFromSlip: true,
        paymentMethod: 'TrueMoney Wallet',
        note: 'Scanned from TrueMoney e-Slip',
        slip: {
          bankName: 'TrueMoney',
          bankCode: 'SCB',
          slipType: 'Merchant Pay',
          status: 'SUCCESS',
          amount: 145,
          senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
          recipientName: 'CP All Public Co., Ltd.',
          recipientPromptPay: '0105531024881',
          refNo: 'TM-20260925-881902',
          dateTimeStr: '25 Sep 2026 · 12:30'
        }
      },
      {
        id: `tx-slip-krungthai-${Date.now() + 2}`,
        title: 'Cafe Amazon (KTB)',
        amount: -85,
        category: 'Food & Dining',
        date: '2026-09-25',
        time: '11:15 AM',
        verifiedFromSlip: true,
        paymentMethod: 'Krungthai NEXT',
        note: 'Scanned from Krungthai NEXT e-Slip',
        slip: {
          bankName: 'Krungthai',
          bankCode: 'KTB',
          slipType: 'PromptPay QR',
          status: 'SUCCESS',
          amount: 85,
          senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
          recipientName: 'Cafe Amazon Siam',
          recipientPromptPay: '0105541098124',
          refNo: 'KTB-20260925-774011',
          dateTimeStr: '25 Sep 2026 · 11:15'
        }
      }
    ];

    slipTransactions.forEach(tx => onAddTransaction(tx));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs animate-fadeIn">
      {/* Click outside backdrop to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

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
                onClick={() => setView('upload')}
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
                    Pick many at once from any bank app
                  </p>
                </div>
              </button>

              {/* Card 2: Say it */}
              <button
                type="button"
                onClick={() => setView('say')}
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
                    “ค่าแท็กซี่ 180”
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
                    {slip3Logged ? 'Cafe Amazon · ฿85' : 'Krungthai slip'}
                  </span>
                </div>
                {slip3Logged ? (
                  <span className="text-[14px] font-semibold text-[#008A3D] dark:text-[#06C755] flex items-center gap-0.5 animate-fadeIn">
                    Logged ✓
                  </span>
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
                className="w-full py-3.5 px-4 bg-[#6bb58f] hover:bg-[#008A3D] text-white text-[16px] font-semibold rounded-2xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-1.5"
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
                onChange={(e) => setTypeInput(e.target.value)}
                placeholder="e.g. กาแฟ 65 หรือ ค่าแท็กซี่ 180"
                className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border-2 border-[#008A3D] dark:border-[#06C755] rounded-2xl text-[16px] text-black dark:text-white focus:outline-hidden shadow-xs"
              />
            </div>

            {/* Quick Suggestion Pills */}
            <div className="flex flex-wrap gap-2 pt-0.5">
              {['กาแฟ 65', 'ข้าวมันไก่ 60', 'grab 145', 'ได้ค่าจ้าง 1500'].map((chip) => (
                <button
                  type="button"
                  key={chip}
                  onClick={() => setTypeInput(chip)}
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
