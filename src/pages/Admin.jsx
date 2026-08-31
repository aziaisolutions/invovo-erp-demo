import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Search, Store, AlertTriangle, Power, Clock, XCircle, Save, X } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatCurrency, APP_CONFIG } from '../config/appConfig';

export default function Admin() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [shopsData, setShopsData] = useState([]);
  
  // Search Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Shop for Admin Notes Overlay
  const [selectedShop, setSelectedShop] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Redirect instantly if not super_admin
  if (role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchGlobalData = async () => {
    try {
      setLoading(true);
      // Fetch all shops
      const { data: sData, error: sError } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      if (sError) throw sError;

      // Fetch all subscriptions
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*');

      if (subError) throw subError;

      // Join the data
      const joined = sData.map(shop => {
        const sub = subData.find(s => s.shop_id === shop.id) || {};
        return {
          ...shop,
          subscription: sub
        };
      });

      setShopsData(joined);
    } catch (err) {
      console.error(err);
      alert('Failed to load global admin data. Check Supabase permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
  }, []);

  
  // Metrics Engine
  const metrics = useMemo(() => {
    const total = shopsData.length;
    const active = shopsData.filter(s => s.subscription.status === 'active').length;
    const trial = shopsData.filter(s => s.subscription.status === 'trial').length;
    const suspended = shopsData.filter(s => s.subscription.status === 'suspended').length;
    const revenue = active * 1999;

    return { total, active, trial, suspended, revenue };
  }, [shopsData]);

  // Expiry Tracking (Next 5 Days)
  const expiringShops = useMemo(() => {
    const now = new Date();
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(now.getDate() + 5);

    return shopsData.filter(shop => {
      const sub = shop.subscription;
      if (!sub) return false;

      if (sub.status === 'trial' && sub.trial_ends_at) {
        const trialEnd = new Date(sub.trial_ends_at);
        return trialEnd > now && trialEnd <= fiveDaysFromNow;
      }
      if (sub.status === 'active' && sub.subscription_ends_at) {
        const subEnd = new Date(sub.subscription_ends_at);
        return subEnd > now && subEnd <= fiveDaysFromNow;
      }
      return false;
    });
  }, [shopsData]);

  // Master Search Filter
  const filteredShops = useMemo(() => {
    if (!searchTerm) return shopsData;
    const term = searchTerm.toLowerCase();
    return shopsData.filter(s => 
      (s.shop_name && s.shop_name.toLowerCase().includes(term)) ||
      (s.phone && s.phone.includes(term)) ||
      (s.owner_email && s.owner_email.toLowerCase().includes(term))
    );
  }, [shopsData, searchTerm]);

  // Control Utilities
  const updateSubscription = async (shopId, updates) => {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('shop_id', shopId);

      if (error) throw error;

      // Update local state
      setShopsData(shopsData.map(s => {
        if (s.id === shopId) {
          return { ...s, subscription: { ...s.subscription, ...updates } };
        }
        return s;
      }));
    } catch (err) {
      alert('Failed to update subscription.');
    }
  };

  const handleActivate = (shop) => {
    const newEnd = new Date();
    newEnd.setDate(newEnd.getDate() + 30);
    updateSubscription(shop.id, { 
      status: 'active', 
      subscription_ends_at: newEnd.toISOString() 
    });
  };

  const handleSuspend = (shop) => {
    updateSubscription(shop.id, { status: 'suspended' });
  };

  const handleExtendTrial = (shop) => {
    const existing = shop.subscription.trial_ends_at ? new Date(shop.subscription.trial_ends_at) : new Date();
    existing.setDate(existing.getDate() + 7);
    updateSubscription(shop.id, { 
      status: 'trial',
      trial_ends_at: existing.toISOString() 
    });
  };

  const saveAdminNotes = async () => {
    if (!selectedShop) return;
    setSavingNotes(true);
    await updateSubscription(selectedShop.id, { admin_notes: adminNotes });
    setSavingNotes(false);
  };

  const getRowColorClass = (status) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/5 hover:bg-emerald-500/10 border-l-4 border-emerald-500';
      case 'trial': return 'bg-yellow-500/5 hover:bg-yellow-500/10 border-l-4 border-yellow-500';
      case 'grace_period': return 'bg-orange-500/5 hover:bg-orange-500/10 border-l-4 border-orange-500';
      case 'suspended': return 'bg-rose-500/5 hover:bg-rose-500/10 border-l-4 border-rose-500';
      default: return 'bg-slate-800 hover:bg-slate-700/50 border-l-4 border-slate-600';
    }
  };

  const calculateDaysRemaining = (sub) => {
    if (!sub) return '-';
    const now = new Date();
    let target = null;
    
    if (sub.status === 'trial' && sub.trial_ends_at) {
      target = new Date(sub.trial_ends_at);
    } else if (sub.status === 'active' && sub.subscription_ends_at) {
      target = new Date(sub.subscription_ends_at);
    }
    
    if (!target) return '-';
    
    const diff = target - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} Days` : 'Expired';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 border-b border-slate-700/50 pb-6">
        <div className="bg-indigo-500/20 p-3 rounded-2xl border border-indigo-500/30">
          <ShieldCheck className="w-10 h-10 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Command Center</h1>
          <p className="text-indigo-400 font-bold uppercase tracking-widest text-sm">Super Admin Level Access</p>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registered Shops</h3>
          <p className="text-3xl font-black text-white mt-2">{metrics.total}</p>
        </div>
        
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full"></div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider z-10">Active Shops</h3>
          <p className="text-3xl font-black text-emerald-400 mt-2 z-10">{metrics.active}</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/10 rounded-bl-full"></div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider z-10">Trial Accounts</h3>
          <p className="text-3xl font-black text-yellow-400 mt-2 z-10">{metrics.trial}</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-bl-full"></div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider z-10">Suspended</h3>
          <p className="text-3xl font-black text-rose-400 mt-2 z-10">{metrics.suspended}</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900 backdrop-blur-md border border-indigo-500/30 rounded-2xl p-5 shadow-xl flex flex-col justify-between md:col-span-1 col-span-2">
          <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Est. Monthly Revenue</h3>
          <p className="text-2xl font-black text-white mt-2 font-mono tracking-tight">{formatCurrency(metrics.revenue)}</p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Tenant Matrix */}
        <div className="lg:col-span-3">
          
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-indigo-400" />
              Shops Registry
            </h2>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search shops, email, phone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-1 focus:ring-indigo-500 transition-shadow"
              />
            </div>
          </div>

          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
                    <th className="p-4 font-bold text-left rtl:text-right">Shop / Owner</th>
                    <th className="p-4 font-bold text-left rtl:text-right">Contact</th>
                    <th className="p-4 font-bold text-left rtl:text-right">Status</th>
                    <th className="p-4 font-bold text-center">Remaining</th>
                    <th className="p-4 font-bold text-right rtl:text-left">Mgmt Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30 text-sm">
                  {filteredShops.map(shop => {
                    const status = shop.subscription?.status || 'unknown';
                    return (
                      <tr 
                        key={shop.id} 
                        className={`transition-colors cursor-pointer ${getRowColorClass(status)}`}
                        onClick={() => {
                          setSelectedShop(shop);
                          setAdminNotes(shop.subscription?.admin_notes || '');
                        }}
                      >
                        <td className="p-4">
                          <div className="font-bold text-slate-200">{shop.shop_name}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">ID: {shop.id.substring(0,8)}...</div>
                        </td>
                        <td className="p-4">
                          <div className="text-slate-300">{shop.owner_email || 'N/A'}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{shop.phone || '-'}</div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border
                            ${status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                              status === 'trial' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 
                              status === 'suspended' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 
                              'bg-slate-700 text-slate-400 border-slate-600'}
                          `}>
                            {status}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono font-medium text-slate-300">
                          {calculateDaysRemaining(shop.subscription)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => handleActivate(shop)}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors"
                              title="Activate (+30 Days)"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleExtendTrial(shop)}
                              className="p-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded transition-colors"
                              title="Extend Trial (+7 Days)"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleSuspend(shop)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded transition-colors"
                              title="Suspend Immediately"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredShops.length === 0 && (
                <div className="p-8 text-center text-slate-400">No shops found matching your search.</div>
              )}
            </div>
          </div>
        </div>

        {/* Expiry Tracking Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl p-5 sticky top-24">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              Expiring Soon (5 Days)
            </h3>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {expiringShops.length === 0 ? (
                <div className="p-4 bg-slate-900/50 rounded-lg text-sm text-slate-400 text-center border border-slate-800">
                  No shops expiring soon.
                </div>
              ) : (
                expiringShops.map(shop => (
                  <div key={`exp-${shop.id}`} className="p-3 bg-slate-900/80 rounded-xl border border-orange-500/20 hover:border-orange-500/40 transition-colors cursor-pointer" onClick={() => { setSelectedShop(shop); setAdminNotes(shop.subscription?.admin_notes || ''); }}>
                    <p className="font-bold text-sm text-slate-200">{shop.shop_name}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${shop.subscription.status === 'trial' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {shop.subscription.status}
                      </span>
                      <span className="text-xs font-mono font-medium text-orange-400">
                        {calculateDaysRemaining(shop.subscription)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Admin Notes Profile Panel Overlay */}
      {selectedShop && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-700 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-800/50">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedShop.shop_name}</h3>
                <p className="text-sm text-slate-400 font-mono mt-1">{selectedShop.owner_email || 'No email'}</p>
                <div className="mt-3 inline-block">
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border ${selectedShop.subscription?.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : selectedShop.subscription?.status === 'trial' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : selectedShop.subscription?.status === 'suspended' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                    {selectedShop.subscription?.status || 'unknown'}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedShop(null)} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <div className="mb-6 space-y-2">
                <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Signup Date</span>
                  <span className="text-slate-300">{new Date(selectedShop.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Phone</span>
                  <span className="text-slate-300">{selectedShop.phone || '-'}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Trial Ends</span>
                  <span className="text-slate-300">{selectedShop.subscription?.trial_ends_at ? new Date(selectedShop.subscription.trial_ends_at).toLocaleDateString() : '-'}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Sub Ends</span>
                  <span className="text-slate-300">{selectedShop.subscription?.subscription_ends_at ? new Date(selectedShop.subscription.subscription_ends_at).toLocaleDateString() : '-'}</span>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-3 uppercase tracking-widest">
                  <Save className="w-4 h-4 text-indigo-400" />
                  Admin Notes
                </label>
                <textarea 
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  onBlur={saveAdminNotes}
                  placeholder="Enter private backend notes about this tenant..."
                  className="w-full h-48 bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-slate-500">Notes auto-save on blur.</p>
                  {savingNotes && <span className="text-xs text-indigo-400 animate-pulse">Saving...</span>}
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900">
              <button 
                onClick={() => setSelectedShop(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
              >
                Close Panel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
