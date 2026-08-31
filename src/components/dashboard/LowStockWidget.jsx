import React from 'react';
import { AlertTriangle, Flame } from 'lucide-react';

export default function LowStockWidget({ lowStockItems = [], fastMovingBenchmarkItem = null }) {
  if (!lowStockItems || lowStockItems.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#121b36] border-l-4 border-l-rose-500 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-700/50 pb-3 gap-2">
        <h3 className="text-base font-black uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
          <AlertTriangle className="w-5 h-5 text-rose-500" /> Low Stock Alerts / کم سٹاک الرٹ ({lowStockItems.length})
        </h3>
        {fastMovingBenchmarkItem && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl text-[10px] font-bold">
            <Flame className="w-3.5 h-3.5 text-amber-500 animate-bounce" /> Fast Mover: <span className="font-mono font-black uppercase text-slate-800 dark:text-slate-200">{fastMovingBenchmarkItem.substring(0, 18)}...</span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-400 text-xs font-bold uppercase">
              <th className="py-2 px-4">Item Name / آئٹم کا نام</th>
              <th className="py-2 px-4">SKU / کوڈ</th>
              <th className="py-2 px-4 text-right">Available Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm font-bold">
            {lowStockItems.map((item) => (
              <tr key={item.id} className="hover:bg-rose-500/5 transition-colors">
                <td className="py-2.5 px-4 text-slate-900 dark:text-slate-100 font-black">{item.name}</td>
                <td className="py-2.5 px-4 text-xs font-mono text-slate-500 dark:text-slate-400">{item.sku || 'N/A'}</td>
                <td className="py-2.5 px-4 text-right text-rose-600 dark:text-rose-400 font-black">
                  <span className="bg-rose-500/10 rounded-lg px-2 py-0.5 border border-rose-500/20 inline-block text-xs">{item.quantity} Units</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
