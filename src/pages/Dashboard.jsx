import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import { Download } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import CashDrawerWidget from '../components/dashboard/CashDrawerWidget';
import LowStockWidget from '../components/dashboard/LowStockWidget';
import DueAlertsWidget from '../components/dashboard/DueAlertsWidget';
import WidgetErrorBoundary from '../components/WidgetErrorBoundary';
import { formatCurrency, APP_CONFIG } from '../config/appConfig';

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeShopId, activeShop } = useRole();

// 🛡️ CRITICAL REDIRECTION SAFETY GUARD: Smoothly handles fresh users and wipes out layout crashes
  useEffect(() => {
    if (!activeShopId) {
      navigate('/onboarding', { replace: true });
    }
  }, [activeShopId, navigate]);

  // 🏛️ DEFAULT TIMELINE SET TO TODAY FOR LIVE LIVE GAALHA TRACKING
  const [timeFilter, setTimeFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [error, setError] = useState(null);
  const [dismissedLowStockAlert, setDismissedLowStockAlert] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  
  const [shopName, setShopName] = useState('My Shop');
  const [subInfo, setSubInfo] = useState({ plan: 'trial', expiry: '' });
  const [directExpenses, setDirectExpenses] = useState(0); // 🔒 FIXED: State declared safely for all scopes
  
  useEffect(() => {
    const getSubDetails = async () => {
      if (!activeShopId) return;
      const { data } = await supabase.from('shops').select('plan_type, expires_at').eq('id', activeShopId).single();
      if (data) {
        const date = new Date(data.expires_at);
        setSubInfo({ plan: data.plan_type || 'trial', expiry: date.toLocaleDateString('en-GB') });
      }
    };
    getSubDetails();
  }, [activeShopId]);

  // 📱 PWA PREMIUM ENTERPRISE INSTALLATION ENGINE WITH AUTOMATIC RE-APPEARANCE GUARANTEE
  const pwaPromptEventRef = useRef(null);
  const [isAppInstallable, setIsAppInstallable] = useState(false);

  useEffect(() => {
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isInstalled) {
      setIsAppInstallable(false);
      return;
    }

    const captureInstallPrompt = (e) => {
      e.preventDefault();
      pwaPromptEventRef.current = e;
      setIsAppInstallable(true);
    };

    const handleAppInstalled = () => {
      pwaPromptEventRef.current = null;
      setIsAppInstallable(false);
      localStorage.setItem('pwa_installed_status', 'true');
    };

    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const checkShortcutDeletion = () => {
      if (!isInstalled && !pwaPromptEventRef.current) {
        localStorage.removeItem('pwa_installed_status');
      }
    };
    checkShortcutDeletion();

    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerSmartAppInstallation = async () => {
    if (!pwaPromptEventRef.current) return;
    pwaPromptEventRef.current.prompt();
    const { outcome } = await pwaPromptEventRef.current.userChoice;
    if (outcome === 'accepted') {
      setIsAppInstallable(false);
      pwaPromptEventRef.current = null;
    }
  };

  const isCriticalExpiryZone = useMemo(() => {
    if (!subInfo.expiry) return false;
    let expiryDate;
    if (subInfo.expiry.includes('/')) {
      const [day, month, year] = subInfo.expiry.split('/');
      expiryDate = new Date(`${year}-${month}-${day}T23:59:59`);
    } else {
      expiryDate = new Date(subInfo.expiry);
    }
    if (isNaN(expiryDate.getTime())) return false;
    const diffTime = expiryDate - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 3 && diffDays >= 0;
  }, [subInfo.expiry]);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: 'Tea/Refreshment', customCategory: '', amount: '', notes: '' });

  const [metrics, setMetrics] = useState({
    revenue: 0,
    profit: 0,
    itemsSold: 0,
    lowStockCount: 0,
    cashIn: 0,
    cashOut: 0,
    totalPayables: 0,   
    totalReceivables: 0, 
    rawLogs: []
  });

  const [dueAlerts, setDueAlerts] = useState([]);

  
  const getStartOfTodayISO = () => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString();
  };

  const getDateThreshold = (filter) => {
    const date = new Date();
    if (filter === 'today') date.setHours(0, 0, 0, 0);
    else if (filter === '7days') date.setDate(date.getDate() - 7);
    else if (filter === '30days') date.setDate(date.getDate() - 30);
    return date.toISOString();
  };

  const fetchDashboardData = async () => {
    if (!activeShopId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let freshName = 'My Shop';
      let realShopRow = null;
      const settingsCached = localStorage.getItem(`invovo_erp_settings_cache_${activeShopId}`);
      if (settingsCached) {
        const parsedSettings = JSON.parse(settingsCached);
        if (parsedSettings?.shop_name) freshName = parsedSettings.shop_name;
        realShopRow = parsedSettings;
      } else {
        const { data: fetchedShop } = await supabase.from('shops').select('*').eq('id', activeShopId) .maybeSingle();
        if (fetchedShop) {
          freshName = fetchedShop.name || fetchedShop.shop_name || 'My Shop';
          realShopRow = fetchedShop;
        }
      }
      setShopName(freshName);

      if (freshName === 'My Shop' || (!realShopRow?.phone && !realShopRow?.whatsapp_number) || !realShopRow?.address) {
        setIsProfileIncomplete(true);
      } else {
        setIsProfileIncomplete(false);
      }
      
      const dateThreshold = getDateThreshold(timeFilter);
      let expensesQuery = supabase.from('expenses').select('*').eq('shop_id', activeShopId).neq('status', 'cancelled');
      if (dateThreshold) expensesQuery = expensesQuery.gte('expense_date', dateThreshold.split('T')[0]);
      
      // Fetch dynamic active invoices to sync total sales perfectly
      let invoicesQuery = supabase.from('invoices').select('*').eq('shop_id', activeShopId).neq('status', 'cancelled').neq('status', 'hidden');
      if (timeFilter === 'today') invoicesQuery = invoicesQuery.gte('created_at', getStartOfTodayISO());
      else invoicesQuery = invoicesQuery.gte('created_at', dateThreshold);

      // 🔒 SYNCHRONIZATION BARRIER: Dashboard analytics to keep Dashboard analytics accurate only active accounts fetch check
      const [
        productsRes,
        txLogsRes,
        expensesRes,
        rpcRes,
        suppliersRes,
        customersRes,
        rawAllTxRes,
        invoicesRes
      ] = await Promise.all([
        supabase.from('products').select('*').eq('shop_id', activeShopId).neq('status', 'archived'),
        supabase.from('transactions').select('*').eq('shop_id', activeShopId).order('id', { ascending: false }).limit(10),
        expensesQuery,
        supabase.rpc('get_shop_financial_summary', { p_shop_id: activeShopId, p_start_date: dateThreshold }),
        supabase.from('suppliers').select('*').eq('shop_id', activeShopId).neq('status', 'archived').neq('khata_status', 'closed'),
        supabase.from('customers').select('*').eq('shop_id', activeShopId).neq('status', 'archived').neq('khata_status', 'closed'),
        supabase.from('transactions').select('*').eq('shop_id', activeShopId),
        invoicesQuery
      ]);

      if (productsRes.error) throw productsRes.error;
      if (txLogsRes.error) throw txLogsRes.error;
      if (rpcRes.error) throw rpcRes.error;

      const lowStockList = (productsRes.data || []).filter(p => p.current_stock <= p.low_stock_threshold);
      setLowStockItems(lowStockList.map(p => ({ ...p, quantity: p.current_stock })));

      const rawLiveTxLogs = txLogsRes.data || [];
      const directExpensesData = expensesRes.data || [];
      const totalDirectExpenses = directExpensesData.reduce((acc, exp) => acc + parseFloat(exp.amount || 0), 0);
      setDirectExpenses(totalDirectExpenses); // ⚡ Locked in state correctly
      
      const formattedExpenseLogs = directExpensesData.map(exp => ({
        id: `exp-${exp.id}`,
        transaction_type: 'payment_out',
        notes: `${exp.category}`,
        cash_paid_received: exp.amount,
        created_at: exp.expense_date ? `${exp.expense_date}T12:00:00Z` : new Date().toISOString()
      }));

      const combinedLogs = [...rawLiveTxLogs, ...formattedExpenseLogs]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);

      const rpcSummary = rpcRes.data;
      
      // Calculate dynamic accurate total sales from invoices table directly to eliminate RPC lag
      const dynamicInvoiceRevenue = (invoicesRes.data || []).reduce((acc, inv) => acc + parseFloat(inv.grand_total || 0), 0);
      const computedPayables = (suppliersRes.data || []).reduce((acc, s) => {
        const supTx = (rawAllTxRes.data || []).filter(t => String(t.party_id) === String(s.id) && String(t.party_type).toLowerCase() === 'supplier');
        const bal = supTx.reduce((innerAcc, tx) => {
          const tType = String(tx.transaction_type).toLowerCase();
          if (tType === 'purchase') return innerAcc + parseFloat(tx.total_bill || tx.amount || 0) - parseFloat(tx.cash_paid_received || 0);
          else if (tType === 'payment_out' || tType === 'payment') return innerAcc - parseFloat(tx.cash_paid_received || tx.amount || 0);
          else if (tType === 'return') return innerAcc - parseFloat(tx.amount || 0);
          return innerAcc;
        }, 0);
        return acc + Math.max(0, bal);
      }, 0);

      let computedReceivables = 0;
      if (!customersRes.error && customersRes.data) {
        computedReceivables = customersRes.data.reduce((acc, c) => {
          const custTx = (rawAllTxRes.data || []).filter(t => String(t.party_id) === String(c.id) && String(t.party_type).toLowerCase() === 'customer');
          const bal = custTx.reduce((innerAcc, tx) => {
            const tType = String(tx.transaction_type).toLowerCase();
            const amt = parseFloat(tx.total_bill || tx.amount || 0);
            const rec = parseFloat(tx.cash_paid_received || 0);
            const finalPaid = tType === 'sale' ? rec : parseFloat(tx.amount || tx.cash_paid_received || 0);
            if (tType === 'sale') return innerAcc + amt - finalPaid;
            else return innerAcc - finalPaid;
          }, 0);
          return acc + Math.max(0, bal);
        }, 0);
      }

      // Calculate Cash In dynamically from valid invoices and transactions
      const totalCashInCalculated = (rawAllTxRes.data || []).reduce((acc, tx) => {
        const filterDate = new Date(dateThreshold);
        const txDate = new Date(tx.created_at);
        if (txDate < filterDate) return acc;
        
        const tType = String(tx.transaction_type).toLowerCase();
        if (tType === 'sale') return acc + parseFloat(tx.cash_paid_received || 0);
        if (tType === 'payment_received' || tType === 'received') return acc + parseFloat(tx.cash_paid_received || tx.amount || 0);
        return acc;
      }, 0);

      // Calculate Cash Out dynamically from valid expenses and supplier payouts
      const totalCashOutCalculated = (rawAllTxRes.data || []).reduce((acc, tx) => {
        const filterDate = new Date(dateThreshold);
        const txDate = new Date(tx.created_at);
        if (txDate < filterDate) return acc;

        const tType = String(tx.transaction_type).toLowerCase();
        if (tType === 'payment_out' || tType === 'payment') return acc + parseFloat(tx.cash_paid_received || tx.amount || 0);
        return acc;
      }, 0) + totalDirectExpenses;

      setMetrics({
        revenue: dynamicInvoiceRevenue > 0 ? dynamicInvoiceRevenue : parseFloat(rpcSummary?.revenue || 0),
        profit: parseFloat(rpcSummary?.profit || 0),
        itemsSold: parseInt(rpcSummary?.items_sold || 0),
        lowStockCount: lowStockList.length,
        cashIn: totalCashInCalculated,
        cashOut: totalCashOutCalculated,
        totalPayables: computedPayables,
        totalReceivables: computedReceivables,
        rawLogs: combinedLogs
      });
      setLowStockProducts(lowStockList);

      const alertTimeLimit = new Date(); 
      alertTimeLimit.setDate(alertTimeLimit.getDate() + 1); 
      alertTimeLimit.setHours(23, 59, 59, 999); 
      
      const allTransactions = rawAllTxRes.data || [];
      const computedAlerts = [];

      (customersRes.data || []).forEach(cust => { 
        const custTx = allTransactions.filter(t => String(t.party_id) === String(cust.id) && String(t.party_type).toLowerCase() === 'customer'); 
        const currentOwed = custTx.reduce((acc, tx) => {
          const tType = String(tx.transaction_type).toLowerCase();
          const amt = parseFloat(tx.total_bill || tx.amount || 0);
          const rec = parseFloat(tx.cash_paid_received || 0);
          const finalPaid = tType === 'sale' ? rec : parseFloat(tx.amount || tx.cash_paid_received || 0);
          if (tType === 'sale') return acc + amt - finalPaid;
          else return acc - finalPaid;
        }, 0);

        if (currentOwed > 0) { 
          const latestTxWithDue = [...custTx].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).find(t => t.due_date); 
          if (latestTxWithDue && latestTxWithDue.due_date) { 
            const txDueDate = new Date(latestTxWithDue.due_date); 
            txDueDate.setHours(0, 0, 0, 0); 
            if (txDueDate <= alertTimeLimit) { 
              computedAlerts.push({ 
                id: `cust-alert-${cust.id}`, 
                name: cust.full_name || cust.name, 
                phone: cust.phone || '',
                type: 'Customer (گاہک)', 
                amount: currentOwed, 
                dueDate: latestTxWithDue.due_date.split('-').reverse().join('/'), 
                isOverdue: txDueDate < new Date().setHours(0,0,0,0) 
              }); 
            } 
          } 
        } 
      }); 

      (suppliersRes.data || []).forEach(supp => { 
        const suppTx = allTransactions.filter(t => String(t.party_id) === String(supp.id) && String(t.party_type).toLowerCase() === 'supplier'); 
        const currentDebt = suppTx.reduce((acc, tx) => {
          const tType = String(tx.transaction_type).toLowerCase();
          if (tType === 'purchase') return acc + parseFloat(tx.total_bill || tx.amount || 0) - parseFloat(tx.cash_paid_received || 0);
          else if (tType === 'payment_out' || tType === 'payment') return acc - parseFloat(tx.cash_paid_received || tx.amount || 0);
          return acc;
        }, 0);

        if (currentDebt > 0) { 
          const latestTxWithDue = [...suppTx].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).find(t => t.due_date); 
          if (latestTxWithDue && latestTxWithDue.due_date) { 
            const txDueDate = new Date(latestTxWithDue.due_date); 
            txDueDate.setHours(0, 0, 0, 0); 
            if (txDueDate <= alertTimeLimit) { 
              computedAlerts.push({ 
                id: `supp-alert-${supp.id}`, 
                name: supp.full_name || supp.name || supp.supplier_name || supp.company_name || 'Unknown Supplier', 
                phone: supp.phone || '',
                type: 'Supplier (بیوپاری)', 
                amount: currentDebt, 
                dueDate: latestTxWithDue.due_date.split('-').reverse().join('/'), 
                isOverdue: txDueDate < new Date().setHours(0,0,0,0) 
              }); 
            } 
          } 
        } 
      }); 

      setDueAlerts(computedAlerts); 

    } catch (err) {
      console.error('Dashboard Engine Sync Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeShopId, timeFilter]);

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(expenseForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid expense amount!');
      return;
    }
    try {
      setLoading(true);
      const { error: expError } = await supabase
        .from('expenses')
        .insert([{
          shop_id: activeShopId,
          category: expenseForm.category === 'Other' ? (expenseForm.customCategory || 'Other Expense') : expenseForm.category,
          amount: parsedAmount,
          expense_date: new Date().toISOString().split('T')[0]
        }]);

      if (expError) throw expError;
      setShowExpenseModal(false);
      setExpenseForm({ category: 'Tea/Refreshment', customCategory: '', amount: '', notes: '' });
      alert('Kharcha safely recorded / چھوٹا خرچہ درج ہو گیا ہے!');
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert("🚨 DB Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };


  const fastMovingBenchmarkItem = useMemo(() => {
    if (!metrics.rawLogs || metrics.rawLogs.length === 0) return null;
    const saleLogs = metrics.rawLogs.filter(l => l && String(l.transaction_type).toLowerCase() === 'sale');
    if (saleLogs.length > 0) return saleLogs[0].notes || 'Regular Retail Cargo';
    return null;
  }, [metrics.rawLogs]);

  // ERP standard profit formula adjustment to prevent liability variance lag
  const calculatedNetProfit = metrics.revenue - directExpenses;
  const isProfitAlarmActive = calculatedNetProfit <= 0;

  if (!activeShopId) {
    return (
      <div className="p-8 text-center text-slate-900 dark:text-white">
        <h2 className="text-2xl font-bold mb-4">Welcome to Invovo ERP</h2>
        <p className="text-slate-500 dark:text-slate-400">Please select a shop to view the ERP ledger suite.</p>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="animate-in fade-in duration-500 text-left space-y-6">
        
        {/* 🏛️ 100% UNIFORM INVOICE SIGNATURE LETTERHEAD VIEW FOR PRINT HARDCOPY */}
        <div className="hidden print:block bg-white text-black p-2 font-sans w-full text-left">
          <div style={{ borderBottom: '3px solid #0f172a', paddingBottom: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start' }}>
              <div>
                <h1 style={{ fontSize: '24pt', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: 0 }}>{shopName || 'Invovo ERP Shop'}</h1>
                <p style={{ fontSize: '11pt', fontWeight: '700', color: '#4f46e5', margin: '4px 0 0 0' }}>Executive Account Closing Summary</p>
              </div>
              <div style={{ textAlign: 'right', minWidth: '180px' }}>
                <div style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '6px 12px', fontSize: '12pt', fontWeight: '900', borderRadius: '4px', textTransform: 'uppercase', display: 'inline-block', marginBottom: '6px' }}>
                  STATEMENT
                </div>
                <div style={{ fontSize: '9pt', fontWeight: 'bold', color: '#334155' }}>Date Issued: {new Date().toLocaleDateString('en-GB')}</div>
                <div style={{ fontSize: '9pt', color: '#475569', fontFamily: 'monospace' }}>Scope: {timeFilter.toUpperCase()}</div>
              </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '9.5pt', color: '#64748b', fontWeight: 'bold' }}>
              Authentication Status: <span style={{ color: '#16a34a' }}>Shop Owner Verified Account Closing</span>
            </div>
          </div>

          {/* Core Table Layout matching exact PDF uniform look */}
          <h2 style={{ fontSize: '13pt', fontWeight: '800', color: '#0f172a', borderLeft: '4px solid #4f46e5', paddingLeft: '8px', marginBottom: '12px', textTransform: 'uppercase' }}>Financial Metrics Balance Sheet</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', fontSize: '10pt' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                <th style={{ padding: '8px', textLeft: 'left' }}>Financial Parameter Component</th>
                <th style={{ padding: '8px', textLeft: 'left' }}>Urdu Label</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Calculated Value ({APP_CONFIG.defaultCurrency})</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Gross Revenue / Total Sales</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>کل فروخت</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(metrics.revenue)}</td></tr>
              <tr style={{ backgroundColor: '#f8fafc' }}><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Product Gross Performance Profit</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>کچا منافع</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(metrics.profit)}</td></tr>
              <tr><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', color: '#b91c1c' }}>Total Operational Expenses (Chota Kharcha)</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', color: '#b91c1c' }}>منفی اخراجات</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold', color: '#b91c1c' }}>-{formatCurrency(directExpenses)}</td></tr>
              <tr style={{ backgroundColor: calculatedNetProfit >= 0 ? '#f0fdf4' : '#fef2f2', borderTop: '2px solid #0f172a' }}><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'black' }}>True Net Business Profit</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'black' }}>اصلی منافع</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'black', color: calculatedNetProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(calculatedNetProfit)}</td></tr>
            </tbody>
          </table>

          {/* Credit & Liabilities Table Section */}
          <h2 style={{ fontSize: '13pt', fontWeight: '800', color: '#0f172a', borderLeft: '4px solid #4f46e5', paddingLeft: '8px', marginBottom: '12px', textTransform: 'uppercase' }}>Outstanding Credit &amp; Debt Liability Status</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', fontSize: '10pt' }}>
            <thead>
              <tr style={{ backgroundColor: '#475569', color: '#ffffff' }}>
                <th style={{ padding: '8px', textLeft: 'left' }}>Outstanding Account Category</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Outstanding Sum Balance ({APP_CONFIG.defaultCurrency})</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', color: '#2563eb', fontWeight: 'bold' }}>Total Receivables (Gahak Market Credit Outflow)</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#2563eb', fontWeight: 'black' }}>{formatCurrency(metrics.totalReceivables)}</td></tr>
              <tr style={{ backgroundColor: '#f8fafc' }}><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', color: '#dc2626', fontWeight: 'bold' }}>Total Payables (Beopari Wholesale Debt Liability)</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#dc2626', fontWeight: 'black' }}>{formatCurrency(metrics.totalPayables)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-6 print:hidden">
          {/* 🎯 HEADER PANEL WITH DYNAMIC CYBER VIBRANT COLOR WAVE LIGHT ENGINE */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6 p-6 rounded-3xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 relative overflow-hidden group text-left bg-[#050b21]">
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
                🏢
              </div>
              <div>
                <h2 className="text-[11px] font-black tracking-widest text-indigo-300 uppercase font-mono bg-slate-950/40 px-2 py-0.5 rounded w-max border border-indigo-500/20 backdrop-blur-sm">Verified Workspace</h2>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase mt-1.5" style={{ textShadow: '0 2px 20px rgba(219,39,119,0.6), 0 4px 10px rgba(99,102,241,0.6)' }}>
                  {shopName || 'My Shop'}
                </h1>
                
                {/* 📥 100% GUARANTEED SMART PWA INSTALL BUTTON */}
                {isAppInstallable && (
                  <button
                    type="button"
                    onClick={triggerSmartAppInstallation}
                    className="mt-3 block w-full sm:w-max h-[36px] px-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-xs font-black shadow-lg cursor-pointer animate-pulse border border-emerald-400/30"
                  >
                    <span>📥 Install Invovo ERP Mobile App</span>
                  </button>
                )}
                                                              
                <div className="text-xs text-slate-200 mt-1.5 font-medium tracking-wide flex items-center gap-2 drop-shadow-md">
                  <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] border font-black uppercase transition-all select-none ${
                    isCriticalExpiryZone ? 'bg-rose-950/80 border-rose-500/60 text-rose-400 animate-pulse border-2 shadow-lg shadow-rose-500/20' : 'bg-slate-950/60 border-indigo-500/30 text-slate-200'
                  }`}>
                    <span>🛡️ Status:</span>
                    <span className={isCriticalExpiryZone ? "text-rose-400 font-black animate-pulse" : (subInfo.plan === 'trial' ? "text-amber-400 font-black" : "text-emerald-400 font-black")}>
                      {subInfo.plan === 'trial' ? 'Free Trial' : 'Premium Plan'} ({subInfo.expiry || 'Active'})
                    </span>
                  </div>
                  <span>•</span>
                  <span className="text-slate-300">Active View:</span> 
                  <span className="text-indigo-200 font-black uppercase bg-slate-950/60 px-2 py-0.5 rounded-md text-[10px] border border-indigo-500/40 font-mono">{timeFilter}</span>
                </div>
              </div>
            </div>

            {/* HEADER ACTION CONTROLLERS */}
            <div className="flex items-center gap-2 flex-wrap z-10 self-start lg:self-center shrink-0">
              <button type="button" onClick={() => setShowExpenseModal(true)} className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl text-xs font-black shadow-md cursor-pointer border border-rose-500/40">💸 + Kharcha / خرچہ درج کریں</button>
              
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-black focus:outline-none cursor-pointer shadow-md"
              >
                <option value="today">Today / آج کا حساب</option>
                <option value="7days">Last 7 Days / اس ہفتے کا کھاتا</option>
                <option value="30days">Last 30 Days / اس مہینے کا خلاصہ</option>
              </select>

              <button type="button" onClick={() => window.print()} className="h-[36px] flex items-center gap-1.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-black text-xs shadow-md cursor-pointer transition-colors shrink-0 w-full sm:w-auto">
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
              </button>
              {isAppInstallable && (
                <button
                  type="button"
                  onClick={triggerSmartAppInstallation}
                  className="h-[36px] flex items-center gap-1.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-black text-xs shadow-md cursor-pointer animate-bounce transition-all transform active:scale-95 duration-150 shrink-0 border border-emerald-400/30"
                >
                  <span>📥 Install App</span>
                </button>
              )}
            </div>
          </div>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-xs">{error}</div>}

          {/* LOW STOCK MONITORING PANEL */}
          <WidgetErrorBoundary>
            <LowStockWidget lowStockItems={lowStockItems} fastMovingBenchmarkItem={fastMovingBenchmarkItem} />
          </WidgetErrorBoundary>

          {/* ACCOUNTS DUE DATE ALERTS PANEL */}
          <WidgetErrorBoundary>
            <DueAlertsWidget dueAlerts={dueAlerts} shopName={shopName} />
          </WidgetErrorBoundary>

          {/* 💰 CASH REGISTER DRAWER */}
          <WidgetErrorBoundary>
            <CashDrawerWidget cashIn={metrics?.cashIn || 0} cashOut={metrics?.cashOut || 0} />
          </WidgetErrorBoundary>

          {/* 🎯 QUICK OPERATIONS ACTION SHORCUTS PANEL (FIXED VISIBILITY TEXT) */}
          <div className="bg-slate-100 dark:bg-slate-900/30 rounded-3xl p-5 border border-slate-200 dark:border-slate-800/80 text-left shadow-lg">
            {/* 🌟 FIXED SUBHEADING: High Contrast Text Visibility For Both Light & Dark Modes */}
            <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-4 font-mono bg-slate-200/50 dark:bg-slate-950/40 px-3 py-1 rounded-md w-max border border-slate-300/40 dark:border-slate-800">
              ⚡ Quick Shop Operations Shortcuts
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-bold">
              <button type="button" onClick={() => navigate('/invoices', { state: { autoOpenNew: true } })} className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl shadow-md cursor-pointer transition-all transform active:scale-95 duration-200 font-black"><span>🧾 Create Customer Bill / نیا بل</span> <span>➜</span></button>
              <button type="button" onClick={() => navigate('/suppliers', { state: { openAddModal: true } })} className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-2xl shadow-md cursor-pointer transition-all transform active:scale-95 duration-200 font-black"><span>👤 Add Supplier / بیوپاری شامل کریں</span> <span>➜</span></button>
              <button type="button" onClick={() => navigate('/inventory', { state: { autoOpenIntake: true } })} className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl shadow-md cursor-pointer transition-all transform active:scale-95 duration-200 font-black"><span>📦 Log Stock In / مال کا اندراج</span> <span>➜</span></button>
            </div>
          </div>

          {/* MAIN FINANCIAL METRICS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-left">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-black tracking-wider text-slate-500 dark:text-slate-400 uppercase">Total Sales / <span className="text-blue-600 font-black font-urdu">کل فروخت</span></p>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-2 font-mono">{formatCurrency(metrics.revenue)}</h3>
                </div>
                <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl text-base">💰</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] border-t border-slate-100 dark:border-slate-800 pt-2 font-mono text-slate-400 font-bold">
                <span>In: {formatCurrency(metrics.cashIn)}</span>
                <span>Out: {formatCurrency(metrics.cashOut)}</span>
              </div>
            </div>

            <div className={`border p-5 rounded-2xl shadow-sm transition-all duration-300 text-left ${isProfitAlarmActive ? 'bg-rose-500/5 border-rose-500/40 animate-pulse' : 'bg-white dark:bg-[#121b36] border-slate-200 dark:border-slate-800'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-[11px] font-black tracking-wider uppercase ${isProfitAlarmActive ? 'text-rose-500' : 'text-emerald-500'}`}>Net Profit / <span className="font-urdu font-black">اصلی بچت</span></p>
                  <h3 className={`text-xl font-black mt-2 font-mono ${isProfitAlarmActive ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatCurrency(calculatedNetProfit)}</h3>
                </div>
                <span className={`p-2 rounded-xl text-base ${isProfitAlarmActive ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-400'}`}>{isProfitAlarmActive ? '⚠️' : '📈'}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-4 border-t border-slate-100 dark:border-slate-800 pt-2 font-bold">Performance index matrix logic feed.</p>
            </div>

            <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-left">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-black tracking-wider text-blue-600 dark:text-blue-400 uppercase">Receivables / <span className="font-urdu font-black">گاہکوں سے ادھار وصولی</span></p>
                  <h3 className="text-xl font-black text-blue-600 dark:text-blue-400 mt-2 font-mono">{formatCurrency(metrics.totalReceivables)}</h3>
                </div>
                <span className="p-2 bg-blue-500/10 text-blue-400 rounded-xl text-base">👤</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-4 border-t border-slate-100 dark:border-slate-800 pt-2 font-bold">Outstanding active customer market balances.</p>
            </div>

            <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-left">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-black tracking-wider text-rose-600 dark:text-rose-400 uppercase">Total Payables / <span className="font-urdu font-black">بیوپاریوں کا قرضہ</span></p>
                  <h3 className="text-xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">{formatCurrency(metrics.totalPayables)}</h3>
                </div>
                <span className="p-2 bg-rose-500/10 text-rose-500 rounded-xl text-base">🏭</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-4 border-t border-slate-100 dark:border-slate-800 pt-2 font-bold">Pending accounts debt liability owed to suppliers.</p>
            </div>
          </div>

          {/* OPERATIONS ACTIVITY STREAM LOG */}
          <div className="bg-white dark:bg-[#121b36] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm text-left">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
              📋 Business Transactions Log / روزمرہ کی کارروائی کا کھاتا
            </h3>
            {!metrics.rawLogs || metrics.rawLogs.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs italic">No activities logged yet.</div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 font-bold">
                {metrics.rawLogs.map((log) => {
                  if (!log) return null;
                  const isExpensePurchase = log.transaction_type === 'purchase' || log.transaction_type === 'payment_out' || log.transaction_type === 'return';
                  return (
                    <div key={log.id} className="p-2.5 bg-slate-50 dark:bg-[#0b1329] border border-slate-100 dark:border-slate-800/40 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] border font-black uppercase ${isExpensePurchase ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}`}>{log.transaction_type}</span>
                        <div>
                          <p className="text-slate-900 dark:text-slate-200 font-black">{log.notes || 'Ledger Entry'}</p>
                          <p className="text-[11px] text-slate-400 font-mono font-medium mt-0.5">🕒 {new Date(log.created_at || new Date()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <p className={`font-mono font-black ${isExpensePurchase ? 'text-rose-600' : 'text-emerald-600'}`}>{isExpensePurchase ? '-' : '+'} {formatCurrency(log.cash_paid_received || log.amount || 0)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 💸 CHOTA KHARCHA MODAL OVERLAY */}
        {showExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden text-xs font-bold">
              <div className="p-5 border-b border-slate-700/50 flex justify-between items-center text-left">
                <h3 className="text-sm font-black text-white">Record Expense / چھوٹا خرچہ درج کریں</h3>
                <button type="button" onClick={() => setShowExpenseModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>
              <form onSubmit={handleSaveExpense} className="p-5 flex flex-col gap-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Expense Type *</label>
                  <select value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold cursor-pointer">
                    <option value="Chai / Food">Chai / Food (چائے/کھانا)</option>
                    <option value="Transport / Petrol">Transport / Petrol (سفر/پٹرول)</option>
                    <option value="Labor / Majdoori">Labor / Majdoori (مزدوری)</option>
                    <option value="Utility Bills">Utility Bills (بل)</option>
                    <option value="Shop Maintenance">Shop Maintenance & Utilities</option>
                    <option value="Other">+ Other / نیا خرچہ (Write Custom Type)</option>
                  </select>
                  {expenseForm.category === 'Other' && (
                    <div className="mt-2 animate-in slide-in-from-top-1">
                      <label className="block text-slate-300 text-[10px] uppercase tracking-wider mb-1">Enter Custom Expense Type</label>
                      <input type="text" required value={expenseForm.customCategory} onChange={e => setExpenseForm({...expenseForm, customCategory: e.target.value})} className="w-full px-3 py-2 bg-slate-900 border border-indigo-500 rounded-xl text-white text-xs outline-none" placeholder="e.g. Generator Diesel..." />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount ({APP_CONFIG.defaultCurrency}) *</label>
                  <input type="number" min="1" required value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm tracking-wide" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Short Note (Optional)</label>
                  <input type="text" value={expenseForm.notes} onChange={e => setExpenseForm({...expenseForm, notes: e.target.value})} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 text-xs" placeholder="Details..." />
                </div>
                <div className="flex gap-3 pt-2 text-xs font-bold">
                  <button type="button" onClick={() => setShowExpenseModal(false)} className="flex-1 py-2 px-3 bg-slate-700 text-white rounded-xl cursor-pointer">Cancel</button>
                  <button type="submit" className="flex-1 py-2 px-3 bg-rose-600 text-white rounded-xl shadow-md cursor-pointer">Save / محفوظ کریں</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body, html, #root { background: white !important; color: black !important; }
          aside, header, nav, button, select, .no-print, .print\\:hidden { display: none !important; visibility: hidden !important; }
          main, .flex-1, div, section { margin: 0 !important; padding: 0 !important; box-shadow: none !important; width: 100% !important; max-width: 100% !important; background: transparent !important; color: black !important; }
        }
      `}} />
    </>
  );
}
