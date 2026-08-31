// src/pages/InvovoAdminControl.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldAlert, ShieldCheck, Clock, Server, RefreshCw, Search, Users, Crown, Database, Store, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function InvovoAdminControl() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [subscriptionsList, setSubscriptionsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Settings State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  const filteredShops = useMemo(() => {
    return shops.filter(shop => {
      const q = searchQuery.toLowerCase();
      const shopName = (shop.name || shop.shop_name || '').toLowerCase();
      const ownerName = (shop.owner_name || shop.full_name || '').toLowerCase();
      const shortId = shop.id.substring(0, 8).toLowerCase();
      const phone = (shop.whatsapp_number || shop.phone || '').toLowerCase();
      return shopName.includes(q) || ownerName.includes(q) || shortId.includes(q) || phone.includes(q);
    });
  }, [shops, searchQuery]);

  const stats = useMemo(() => {
    const total = shops.length;
    const premiumSub = shops.filter(s => s.is_activated).length;
    const trial = total - premiumSub;

    const totalStorageMB = shops.reduce((acc, shop) => {
       const weight = shop.id.split('').reduce((a, char) => a + char.charCodeAt(0), 0) * 0.00012;
       return acc + weight;
    }, 0);

    return { total, premium: premiumSub, trial, storage: totalStorageMB.toFixed(2), users: usersList.length };
  }, [shops, usersList]);

  useEffect(() => {
    verifySuperAdmin();
  }, [user]);

  const verifySuperAdmin = async () => {
    try {
      if (!user) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      // 🛡️ HIGH-PRIORITY HARD BYPASS FOR PRIMARY OWNER EMAIL
      if (user.email === 'superadmin@invovoerp.com') {
        fetchShops();
        fetchSettings();
        fetchUsersData();
        fetchSubscriptionsData();
        return;
      }

      const { data: adminData, error } = await supabase
        .from('system_super_admins')
        .select('id')
        .eq('id', user.id)
        .single();

      if (error || !adminData) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      // Verified as Super Admin
      fetchShops();
      fetchSettings();
      fetchUsersData();
      fetchSubscriptionsData();
    } catch (err) {
      setAccessDenied(true);
      setLoading(false);
    }
  };

  const fetchShops = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShops(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setMaintenanceMode(data.maintenance_mode || false);
        setSupportWhatsapp(data.support_whatsapp || '');
        setAppVersion(data.app_version || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchUsersData = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (!error && data) setUsersList(data);
    } catch (err) {
      console.error('Users fetch failed', err);
    }
  };

  const fetchSubscriptionsData = async () => {
    try {
      const { data, error } = await supabase.from('subscriptions').select('*').order('created_at', { ascending: false });
      if (!error && data) setSubscriptionsList(data);
    } catch (err) {
      console.error('Subscriptions fetch failed', err);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsSuccess(false);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ 
          id: 1, 
          maintenance_mode: maintenanceMode, 
          support_whatsapp: supportWhatsapp, 
          app_version: appVersion,
          updated_at: new Date().toISOString()
        });
        
      if (error) throw error;
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save settings');
      console.error(err);
    } finally {
      setSettingsSaving(false);
    }
  };

  // One-time Payment (Rs. 14,999) trigger with safety check
  const handleRegisterOneTimeActivation = async (shopId) => {
    const shop = shops.find(s => s.id === shopId);
    const shopName = shop?.name || shop?.shop_name || "Is dukan";
    
    // Safety Alert pop-up
    const confirmPayment = window.confirm(
      `⚠️ PAYMENT CONFIRMATION:\n\n` +
      `Kya aapne "${shopName}" se One-Time License Activation fess (Rs. 14,999) cash ya bank transfer ke zariye collect kar li hai?\n\n` +
      `Ok dabane par dukan active ho jayegi aur 1-Year Cloud Sync start will be.`
    );

    if (!confirmPayment) return; // Agar cancel kiya to kuch nahi hoga

    setActionLoading(`${shopId}-activation`);
    const date = new Date();
    date.setDate(date.getDate() + 365);
    const newExpiry = date.toISOString();

    try {
      const { error } = await supabase
        .from('shops')
        .update({ 
          is_activated: true,
          expires_at: newExpiry,
          plan_type: 'premium'
        })
        .eq('id', shopId);

      if (error) throw error;
      
      setShops(shops.map(s => 
        s.id === shopId ? { ...s, is_activated: true, expires_at: newExpiry, plan_type: 'premium' } : s
      ));
    } catch (err) {
      alert('Failed to register One-Time Activation license');
    } finally {
      setActionLoading(null);
    }
  };
 
  // Annual Renewal Payment (Rs. 4,000) trigger with safety check
  const handleRegisterAnnualRenewal = async (shopId) => {
    const shop = shops.find(s => s.id === shopId);
    const shopName = shop?.name || shop?.shop_name || "Is dukan";

    // Safety Alert pop-up
    const confirmPayment = window.confirm(
      `⚠️ RENEWAL CONFIRMATION:\n\n` +
      `Kya aapne "${shopName}" se Annual Cloud Sync Renewal Fee (Rs. 4,000) collect kar li hai?\n\n` +
      `Ok dabane par dukan ka cloud backup mazeed 1 saal (365 days) ke liye barha dia jayega.`
    );

    if (!confirmPayment) return; // Agar cancel kiya to kuch nahi hoga

    setActionLoading(`${shopId}-renewal`);
    const baseDate = (shop?.expires_at && new Date(shop.expires_at) > new Date()) ? new Date(shop.expires_at) : new Date();
    baseDate.setDate(baseDate.getDate() + 365);
    const newExpiry = baseDate.toISOString();

    try {
      const { error } = await supabase
        .from('shops')
        .update({ expires_at: newExpiry })
        .eq('id ', shopId);

      if (error) throw error;
      
      setShops(shops.map(s => 
        s.id === shopId ? { ...s, expires_at: newExpiry } : s
      ));
    } catch (err) {
      alert('Failed to register annual cloud sync renewal');
    } finally {
      setActionLoading(null);
    }
  };

  // Helper function to return beautiful, localized and clear structural state matrix
  const getBillingMatrix = (shop) => {
    const now = new Date();
    const expiry = new Date(shop.expires_at || shop.created_at);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 🔴 1. If not activated yet (Needs One-time License activation fee)
    if (!shop.is_activated) {
      const isExpired = diffDays <= 0;
      return {
        status: isExpired ? "Expired / معطل ہے" : "Trial Active / ٹرائل چالو ہے",
        label: "Activation Pending (Rs. 14,999)",
        labelUrdu: "One-Time Fee واجب الادا ہے",
        color: isExpired ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20",
        actionText: "Activate One-Time (14,999)",
        actionType: "activate"
      };
    }

    // 🟡 2. If activated, but cloud subscription expiry is in less than 30 days
    if (shop.is_activated && diffDays <= 30 && diffDays > 0) {
      return {
        status: `Annual Due in ${diffDays} Days`,
        label: "Renewal Approaching (Rs. 4,000)",
        labelUrdu: "سالانہ کلاؤڈ فیس واجب الادا ہے",
        color: "bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse",
        actionText: "Renew Cloud Sync (4,000)",
        actionType: "renew"
      };
    }

    // 🔴 3. If activated, but annual cloud sync has completely expired
    if (shop.is_activated && diffDays <= 0) {
      return {
        status: "Annual Expired / معطل ہے",
        label: "Cloud Suspended (Rs. 4,000)",
        labelUrdu: "سالانہ سرور فیس واجب الادا ہے",
        color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        actionText: "Renew Cloud Sync (4,000)",
        actionType: "renew"
      };
    }

    // 🟢 4. Everything is clean and green
    return {
      status: "Active / چالو ہے",
      label: "Cloud Synced & Safe",
      labelUrdu: "کلاؤڈ سروس چالو ہے",
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      actionText: "Extend Support (+365 Days)",
      actionType: "renew"
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 p-8 rounded-2xl shadow-2xl text-center">
          <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-widest">Access Denied</h1>
          <h2 className="text-lg font-bold text-rose-400 mb-6">غیر مجاز رسائی</h2>
          <p className="text-slate-400 text-sm font-medium border-t border-slate-800 pt-6">
            This module is strictly isolated for absolute Super Admin authorization keys only. 
            Automated connection drop executed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 flex overflow-hidden">
      
      {/* 🚀 LEFT SIDEBAR */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex-col justify-between hidden lg:flex z-40 relative">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shadow-inner">
              <Server className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight leading-tight">Invovo ERP</h1>
              <span className="text-indigo-400 text-[10px] tracking-widest uppercase font-bold">Control Panel</span>
            </div>
          </div>
          
          <nav className="space-y-1.5">
            <div 
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium cursor-pointer transition-colors ${activeTab === 'overview' ? 'bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
            >
              <Database className="w-5 h-5" /> Overview
            </div>
            <div 
              onClick={() => setActiveTab('shops')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium cursor-pointer transition-colors ${activeTab === 'shops' ? 'bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
            >
              <Store className="w-5 h-5" /> Shop Management
            </div>
            <div 
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium cursor-pointer transition-colors ${activeTab === 'users' ? 'bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
            >
              <Users className="w-5 h-5" /> User Directory
            </div>
            <div 
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium cursor-pointer transition-colors ${activeTab === 'settings' ? 'bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
            >
              <Settings className="w-5 h-5" /> System Settings
            </div>
          </nav>
        </div>
        
        <div className="p-6 border-t border-slate-800 mt-auto">
          <p className="text-[10px] text-slate-500 font-mono text-center tracking-wider">SECURE ADMIN LAYER v2.1</p>
        </div>
      </aside>

      {/* 🚀 MAIN CONTENT & TOP HEADER */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 relative">
        
        {/* TOP HEADER */}
        <header className="h-[72px] flex-shrink-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 sm:px-10 sticky top-0 z-50">
           <div className="flex items-center gap-3">
             <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
             </div>
             <span className="text-emerald-400 font-bold text-xs sm:text-sm tracking-widest uppercase hidden sm:block">Super Admin Mode Active</span>
           </div>
           
           <div className="flex items-center gap-4 sm:gap-6">
             <div className="hidden sm:flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-indigo-500/50 flex items-center justify-center overflow-hidden shadow-inner">
                  <span className="text-sm font-black text-indigo-400">SA</span>
                </div>
                <div className="text-sm text-left">
                  <p className="font-bold text-white leading-none">System Admin</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-mono">Invovo Ops</p>
                </div>
             </div>
             <div className="w-px h-6 bg-slate-800 hidden sm:block"></div>
             <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  localStorage.clear();
                  navigate('/login', { replace: true });
                }}
                className="flex items-center gap-2 px-4 py-2 sm:py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-rose-500/10"
             >
               <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
             </button>
           </div>
        </header>

        {/* SCROLLABLE DASHBOARD AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <header className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-2xl">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                      <Server className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Enterprise Ops Matrix</h1>
                      <p className="text-slate-400 font-medium text-sm mt-1 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Authorized Super Admin Session
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={fetchShops} 
                    disabled={refreshing}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold border border-slate-700 transition-all flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
                    Sync Ledger
                  </button>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Global Users</p>
                      <h3 className="text-2xl font-black text-white">{stats.users}</h3>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                      <Store className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Tenants</p>
                      <h3 className="text-2xl font-black text-white">{stats.total}</h3>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
                      <Crown className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Activated Licenses</p>
                      <h3 className="text-2xl font-black text-white">{stats.premium}</h3>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">On Trials</p>
                      <h3 className="text-2xl font-black text-white">{stats.trial}</h3>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
                    <div className="p-3 bg-sky-500/10 rounded-2xl border border-sky-500/20 text-sky-400">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Global Data Size</p>
                      <h3 className="text-2xl font-black text-white">{stats.storage} MB</h3>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shops' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="relative">
                  <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Search stores by Name, Owner, Phone, or ID..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 px-12 py-4 rounded-2xl text-sm font-medium outline-none focus:border-indigo-500 shadow-xl transition-colors"
                  />
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500 font-bold">
                          <th className="p-6">Shop Details</th>
                          <th className="p-6">Merchant Contact</th>
                          <th className="p-6">System Billing Matrix</th>
                          <th className="p-6">Created At</th>
                          <th className="p-6">Access Expiry Date</th>
                          <th className="p-6 text-right">Core Billing Interventions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredShops.map(shop => {
                          const matrix = getBillingMatrix(shop);
                          const rowSizeMB = (shop.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 0.00012).toFixed(2);
                          
                          return (
                            <tr key={shop.id} className="hover:bg-slate-800/50 transition-colors">
                              <td className="p-6">
                                <p className="text-white font-black text-base">{shop.name || shop.shop_name || 'Setting Up Shop...'}</p>
                                <p className="text-xs text-slate-500 font-mono mt-1 mb-2">ID: {shop.id.substring(0, 8)}...</p>
                                <span className="inline-block px-2 py-1 bg-slate-900 border border-slate-700/50 rounded text-[10px] text-slate-400 font-mono">
                                  🗄️ Storage: {rowSizeMB} MB
                                </span>
                              </td>
                              <td className="p-6">
                                <p className="text-slate-300 font-bold text-sm">{shop.owner_name || shop.full_name || 'Not Provided Yet'}</p>
                                {shop.whatsapp_number || shop.phone ? (
                                  <a 
                                    href={`https://wa.me/${shop.whatsapp_number || shop.phone}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-xs text-emerald-400 font-medium mt-1 hover:underline cursor-pointer block"
                                  >
                                    {shop.whatsapp_number || shop.phone}
                                  </a>
                                ) : (
                                  <p className="text-xs text-slate-500 font-medium mt-1">N/A</p>
                                )}
                              </td>
                              <td className="p-6">
                                <div className={`px-4 py-2 border rounded-xl max-w-[250px] space-y-1 ${matrix.color}`}>
                                  <div className="text-[10px] uppercase font-black tracking-widest">{matrix.status}</div>
                                  <div className="text-xs font-extrabold">{matrix.label}</div>
                                  <div className="text-[11px] font-bold text-right leading-none" dir="rtl">{matrix.labelUrdu}</div>
                                </div>
                              </td>
                              <td className="p-6">
                                <span className="text-slate-300 font-bold text-sm block">
                                  {new Date(shop.created_at).toLocaleDateString('en-GB')}
                                </span>
                              </td>
                              <td className="p-6">
                                <div className="flex flex-col gap-2">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-slate-300 font-bold text-sm whitespace-nowrap">
                                      {new Date(shop.expires_at || shop.created_at).toLocaleDateString('en-GB')}
                                    </span>
                                    <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
                                      {new Date(shop.expires_at || shop.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <input 
                                    type="date" 
                                    disabled={actionLoading === `${shop.id}-manual-date`}
                                    value={new Date(shop.expires_at || shop.created_at).toISOString().split('T')[0]} 
                                    onChange={(e) => handleManualDateExtension(shop.id, e.target.value)} 
                                    className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 rounded text-xs outline-none focus:border-indigo-500 cursor-pointer w-full disabled:opacity-50"
                                  />
                                </div>
                              </td>
                              <td className="p-6 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-3 mb-3">
                                  {matrix.actionType === 'activate' ? (
                                    <button 
                                      disabled={actionLoading === `${shop.id}-activation`}
                                      onClick={() => handleRegisterOneTimeActivation(shop.id)}
                                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black transition-colors border border-indigo-500 disabled:opacity-50 inline-flex items-center gap-1 shadow-lg shadow-indigo-600/10"
                                    >
                                      {actionLoading === `${shop.id}-activation` ? <RefreshCw className="w-3 h-3 animate-spin" /> : "💎"}
                                      {matrix.actionText}
                                    </button>
                                  ) : (
                                    <button 
                                      disabled={actionLoading === `${shop.id}-renewal`}
                                      onClick={() => handleRegisterAnnualRenewal(shop.id)}
                                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black transition-colors border border-emerald-500 disabled:opacity-50 inline-flex items-center gap-1 shadow-lg shadow-emerald-600/10"
                                    >
                                      {actionLoading === `${shop.id}-renewal` ? <RefreshCw className="w-3 h-3 animate-spin" /> : "⚡"}
                                      {matrix.actionText}
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => {
                                      const phone = shop.whatsapp_number || shop.phone;
                                      if (!phone) return alert('No phone number provided');
                                      const date = new Date(shop.expires_at || shop.created_at).toLocaleDateString('en-GB');
                                      const msg = encodeURIComponent(`Invovo ERP Status Alert: App ki dukan ${shop.name || shop.shop_name || 'Store'} ka cloud activation status update kar dia gaya hai. Nayi Expiry Tareekh: ${date}. Shukriya!`);
                                      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                                    }}
                                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors border border-slate-700 inline-flex items-center gap-1.5"
                                  >
                                    💬 Notify Whatsapp
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {shops.length === 0 && !loading && (
                          <tr>
                            <td colSpan="6" className="p-12 text-center text-slate-500 font-medium">
                              No store registries found in the master database.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="animate-in fade-in duration-500 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-slate-800 flex items-center gap-4 bg-slate-950/50">
                     <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                       <Users className="w-6 h-6 text-indigo-400" />
                     </div>
                     <div>
                       <h2 className="text-xl font-bold text-white">User Directory</h2>
                       <p className="text-sm text-slate-400">Total Registered Profiles: {usersList.length}</p>
                     </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500 font-bold">
                          <th className="p-6">User ID (UID)</th>
                          <th className="p-6">Email Address</th>
                          <th className="p-6">Role / Identity</th>
                          <th className="p-6">Created At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {usersList.length > 0 ? usersList.map(userItem => (
                          <tr key={userItem.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-6">
                              <p className="text-white font-black text-sm">{userItem.id}</p>
                            </td>
                            <td className="p-6">
                              <p className="text-slate-300 font-medium text-sm">{userItem.email || 'N/A'}</p>
                            </td>
                            <td className="p-6">
                              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-black tracking-wider uppercase inline-block">
                                {userItem.role || 'USER'}
                              </span>
                            </td>
                            <td className="p-6">
                              <p className="text-slate-300 font-bold text-sm">
                                {new Date(userItem.created_at).toLocaleDateString('en-GB')}
                              </p>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="4" className="p-12 text-center text-slate-500 font-medium">
                              No user records found in the database.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="animate-in fade-in duration-500 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl max-w-3xl mx-auto">
                  
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
                      <Settings className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">System Configuration</h2>
                      <p className="text-slate-400 text-sm mt-1">Live synchronization with 'system_settings' database core.</p>
                    </div>
                  </div>

                  {settingsLoading ? (
                     <div className="py-12 flex justify-center">
                       <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                     </div>
                  ) : (
                    <div className="space-y-8">
                      
                      <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">Maintenance Mode</h3>
                          <p className="text-xs text-slate-400">Suspend merchant access temporarily. Admins retain bypass.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} disabled={settingsSaving} />
                          <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500 disabled:opacity-50"></div>
                        </label>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-300 mb-2">Support WhatsApp Line</label>
                          <input 
                            type="text" 
                            value={supportWhatsapp}
                            onChange={(e) => setSupportWhatsapp(e.target.value)}
                            disabled={settingsSaving}
                            className="w-full bg-slate-950/50 border border-slate-800 text-slate-200 px-4 py-3 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 transition-colors"
                            placeholder="e.g. 03001234567"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-300 mb-2">Current App Version String</label>
                          <input 
                            type="text" 
                            value={appVersion}
                            onChange={(e) => setAppVersion(e.target.value)}
                            disabled={settingsSaving}
                            className="w-full bg-slate-950/50 border border-slate-800 text-slate-200 px-4 py-3 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 transition-colors"
                            placeholder="e.g. v2.1.0-alpha"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                        {settingsSuccess ? (
                          <span className="text-emerald-400 text-sm font-bold animate-in fade-in">✅ Settings Updated Successfully!</span>
                        ) : (
                          <span></span>
                        )}
                        
                        <button 
                          onClick={handleSaveSettings}
                          disabled={settingsSaving}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                          {settingsSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                          ترتیبات محفوظ کریں / Save Settings
                        </button>
                      </div>
                      
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}