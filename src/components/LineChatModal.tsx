import React from 'react';
import { Transaction } from '../types/finance';
import { MascotAvatar } from './Mascot';

interface LineChatModalProps {
  transaction: Transaction;
  onClose: () => void;
}

export const LineChatModal: React.FC<LineChatModalProps> = ({ transaction, onClose }) => {
  const isIncome = transaction.amount > 0;
  const absAmount = Math.abs(transaction.amount);

  return (
    <div
      className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#788896] w-full max-w-sm rounded-[24px] overflow-hidden shadow-2xl flex flex-col h-[600px] border border-black/20">
        {/* LINE Chat Header */}
        <div className="bg-[#1E2327] text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button onClick={onClose} className="text-white hover:opacity-80">
              <span className="material-symbols-outlined text-[20px]">arrow_back_ios</span>
            </button>
            <MascotAvatar size={32} />
            <div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-[14px]">Thanbaht (ธัญบาท)</span>
                <span className="w-2 h-2 rounded-full bg-[#06C755]"></span>
              </div>
              <span className="text-[10px] text-neutral-400">Official Account · Bot Active</span>
            </div>
          </div>

          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 p-3 overflow-y-auto space-y-3 font-sans text-[13px]">
          {/* Timestamp chip */}
          <div className="text-center">
            <span className="bg-black/25 text-white text-[10px] px-2.5 py-0.5 rounded-full">
              23 กันยายน 2569
            </span>
          </div>

          {/* User message (sent slip) */}
          <div className="flex justify-end items-end gap-1.5">
            <span className="text-[10px] text-white/80 pb-0.5">12:42</span>
            <div className="bg-white rounded-2xl rounded-tr-xs p-3 shadow-md max-w-[240px] border border-emerald-100">
              <div className="flex items-center gap-2 pb-1.5 border-b border-neutral-100">
                <div className="w-6 h-6 rounded-full bg-[#00A950] text-white flex items-center justify-center font-bold text-[9px]">
                  KB
                </div>
                <span className="font-bold text-[12px] text-neutral-800">K PLUS · e-Slip</span>
              </div>
              <div className="py-2 text-[12px] space-y-0.5">
                <div className="text-neutral-500 text-[11px]">โอนสำเร็จ</div>
                <div className="font-bold text-[16px] text-neutral-900 font-sans tabular-nums">
                  ฿{absAmount.toFixed(2)}
                </div>
                <div className="text-neutral-700 text-[11px] truncate font-medium">
                  {transaction.title}
                </div>
              </div>
              <div className="text-[9px] text-neutral-400 pt-1 border-t border-dashed">
                {transaction.slip?.refNo || 'KB-20260923-882194'}
              </div>
            </div>
          </div>

          {/* Thanbaht Bot Response */}
          <div className="flex items-start gap-2">
            <div className="mt-0.5">
              <MascotAvatar size={28} />
            </div>

            <div className="space-y-1.5 max-w-[250px]">
              <div className="bg-white rounded-2xl rounded-tl-xs p-3 shadow-md space-y-1.5">
                <div className="flex items-center gap-1 text-[#06C755] font-bold text-[12px]">
                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                  <span>บันทึกรายการอัตโนมัติแล้ว!</span>
                </div>

                <div className="text-neutral-800 leading-snug">
                  <div><strong>จำนวน:</strong> ฿{absAmount.toLocaleString()}</div>
                  <div><strong>ร้านค้า:</strong> {transaction.title}</div>
                  <div><strong>หมวดหมู่:</strong> {transaction.category}</div>
                </div>

                <div className="pt-1.5 border-t border-neutral-100 text-[11px] text-neutral-500">
                  💡 ยอดใช้จ่ายเดือนนี้ของคุณอยู่ที่ ฿18,920 (ต่ำกว่างบ 4.2%)
                </div>
              </div>

              {/* Bot Quick Buttons */}
              <div className="space-y-1">
                <button
                  onClick={onClose}
                  className="w-full py-1.5 px-3 bg-white/90 hover:bg-white text-[#06C755] font-semibold text-[12px] rounded-xl shadow-xs text-center border border-black/5"
                >
                  เปิด Insights ใน Thanbaht →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* LINE Chat Input Mock */}
        <div className="bg-white px-3 py-2 flex items-center gap-2 border-t border-neutral-200 shrink-0">
          <button className="text-neutral-500 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[22px]">add</span>
          </button>
          <button className="text-neutral-500 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[22px]">photo_camera</span>
          </button>
          <button className="text-neutral-500 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[22px]">image</span>
          </button>
          <div className="flex-1 bg-[#F2F2F7] px-3 py-1.5 rounded-full text-[13px] text-neutral-400">
            ส่งสลิปหรือพิมพ์บันทึก...
          </div>
          <button className="text-[#06C755] font-semibold text-[14px]">
            <span className="material-symbols-outlined text-[22px]">mic</span>
          </button>
        </div>
      </div>
    </div>
  );
};
