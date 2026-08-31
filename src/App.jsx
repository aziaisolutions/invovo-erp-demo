// src/App.jsx
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import { MaintenanceGuard } from './components/MaintenanceGuard';
import { useRole } from './hooks/useRole';
import { supabase } from './lib/supabase';
import { ShieldAlert, LogOut } from 'lucide-react';

// Static Imports (Jo login page par foran chahiye)
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// Dynamic Lazy Imports (Heavy routes split into independent visual chunks)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Reports = lazy(() => import('./pages/Reports'));
const Admin = lazy(() => import('./pages/Admin'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Settings = lazy(() => import('./pages/Settings'));
const InvovoAdminControl = lazy(() => import('./pages/InvovoAdminControl'));

// Loading Fallback Spinner Component
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-900">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
  </div>
);

// 🛡️ SAAS SUBSCRIPTION GATE INTERCEPTOR (MIDDLEWARE LAYER)
const SubscriptionGuard = () => {
  let activeShopId = null;
  try {
    const roleData = useRole();
    activeShopId = roleData?.activeShopId ?? null;
  } catch (err) {
    console.error("Routing context failed:", err);
  }
  
  const [checking, setChecking] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [lockReason, setLockReason] = useState(null);

  useEffect(() => {
    const runHybridChecks = async () => {
      if (!activeShopId) {
        setChecking(false);
        return;
      }

      // 🛡️ SUPER ADMIN BYPASS
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.email === 'superadmin@invovoerp.com') {
        setChecking(false);
        return;
      }

      const now = Date.now();
      let sysLastOpened = localStorage.getItem('sys_last_opened') || now.toString();
      let sysLastSync = localStorage.getItem('sys_last_sync') || now.toString();
      let sysPlanExpiry = localStorage.getItem('sys_plan_expiry');

      // LIVE SYNC FIRST (If Online)
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('shops')
            .select('expires_at, plan_type')
            .eq('id', activeShopId)
            .single();

          if (!error && data) {
            // Update last active status dynamically in background
            supabase.from('shops').update({ last_active_at: new Date().toISOString() }).eq('id', activeShopId).then();

            const expiration = new Date(data.expires_at || new Date()).getTime();
            localStorage.setItem('sys_plan_expiry', expiration.toString());
            localStorage.setItem('sys_last_sync', now.toString());
            sysPlanExpiry = expiration.toString();
          }
        } catch (err) {
          console.error("Subscription Validation Failed:", err);
        }
      }

      // Fallback if completely offline on first run (Rare)
      if (!sysPlanExpiry) {
        sysPlanExpiry = (now + 1296000000).toString();
      }

      // 1. System Clock Tamper Check
      if (now < parseInt(sysLastOpened)) {
        setLockReason("System date tampered! Please restore correct date & time.");
        setChecking(false);
        return;
      }
      localStorage.setItem('sys_last_opened', now.toString());

      // 2. 15-Day Offline Grace Period Limit
      if (now - parseInt(sysLastSync) > 1296000000) {
        setLockReason("Offline limit (15 days) exceeded. Please connect to internet to re-verify license.");
        setChecking(false);
        return;
      }

      // 3. Local Token Expiry Check
      if (now > parseInt(sysPlanExpiry)) {
        setLockReason("Subscription plan expired. Please renew your plan.");
        setIsExpired(true);
        setExpiryDate(new Date(parseInt(sysPlanExpiry)).toLocaleDateString('en-GB'));
        setChecking(false);
        return;
      }

      // All checks passed
      setLockReason(null);
      setIsExpired(false);
      setChecking(false);
    };

    runHybridChecks();

    const handleOnline = () => {
       setChecking(true);
       runHybridChecks();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [activeShopId]);

  if (!activeShopId) {
    return <Navigate to="/login" replace />;
  }

  if (checking) return <PageLoader />;

  // 🔒 HIGH-DIGNITY SAAS ACCOUNT LOCK SCREEN
  if (lockReason) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen overflow-y-auto py-8 bg-[#070d24] text-center px-4 animate-in fade-in duration-300">
        <div className="bg-amber-500/10 p-6 rounded-full mb-6 border border-amber-500/30 shadow-2xl shadow-amber-500/10">
          <ShieldAlert className="w-16 h-16 text-amber-500 animate-pulse" />
        </div>
        
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase">
          Security Lock / <span className="text-amber-400 font-extrabold">System Locked</span>
        </h1>
        
        <p className="text-slate-300 max-w-xl mx-auto text-base mt-4 font-bold bg-amber-950/40 p-4 border border-amber-800 rounded-xl">
          {lockReason}
        </p>

        {isExpired && (
          <>

        {/* 💳 SINGLE PREMIUM LICENSE & CLOUD POLICY BOX */}
        <div className="w-full max-w-lg bg-slate-900/90 border border-slate-700/60 p-4 sm:p-6 rounded-2xl mt-6 shadow-xl text-left space-y-4 font-sans text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Available Packages / Store Packages</span>
            <span className="text-emerald-400 font-mono">Premium Licensing Engine</span>
          </div>
          
          {/* Main Single Card */}
          <div className="space-y-2.5 text-slate-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-indigo-950/40 p-4 rounded-xl border border-indigo-500/30">
              <div>
                <p className="font-black text-sm text-indigo-300">💎 1. One-Time Activation License</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Software setup and activation fee (One-Time Fee)</p>
                <p className="text-[10px] text-emerald-400 font-black mt-1">🎁 First Year Cloud Sync & Support: FREE / FREE</p>
              </div>
              <span className="text-sm font-black text-white bg-indigo-600 px-4 py-2 rounded-lg">Rs. 14,999</span>
            </div>
          </div>

          {/* ⚖️ Legal & Cloud Policy Clause Disclosure */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[10px] text-slate-400 space-y-2.5 leading-relaxed">
            <p className="font-bold text-slate-200 text-xs border-b border-slate-800 pb-1">⚠️ Terms of Service & Cloud Policy (Terms & Conditions):</p>
            
            <ul className="list-decimal list-inside space-y-1.5 font-medium pl-1 text-slate-300">
              <li>
                <strong>Cloud & Support Limit:</strong> Upstream Cloud Sync, secure online database backups, and technical support services are included for <strong className="text-indigo-300">1 Year (365 Days)</strong> from activation.
              </li>
              <li>
                <strong>Annual Renewal:</strong> After 1 year, an annual server maintenance fee of <strong className="text-emerald-400">Rs. 4,000 / Year</strong> is required to keep real-time cloud data sync active.
              </li>
              <li>
                <strong>Suspension Clause:</strong> Failure to pay the annual renewal fee within the due date will result in the <strong className="text-rose-400">automatic suspension</strong> of all cloud services and application access.
              </li>
              
              {/* Correct Urdu Alignment Lines */}
              <li className="list-none pt-2 border-t border-slate-800/60 text-[11px] leading-relaxed text-slate-300 space-y-1">
                <p className="text-right font-semibold" dir="rtl">
                  • Software activation fee includes only the first year of cloud service and backup.
                </p>
                <p className="text-right font-semibold" dir="rtl">
                  • After one year, to continue cloud service and backup, an annual <strong className="text-emerald-400">4,000 Rs.</strong> server fee is required.
                </p>
                <p className="text-right font-semibold" dir="rtl">
                  • Failure to pay the annual fee on time will result in suspension of cloud services and login access. <strong className="text-rose-400">Suspended</strong> 
                </p>
              </li>
            </ul>
          </div>

          {/* Payment Account Details */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 text-slate-300 font-mono font-bold">
            <p className="text-slate-400 font-sans text-[11px] mb-1">EasyPaisa / JazzCash / Bank Transfer Wallet:</p>
            <p>📱 Mobile Account: <span className="text-white text-sm font-black">+1-800-INVOVO</span></p>
            <p>👤 Account Title Name: <span className="text-indigo-400">Invovo Support</span></p>
          </div>
          
          <p className="text-[10px] text-slate-400 text-center font-bold mt-2">
            *Send a screenshot of the transfer to the contact number below, and your store package will be activated in 5 seconds!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 w-full sm:w-auto">
          <a 
            href="https://wa.me/18000000000?text=Invovo%20ERP%20Account%20Activation" 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black shadow-lg transition-all transform active:scale-95 duration-200"
          >
            💬 Contact Admin WhatsApp
          </a>
          <button 
            type="button" 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
        </>
        )}
      </div>
    );
  }

  return <Outlet />;
};

function App() {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-8 bg-[#070d24] text-center px-4">
        <div className="bg-rose-500/10 p-6 rounded-full mb-6 border border-rose-500/30">
          <ShieldAlert className="w-16 h-16 text-rose-500" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight uppercase">
          Setup Required
        </h1>
        <p className="text-slate-300 max-w-xl mx-auto text-base mt-4 bg-rose-950/40 p-4 border border-rose-800 rounded-xl leading-relaxed">
          The application is missing critical environment variables. Please create a <strong>.env.local</strong> file in the root directory and add your Supabase credentials:
        </p>
        <div className="w-full max-w-lg bg-slate-900/90 border border-slate-700/60 p-4 sm:p-6 rounded-2xl mt-6 shadow-xl text-left space-y-4 font-mono text-emerald-400 text-sm">
          VITE_SUPABASE_URL=your_project_url<br/>
          VITE_SUPABASE_ANON_KEY=your_anon_key
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          {/* Wrap dynamic chunks inside Suspense window boundary fallback */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/Invovo-tech-control-panel" element={<InvovoAdminControl />} />
              
              <Route element={<AuthGuard />}>
                {/* 🛡️ SECURITY LAYER ATTACHED HERE FOR THE MULTI-TENANT LEASE OVERVIEW */}
                <Route element={<MaintenanceGuard />}>
                  <Route element={<SubscriptionGuard />}>
                    {/* Routes wrapped in Layout navigation */}
                    <Route element={<Layout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/suppliers" element={<Suppliers />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/invoices" element={<Invoices />} />
                      <Route path="/settings" element={<Settings />} />
                    </Route>
                  </Route>
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;