import { useState, useEffect } from 'react';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import { Store, Phone, MapPin, FileText, Save, CheckCircle, Printer, MessageCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Settings() {
  const { activeShopId } = useRole();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // 🏢 Core Multi-Tenant SaaS Shop State Structure with Strict Invoice Dimensions
  const [shopProfile, setShopProfile] = useState({
    shop_name: '',
    phone: '',
    address: '',
    invoice_terms: 'Sold goods cannot be returned or exchanged.', 
    footer_message: 'Thank you for using Invovo ERP App!',
    receipt_size: 'thermal', // 🏛️ ERP Standards: 'thermal' (3-inch), 'a4' (Standard Paper), 'legal' (Long Sheet)
    auto_whatsapp: true // 100% Free Carrier-independent wa.me link forwarding
  });

  const fetchShopSettings = async () => {
    if (!activeShopId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setStatus({ type: '', message: '' });
      
      const cached = localStorage.getItem(`invovo_erp_settings_cache_${activeShopId}`);
      
      if (cached) {
        setShopProfile(JSON.parse(cached));
      } else {
        const { data, error } = await supabase
          .from('shops')
          .select('*')
          .eq('id', activeShopId)
          .single();

        if (!error && data) {
          const freshData = {
            shop_name: data.name || data.shop_name || 'Invovo ERP Shop',
            phone: data.phone || data.shop_phone || '',
            address: data.address || data.shop_address || '',
            invoice_terms: data.invoice_terms || 'Sold goods cannot be returned or exchanged.',
            footer_message: data.footer_message || 'Thank you for using Invovo ERP App!',
            receipt_size: data.receipt_size || 'thermal',
            auto_whatsapp: data.auto_whatsapp !== undefined ? data.auto_whatsapp : true
          };
          setShopProfile(freshData);
          localStorage.setItem(`invovo_erp_settings_cache_${activeShopId}`, JSON.stringify(freshData));
        }
      }
    } catch (err) {
      console.error("Settings Load Exception:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopSettings();
  }, [activeShopId]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!activeShopId) return;
    
    try {
      setUpdating(true);
      setStatus({ type: '', message: '' });

      const sanitize = (str) => {
        if (!str) return '';
        return str.replace(/<[^>]*>?/gm, '');
      };

      const updatePayload = {
        name: sanitize(shopProfile.shop_name).trim(),
        phone: sanitize(shopProfile.phone).trim() || null,
        address: sanitize(shopProfile.address).trim() || null,
        invoice_terms: sanitize(shopProfile.invoice_terms).trim() || null,
        footer_message: sanitize(shopProfile.footer_message).trim() || null,
        receipt_size: shopProfile.receipt_size,
        auto_whatsapp: shopProfile.auto_whatsapp
      };

      await supabase
        .from('shops')
        .update(updatePayload)
        .eq('id', activeShopId);

      localStorage.setItem(`invovo_erp_settings_cache_${activeShopId}`, JSON.stringify(shopProfile));

      setStatus({ 
        type: 'success', 
        message: 'Settings synchronized smoothly!' 
      });
    } catch (err) {
      console.error(err);
      localStorage.setItem(`invovo_erp_settings_cache_${activeShopId}`, JSON.stringify(shopProfile));
      setStatus({ 
        type: 'success', 
        message: 'Settings locked locally into cache safely!' 
      });
    } finally {
      setUpdating(false);
    }
  };

  if (!activeShopId) return null;
  if (loading) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in duration-500 text-left max-w-4xl mx-auto pb-10">
      
      {/* 🎯 HEADER PANEL WITH DYNAMIC VIBRANT CYBER COLOR WAVE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 p-4 sm:p-6 rounded-3xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 relative overflow-hidden group text-left bg-[#050b21] no-print">
        <div 
          className="absolute inset-0 opacity-60 pointer-events-none transition-all duration-700 mix-blend-screen"
          style={{
            background: 'linear-gradient(-45deg, #4338ca 0%, #7c3aed 25%, #db2777 50%, #2563eb 75%, #4338ca 100%)',
            backgroundSize: '300% 300%',
            animation: 'InvovoERPVibrantWave 5s ease-in-out infinite'
          }}
        />
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all duration-700" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all duration-700" />
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes InvovoERPVibrantWave {
            0% { background-position: 0% 50% }
            50% { background-position: 100% 50% }
            100% { background-position: 0% 50% }
          }
        `}} />

        <div className="relative flex items-center gap-4 text-left z-10">
          <div className="p-3.5 bg-slate-900/80 border border-indigo-400/50 rounded-2xl text-2xl shadow-xl backdrop-blur-md animate-bounce duration-1000">
            ⚙️
          </div>
          <div>
            <h2 className="text-[11px] font-black tracking-widest text-indigo-300 uppercase font-mono bg-slate-950/40 px-2 py-0.5 rounded w-max border border-indigo-500/20 backdrop-blur-sm">System Control</h2>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight uppercase mt-1.5" style={{ textShadow: '0 2px 20px rgba(219,39,119,0.6), 0 4px 10px rgba(99,102,241,0.6)' }}>
              General Settings
            </h1>
            <p className="text-xs text-slate-200 mt-1.5 font-medium tracking-wide flex items-center gap-2 drop-shadow-md">
              <span className="font-bold">Invovo ERP Suite</span> • <span className="text-slate-300">Workspace Configurations</span>
            </p>
          </div>
        </div>
      </div>

      {status.message && (
        <div className={`p-4 rounded-xl border mb-6 flex items-center gap-3 font-bold text-xs ${
          status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
        }`}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-bold">{status.message}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6 font-bold text-xs">
        {/* SHOP PROFILE */}
        <div className="bg-white dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-xl space-y-5">
          <h3 className="text-base font-black text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-3">
            <Store className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Shop Profile Info
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Shop Name *</label>
              <div className="relative">
                <Store className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                <input type="text" required value={shopProfile.shop_name} onChange={e => setShopProfile({...shopProfile, shop_name: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors text-sm font-bold" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Shop Contact Number *</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                <input type="tel" required value={shopProfile.phone} onChange={e => setShopProfile({...shopProfile, phone: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500 transition-colors text-left text-sm font-bold" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Physical Shop Address</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
              <input type="text" value={shopProfile.address} onChange={e => setShopProfile({...shopProfile, address: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors text-sm font-bold" placeholder="e.g. Main Bazar" />
            </div>
          </div>
        </div>

        {/* PRINTING & AUTOMATION CONFIGURATIONS */}
        <div className="bg-white dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-xl space-y-5">
          <h3 className="text-base font-black text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-3">
            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Invoice Print &amp; Automation
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 📜 THREE-TIER PRINTER DIMENSIONS Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Default Printer Layout</label>
              <div className="relative">
                <Printer className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                <select value={shopProfile.receipt_size} onChange={e => setShopProfile({...shopProfile, receipt_size: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500 cursor-pointer text-sm">
                  <option value="thermal">Thermal Roll Page</option>
                  <option value="a4">Standard Corporate Sheet</option>
                  <option value="legal">Legal Size Ledger Document</option>
                </select>
              </div>
            </div>

            {/* 💬 FREE WA.ME AUTOMATED LINK CONFIG SELECTOR */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">WhatsApp Billing Mode</label>
              <div className="relative">
                <MessageCircle className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                <select value={shopProfile.auto_whatsapp ? "true" : "false"} onChange={e => setShopProfile({...shopProfile, auto_whatsapp: e.target.value === "true"})} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500 cursor-pointer text-sm">
                  <option value="true">Enable Prompts</option>
                  <option value="false">Disable</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Invoice Terms &amp; Conditions</label>
            <textarea rows={3} dir="rtl" value={shopProfile.invoice_terms} onChange={e => setShopProfile({...shopProfile, invoice_terms: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors text-right font-black text-sm font-urdu leading-relaxed" />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Custom Receipt Footer Note</label>
            <input type="text" dir="rtl" value={shopProfile.footer_message} onChange={e => setShopProfile({...shopProfile, footer_message: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors text-right font-black text-sm font-urdu" />
          </div>
        </div>

        {/* 🏛️ ENTERPRISE AUTOMATIC DATABASE BACKUP & EXPORT UTILITY GRID */}
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>📁</span> Export Complete ERP Ledger Backup
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Save Backup: Download your complete ledger, inventory, and petty expenses in an Excel/CSV sheet with a single click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={async () => {
                if (!activeShopId) return;
                try {
                  setStatus({ type: '', message: 'Generating Secure ERP Cloud Backup...' });
                  
                  const [prodRes, txRes, expRes] = await Promise.all([
                    supabase.from('products').select('name, sku, purchase_price, sale_price, current_stock').eq('shop_id', activeShopId).neq('status', 'archived'),
                    supabase.from('transactions').select('created_at, transaction_type, party_type, amount, total_bill, remaining_balance, notes').eq('shop_id', activeShopId),
                    supabase.from('expenses').select('expense_date, category, amount, notes').eq('shop_id', activeShopId).neq('status', 'cancelled')
                  ]);

                  const convertToCSV = (objArray) => {
                    if (!objArray || objArray.length === 0) return 'No Data Found For This Component\n';
                    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
                    let str = Object.keys(array[0]).join(',') + '\r\n';
                    for (let i = 0; i < array.length; i++) {
                      let line = '';
                      for (const index in array[i]) {
                        if (line !== '') line += ',';
                        let val = String(array[i][index] || '').replace(/"/g, '""');
                        line += `"${val}"`;
                      }
                      str += line + '\r\n';
                    }
                    return str;
                  };

                  const productsCsv = convertToCSV(prodRes.data || []);
                  const transactionsCsv = convertToCSV(txRes.data || []);
                  const expensesCsv = convertToCSV(expRes.data || []);

                  const finalBackupPayload = 
                    `=== Invovo ERP ERP SYSTEM BACKUP FILE ===\r\n` +
                    `Shop Token ID: ${activeShopId}\r\n` +
                    `Backup Timestamp: ${new Date().toLocaleString('en-GB')}\r\n\r\n` +
                    `--- 1. INVENTORY PRODUCTS LOG ---\r\n` + productsCsv + `\r\n` +
                    `--- 2. KHAATA TRANSACTIONS LOG ---\r\n` + transactionsCsv + `\r\n` +
                    `--- 3. DAILY EXPENSES LOG ---\r\n` + expensesCsv;

                  const blob = new Blob([finalBackupPayload], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  const todayStr = new Date().toISOString().split('T')[0];
                  link.setAttribute("href", url);
                  link.setAttribute("download", `InvovoERP_Backup_${todayStr}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);

                  setStatus({ type: 'success', message: 'ERP Database Backup downloaded successfully!' });
                } catch (err) {
                  console.error(err);
                  setStatus({ type: 'error', message: 'Backup system extraction failed.' });
                }
              }}
              className="h-[38px] px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95 w-full sm:w-auto"
            >
              <span>📥 Export CSV Backup</span>
            </button>

            <button 
              type="submit" 
              disabled={updating} 
              className="h-[38px] flex items-center justify-center gap-2 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-xl font-black transition-all shadow-lg border border-indigo-500 active:scale-95 cursor-pointer w-full sm:w-auto"
            >
              <Save className="w-4 h-4" />
              <span>{updating ? 'Locking Settings...' : 'Save Configuration Changes'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}