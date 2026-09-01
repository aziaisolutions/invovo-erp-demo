import { useState, useEffect, useMemo } from 'react';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import { ShieldAlert, BarChart3, TrendingUp, TrendingDown, Banknote, PieChart, Calendar, Download } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { formatCurrency, APP_CONFIG } from '../config/appConfig';

export default function Reports() {
  const { role, activeShopId } = useRole();
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // 🏛️ STANDARD ERP TIMELINE FILTERS: DEFAULT SET TO THIS_MONTH
  const [timeline, setTimeline] = useState('THIS_MONTH');
  
  // Custom Calendar Date Ranges State
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { minDate, maxDate } = useMemo(() => {
    const today = new Date();
    const max = today.toISOString().split('T')[0];
    
    const past = new Date();
    past.setDate(today.getDate() - 90);
    const min = past.toISOString().split('T')[0];
    
    return { minDate: min, maxDate: max };
  }, []);

  // Shop Name for Letterhead alignment
  const [shopName, setShopName] = useState('My Shop');

  
  const fetchFinancials = async () => {
    if (!activeShopId || role !== 'shop_owner') {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);

      // Fetch Shop Settings/Name first for proper print heading
      const settingsCached = localStorage.getItem(`invovo_erp_settings_cache_${activeShopId}`);
      if (settingsCached) {
        const parsedSettings = JSON.parse(settingsCached);
        if (parsedSettings?.shop_name) setShopName(parsedSettings.shop_name);
      } else {
        const { data: realShopRow } = await supabase.from('shops').select('name, shop_name').eq('id', targetShopId).maybeSingle();
        if (realShopRow) setShopName(realShopRow.name || realShopRow.shop_name || 'My Shop');
      }

      // 🔒 STRICТ STMT BARRIER: Reports ke data matrix ko active ledger ke sath zero variance sync krne k liye filter
      const [txRes, exRes, invRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('shop_id', targetShopId),
        supabase.from('expenses').select('*').eq('shop_id', targetShopId).neq('status', 'cancelled'),
        supabase.from('invoices').select('*').eq('shop_id', targetShopId).neq('status', 'cancelled').neq('status', 'hidden')
      ]);

      if (txRes.error) throw txRes.error;
      if (exRes.error) throw exRes.error;
      if (invRes.error) throw invRes.error;

      setTransactions(txRes.data || []);
      setExpenses(exRes.data || []);
      setInvoices(invRes.data || []);

    } catch (err) {
      console.error("Financial Data Fetch Notice:", err);
      setTransactions([]);
      setExpenses([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeShopId) {
      fetchFinancials();
    }
  }, [activeShopId, role]);

  const isWithinTimeline = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    d.setHours(0, 0, 0, 0);
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (timeline === 'THIS_MONTH') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } 
    else if (timeline === 'LAST_MONTH') {
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    } 
    else if (timeline === 'CUSTOM' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return d >= start && d <= end;
    }
    return true;
  };

  // Dynamic 10/10 ERP Synchronized Math Engine
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalPurchases = 0;
    let totalExpenses = 0;

    // Sum sales directly from filtered invoices table to secure data integrity
    invoices.forEach(inv => {
      if (isWithinTimeline(inv.created_at)) {
        totalSales += parseFloat(inv.grand_total || 0);
      }
    });

    transactions.forEach(tx => {
      if (isWithinTimeline(tx.created_at)) {
        const type = tx.transaction_type?.toLowerCase();
        const txAmt = Number(tx.total_bill || tx.amount || 0);
        if (type === 'purchase') {
          totalPurchases += txAmt;
        } else if (type === 'return' && tx.party_type === 'customer') {
          totalSales -= txAmt;
        }
      }
    });

    expenses.forEach(ex => {
      if (isWithinTimeline(ex.expense_date)) {
        totalExpenses += Number(ex.amount || 0);
      }
    });

    const grossProfit = totalSales; // Total dynamic sales revenue block
    const netProfit = totalSales - totalExpenses; // ERP Net Profit Standard

    return { totalSales, totalPurchases, totalExpenses, grossProfit, netProfit };
  }, [transactions, expenses, invoices, timeline, customStartDate, customEndDate]);

  const chartData = useMemo(() => {
    const dataMap = {};

    const processDate = (dateStr) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    invoices.forEach(inv => {
      if (isWithinTimeline(inv.created_at)) {
        const key = processDate(inv.created_at);
        if (!dataMap[key]) dataMap[key] = { name: key, sales: 0, expenses: 0 };
        dataMap[key].sales += parseFloat(inv.grand_total || 0);
      }
    });

    expenses.forEach(ex => {
      if (isWithinTimeline(ex.expense_date)) {
        const key = processDate(ex.expense_date);
        if (!dataMap[key]) dataMap[key] = { name: key, sales: 0, expenses: 0 };
        dataMap[key].expenses += Number(ex.amount || 0);
      }
    });

    return Object.values(dataMap).map(day => ({
      name: day.name,
      NetProfit: day.sales - day.expenses,
      Expenses: day.expenses
    })).sort((a,b) => new Date(a.name) - new Date(b.name));
  }, [invoices, expenses, timeline, customStartDate, customEndDate]);

  if (role !== 'shop_owner') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="bg-rose-500/10 p-6 rounded-full mb-6 border border-rose-500/20 shadow-2xl">
          <ShieldAlert className="w-16 h-16 text-rose-500" />
        </div>
        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Access Denied</h1>
        <h2 className="text-2xl font-bold text-rose-400 mb-6">Access Denied</h2>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in duration-500 text-left">
      
      {/* 🎯 HEADER PANEL WITH DYNAMIC VIBRANT CYBER WAVE EFFECT */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6 p-6 rounded-3xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 relative overflow-hidden group text-left bg-[#050b21] no-print">
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
            📊
          </div>
          <div>
            <h2 className="text-[11px] font-black tracking-widest text-indigo-300 uppercase font-mono bg-slate-950/40 px-2 py-0.5 rounded w-max border border-indigo-500/20 backdrop-blur-sm">Executive Intelligence</h2>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase mt-1.5" style={{ textShadow: '0 2px 20px rgba(219,39,119,0.6), 0 4px 10px rgba(99,102,241,0.6)' }}>
              Profit Reports
            </h1>
            <p className="text-xs text-slate-200 mt-1.5 font-medium tracking-wide flex items-center gap-2 drop-shadow-md">
              <span className="font-bold">Invovo ERP Suite</span> • <span className="text-slate-300">Performance Reports</span>
            </p>
          </div>
        </div>

        {/* CONTROLS ENGINE PANEL */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 z-10 w-full lg:w-auto justify-start lg:justify-end">
          {timeline === 'CUSTOM' && (
            <div className="flex items-center gap-2 bg-slate-900/90 p-2 border border-slate-700/80 rounded-xl font-bold font-mono text-white text-[11px] shadow-inner animate-in zoom-in-95 duration-200 max-w-full shrink-0">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 uppercase font-sans">Start</span>
                <input type="date" min={minDate} max={maxDate} value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="bg-transparent text-white outline-none focus:text-indigo-400 cursor-pointer w-28 sm:w-32" />
              </div>
              <div className="h-6 w-px bg-slate-700 mx-1" />
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 uppercase font-sans">End</span>
                <input type="date" min={minDate} max={maxDate} value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="bg-transparent text-white outline-none focus:text-indigo-400 cursor-pointer w-28 sm:w-32" />
              </div>
            </div>
          )}

          <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl shadow-lg border border-slate-300 dark:border-slate-700 font-bold shrink-0">
            <button type="button" onClick={() => setTimeline('THIS_MONTH')} className={`px-3 py-1.5 text-xs rounded-lg font-black transition-all cursor-pointer ${timeline === 'THIS_MONTH' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-white'}`}>This Month</button>
            <button type="button" onClick={() => setTimeline('LAST_MONTH')} className={`px-3 py-1.5 text-xs rounded-lg font-black transition-all cursor-pointer ${timeline === 'LAST_MONTH' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-white'}`}>Last Month</button>
            <button type="button" onClick={() => setTimeline('CUSTOM')} className={`px-3 py-1.5 text-xs rounded-lg font-black transition-all cursor-pointer flex items-center gap-1 ${timeline === 'CUSTOM' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-white'}`}><Calendar className="w-3.5 h-3.5" /> Custom</button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="h-[38px] px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0 w-full sm:w-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {/* 📄 100% UNIFORM INVOICE BLUEPRINT LETTERHEAD FOR HARDCOPY PRINT */}
      <div className="hidden print:block bg-white text-black p-2 font-sans w-full text-left">
        <div style={{ borderBottom: '3px solid #0f172a', paddingBottom: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start' }}>
            <div>
              <h1 style={{ fontSize: '24pt', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: 0 }}>{shopName || 'Invovo ERP Shop'}</h1>
              <p style={{ fontSize: '11pt', fontWeight: '700', color: '#4f46e5', margin: '4px 0 0 0' }}>Financial Audit Statement &amp; Profit Ledger</p>
            </div>
            <div style={{ textAlign: 'right', minWidth: '180px' }}>
              <div style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '6px 12px', fontSize: '12pt', fontWeight: '900', borderRadius: '4px', textTransform: 'uppercase', display: 'inline-block', marginBottom: '6px' }}>
                STATEMENT
              </div>
              <div style={{ fontSize: '9pt', fontWeight: 'bold', color: '#334155' }}>Date Issued: {new Date().toLocaleDateString('en-GB')}</div>
              <div style={{ fontSize: '9pt', color: '#475569', fontFamily: 'monospace' }}>Scope: {timeline === 'CUSTOM' ? `${customStartDate} To ${customEndDate}` : timeline}</div>
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '9.5pt', color: '#64748b', fontWeight: 'bold' }}>
            Authentication Status: <span style={{ color: '#16a34a' }}>Shop Owner Verified Financial Statement</span>
          </div>
        </div>

        {/* Uniform Financial metrics grid matching exact bill summary block */}
        <h2 style={{ fontSize: '13pt', fontWeight: '800', color: '#0f172a', borderLeft: '4px solid #4f46e5', paddingLeft: '8px', marginBottom: '12px', textTransform: 'uppercase' }}>Financial Metrics Summary</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', fontSize: '10pt' }}>
          <thead>
            <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
              <th style={{ padding: '8px', textLeft: 'left' }}>Metric Description</th>
              <th style={{ padding: '8px', textLeft: 'left' }}>Urdu Label</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Calculated Total</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Total Sales (Sale Bill Sum)</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Total Sales</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(metrics.totalSales)}</td></tr>
            <tr style={{ backgroundColor: '#f8fafc' }}><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Total Purchases (Investment)</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Total Purchases</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(metrics.totalPurchases)}</td></tr>
            <tr><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', color: '#b91c1c' }}>Operational Expenses (Shop Outflow)</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', color: '#b91c1c' }}>Shop Expenses</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold', color: '#b91c1c' }}>{formatCurrency(metrics.totalExpenses)}</td></tr>
            <tr style={{ backgroundColor: '#f8fafc' }}><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Gross Profit Margin</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Gross Profit</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(metrics.grossProfit)}</td></tr>
            <tr style={{ backgroundColor: metrics.netProfit >= 0 ? '#f0fdf4' : '#fef2f2', borderTop: '2px solid #0f172a' }}><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'black' }}>Net Profit / Loss Sheet Summary</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'black' }}>Net Profit</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'black', color: metrics.netProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(metrics.netProfit)}</td></tr>
          </tbody>
        </table>

        {/* Detailed Breakdown Node */}
        <h2 style={{ fontSize: '13pt', fontWeight: '800', color: '#0f172a', borderLeft: '4px solid #4f46e5', paddingLeft: '8px', marginBottom: '12px', textTransform: 'uppercase' }}>Daily Performance Breakdown</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
          <thead>
            <tr style={{ backgroundColor: '#475569', color: '#ffffff' }}>
              <th style={{ padding: '6px 8px', textLeft: 'left' }}>Date Node</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Calculated Net Profit</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Daily Expenses</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((day, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>{day.name}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold', color: day.NetProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(day.NetProfit)}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#b91c1c' }}>{formatCurrency(day.Expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FINANCIAL METRIC CARDS SCREEN VIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 font-bold print:hidden">
        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Sales / <span className="text-blue-600 dark:text-blue-400 font-black font-urdu">Total Sales</span>
          </h3>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-3 font-mono">{formatCurrency(metrics.totalSales)}</p>
        </div>
        
        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Purchases / <span className="text-orange-600 dark:text-orange-400 font-black font-urdu">Total Purchases</span>
          </h3>
          <p className="text-xl font-black text-orange-600 dark:text-orange-400 mt-3 font-mono">{formatCurrency(metrics.totalPurchases)}</p>
        </div>

        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Expenses / <span className="text-rose-600 dark:text-rose-400 font-black font-urdu">Shop Expenses</span>
          </h3>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-3 font-mono">{formatCurrency(metrics.totalExpenses)}</p>
        </div>

        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Gross Profit / <span className="text-emerald-600 dark:text-emerald-400 font-black font-urdu">Gross Profit</span>
          </h3>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-3 font-mono">{formatCurrency(metrics.grossProfit)}</p>
        </div>

        <div className={`border p-5 rounded-2xl shadow-sm relative ${metrics.netProfit < 0 ? 'bg-rose-950/40 border-rose-500/50 animate-pulse' : 'bg-white dark:bg-[#121b36] border-slate-200 dark:border-slate-800'}`}>
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Net Profit / <span className="text-emerald-500 font-black font-urdu">Net Profit</span>
          </h3>
          <p className={`text-xl font-black mt-3 font-mono ${metrics.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {formatCurrency(metrics.netProfit)}
          </p>
        </div>
      </div>

      {/* GRAPH CHANNELS AREA SCREEN VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 print:hidden">
        <div className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50 dark:from-[#111936] dark:to-[#0c1229] border border-slate-200 dark:border-indigo-950/40 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">📈 Net Profit vs Expenses</h3>
              <p className="text-xs font-bold text-indigo-500 font-urdu mt-0.5">Net Profit vs Expenses (Daily)</p>
            </div>
          </div>
          
          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 italic font-bold">No financial data points for this period.</div>
          ) : (
            <div className="h-60 sm:h-80 w-full text-xs font-bold">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={6} maxBarSize={40} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="barProfitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    </linearGradient>
                    <linearGradient id="barExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#475569" opacity={0.15} vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontWeight: '800', fontSize: '10px' }} tickLine={false} dy={8} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontWeight: '700', fontSize: '10px' }} tickLine={false} dx={-4}
                    tickFormatter={(val) => {
                      if (val === 0) return 'Rs.0';
                      const isNeg = val < 0;
                      const absVal = Math.abs(val);
                      if (absVal >= 1000000) return `${isNeg ? '-' : ''}Rs.${(absVal / 1000000).toFixed(1)}M`;
                      if (absVal >= 1000) return `${isNeg ? '-' : ''}Rs.${(absVal / 1000).toFixed(0)}K`;
                      return `${isNeg ? '-' : ''}Rs.${absVal}`;
                    }} 
                  />
                  <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }} contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', color: '#fff' }} formatter={(value) => [formatCurrency(value), undefined]} />
                   <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    iconSize={8} 
                    wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: '850' }}
                    formatter={(value) => <span className="text-slate-800 dark:text-slate-200 px-1 font-black">{value}</span>}
                  /> 
                  <Bar dataKey="NetProfit" fill="url(#barProfitGrad)" name="Net Profit (Net Profit)" radius={chartData.some(d => d.NetProfit < 0) ? [4, 4, 4, 4] : [8, 8, 0, 0]} />
                  <Bar dataKey="Expenses" fill="url(#barExpenseGrad)" name="Expenses (Shop Expenses)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <ReportsPdfExporter timeline={timeline} activeShopId={activeShopId} customStart={customStartDate} customEnd={customEndDate} />
            </div>
          )}
        </div>

        {/* Expense Pie Chart SCREEN VIEW */}
        <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-left print:hidden">
          <h3 className="text-base font-black text-slate-900 dark:text-white mb-4">Expense Breakdown</h3>
          {(() => {
            const pieDataMap = {};
            expenses.forEach(ex => {
              if (isWithinTimeline(ex.expense_date)) {
                const cat = ex.category || 'General';
                pieDataMap[cat] = (pieDataMap[cat] || 0) + Number(ex.amount || 0);
              }
            });
            const pieData = Object.keys(pieDataMap).map(key => ({ name: key, value: pieDataMap[key] }));
            const COLORS = ['#818cf8', '#fb7185', '#fbbf24', '#22d3ee', '#a78bfa'];
            
            if (pieData.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400 italic text-xs">No expenses logged.</div>;
            return (
              <div className="h-56 w-full text-xs font-bold relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [`${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ${Number(value).toLocaleString()}`, 'Amount']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2 justify-center max-h-16 overflow-y-auto">
                  {pieData.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span>{entry.name}: <span className="font-mono font-black">{formatCurrency(entry.value)}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* STYLING OVERRIDE FOR PRINTING ONLY */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body, html, #root { background: white !important; color: black !important; }
          aside, header, nav, button, select, .no-print, .print\\:hidden { display: none !important; visibility: hidden !important; }
          main, .flex-1, div, section { margin: 0 !important; padding: 0 !important; box-shadow: none !important; width: 100% !important; max-width: 100% !important; background: transparent !important; color: black !important; }
        }
      `}} />
    </div>
  );
}

// Sub-Component Exporter Panel Block
export function ReportsPdfExporter({ timeline = 'THIS_MONTH', activeShopId = '', customStart = '', customEnd = '' }) {
  return (
    <div className="hidden print:block text-center text-[11px] text-slate-400 font-mono mt-12 border-t border-slate-300 pt-3 font-bold w-full">
      Invovo ERP Suite Verification Code: SH-STMT-{activeShopId || 'OWNER'}-{timeline === 'CUSTOM' ? `${customStart}_to_${customEnd}` : timeline} <br/>
      Financial Analytics Provided by Invovo ERP ERP Engine • Technology Partner: Invovo (+92 305 9352744)
    </div>
  );
}
