import React from 'react';
import { Calendar, MessageCircle, MessageSquare } from 'lucide-react';
import { formatCurrency, APP_CONFIG } from '../../config/appConfig';


export default function DueAlertsWidget({ dueAlerts = [], shopName = '' }) {
  const compileRecoveryTextMessage = (partyAmount) => {
    return `Invovo ERP Reminder: Dear Customer, your outstanding balance of ${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(partyAmount).toLocaleString()} is currently due. Please clear this balance at your earliest convenience. Shop: ${shopName}`;
  };

  const triggerFreeWhatsAppCommunication = (partyPhone, partyAmount) => {
    if (!partyPhone || partyPhone.trim() === '' || partyPhone.length < 10) {
      alert("🚨 Error: WhatsApp mobile number is not registered for this account!");
      return;
    }
    const cleanPhone = partyPhone.replace(/\D/g, '');
    const messageText = compileRecoveryTextMessage(partyAmount);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`, '_blank');
  };

  const triggerCarrierGsmTextSystem = (partyPhone, partyAmount) => {
    if (!partyPhone || partyPhone.trim() === '' || partyPhone.length < 10) {
      alert("🚨 Error: Mobile contact number is not registered for this customer!");
      return;
    }
    const cleanPhone = partyPhone.replace(/\D/g, '');
    const messageText = compileRecoveryTextMessage(partyAmount);
    window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(messageText)}`;
  };

  if (!dueAlerts || dueAlerts.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#121b36] border-l-4 border-l-amber-500 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50 pb-3">
        <h3 className="text-base font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <Calendar className="w-5 h-5 text-amber-500" /> Accounts Due Date Alerts ({dueAlerts.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-400 text-xs font-bold uppercase">
              <th className="py-2 px-4">Party Details</th>
              <th className="py-2 px-4">Account Type</th>
              <th className="py-2 px-4 font-mono">Due Date</th>
              <th className="py-2 px-4 text-right">Balance</th>
              <th className="py-2 px-4 text-right" style={{ width: '20%' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm font-bold">
            {dueAlerts.map((alertItem) => ( 
              <tr key={alertItem.id} className="hover:bg-amber-500/5 transition-colors">
                <td className="py-2.5 px-4 text-slate-900 dark:text-slate-100 font-black">
                  <div>{alertItem.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">📱 {alertItem.phone || 'N/A'}</div>
                </td> 
                <td className="py-2.5 px-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] border ${alertItem.type.includes('Customer') ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'bg-purple-500/10 text-purple-600 border-purple-500/20'}`}>{alertItem.type}</span>
                </td>
                <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                  {alertItem.dueDate} {alertItem.isOverdue && <span className="text-[10px] text-rose-500 font-sans font-black">(Overdue)</span>} 
                </td>
                <td className="py-2.5 px-4 text-right text-indigo-950 dark:text-indigo-300 font-mono font-black">{formatCurrency(alertItem.amount)}</td>
                <td className="py-2.5 px-4 text-right">
                  {alertItem.type.includes('Customer') ? (
                    alertItem.phone ? (
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => triggerFreeWhatsAppCommunication(alertItem.phone, alertItem.amount)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"><MessageCircle className="w-3 h-3" /> Remind</button>
                        <button type="button" onClick={() => triggerCarrierGsmTextSystem(alertItem.phone, alertItem.amount)} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"><MessageSquare className="w-3 h-3" /> SMS</button>
                      </div>
                    ) : <span className="text-[10px] text-slate-400 italic">No Contact</span>
                  ) : <span className="text-[10px] text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">Liability</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
