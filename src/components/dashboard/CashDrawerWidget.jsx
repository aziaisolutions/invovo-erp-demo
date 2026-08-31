import React from 'react';
import { formatCurrency, APP_CONFIG } from '../../config/appConfig';


export default function CashDrawerWidget({ cashIn = 0, cashOut = 0 }) {
  const safeCashIn = Number(cashIn) || 0;
  const safeCashOut = Number(cashOut) || 0;
  const cashInHand = safeCashIn - safeCashOut;

  return (
    <div className="bg-[#0f172a] dark:bg-[#111936] border border-slate-700 dark:border-indigo-950/60 rounded-3xl p-6 shadow-xl text-left relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700 pb-4 mb-5 gap-3">
        <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2.5">
          <span className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">💵</span>
          <span className="text-white">Live Cash Drawer / <span className="text-indigo-400 font-extrabold font-urdu">گلے کا نقد (کل رقم)</span></span>
        </h3>
        <div className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-md font-mono tracking-wider w-max">
          🟢 Counter Active
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-bold text-xs">
        <div className="bg-slate-900/90 dark:bg-slate-950/40 border border-slate-700 dark:border-slate-800 p-5 rounded-2xl shadow-md">
          <p className="text-slate-400 uppercase font-black tracking-wider flex items-center gap-1.5">
            <span className="text-emerald-400">📥</span> Total Cash In / نقد رقم آئی
          </p>
          <p className="text-xl font-black text-emerald-400 font-mono mt-3 tracking-wide">{formatCurrency(safeCashIn)}</p>
        </div>

        <div className="bg-slate-900/90 dark:bg-slate-950/40 border border-slate-700 dark:border-slate-800 p-5 rounded-2xl shadow-md">
          <p className="text-slate-400 uppercase font-black tracking-wider flex items-center gap-1.5">
            <span className="text-rose-400">📤</span> Total Cash Out / نقد ادا کیا
          </p>
          <p className="text-xl font-black text-rose-400 font-mono mt-3 tracking-wide">-{formatCurrency(safeCashOut)}</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border-2 border-indigo-500/40 p-5 rounded-2xl shadow-lg">
          <p className="text-indigo-300 uppercase font-black tracking-wider flex items-center gap-1.5">
            <span>💼</span> Cash In Hand / گلے میں موجود رقم
          </p>
          <p className="text-2xl font-black text-indigo-400 font-mono mt-2 tracking-tight">
            {formatCurrency(cashInHand)}
          </p>
        </div>
      </div>
    </div>
  );
}
