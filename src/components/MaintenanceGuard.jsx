import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Wrench } from 'lucide-react';
import { Outlet } from 'react-router-dom';

export const MaintenanceGuard = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let channel;

    const initGuard = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.email === 'superadmin@invovoerp.com') {
          setIsSuperAdmin(true);
          setChecking(false);
          return; // Super admin bypass
        }

        const { data: settings } = await supabase
          .from('system_settings')
          .select('maintenance_mode')
          .eq('id', 1)
          .single();

        if (settings) {
          setIsMaintenance(settings.maintenance_mode === true);
        }

        // Setup realtime listener for instant lockout
        channel = supabase.channel('maintenance_tracker')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'system_settings' },
            (payload) => {
              if (payload.new && payload.new.id === 1) {
                setIsMaintenance(payload.new.maintenance_mode === true);
              }
            }
          )
          .subscribe();

      } catch (error) {
        console.error('Maintenance Check Failed:', error);
      } finally {
        setChecking(false);
      }
    };

    initGuard();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (isMaintenance && !isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center min-h-screen overflow-y-auto py-8 bg-[#070d24] text-center px-4 animate-in fade-in duration-300 backdrop-blur-md">
        <div className="bg-rose-500/10 p-6 rounded-full mb-6 border border-rose-500/30 shadow-2xl shadow-rose-500/10">
          <Wrench className="w-16 h-16 text-rose-500 animate-pulse" />
        </div>
        
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase">
          System Under Maintenance / <span className="text-rose-400 font-extrabold">سسٹم مینٹیننس میں ہے</span>
        </h1>
        
        <p className="text-slate-300 max-w-xl mx-auto text-base mt-4 font-bold bg-rose-950/40 p-4 border border-rose-800 rounded-xl">
          We are currently performing scheduled maintenance to upgrade our cloud servers. Your data is safe. Please check back soon.
        </p>

        <div className="mt-8 text-sm font-bold text-slate-500">
          Powered by Invovo (Invovo ERP Engine)
        </div>
      </div>
    );
  }

  // Support both wrapper usage {children} and React Router layout usage <Outlet />
  return children || <Outlet />;
};
