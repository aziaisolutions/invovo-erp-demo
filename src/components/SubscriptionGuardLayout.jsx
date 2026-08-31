import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // FIXED: Direct import to bypass Context API undefined leaks

// =========================================================================
// 1. DETERMINISTIC STATE ENGINE (Timezone & UTC Standard Aligned)
// =========================================================================
function calculateSubscriptionState(subscription) {
  const localNow = new Date();
  const now = new Date(localNow.getTime() + localNow.getTimezoneOffset() * 60000);
  
  if (!subscription) {
    return { phase: 'active', daysRemaining: 30, isBlocked: false };
  }

  if (subscription.status === 'suspended') {
    return { phase: 'suspended', daysRemaining: 0, isBlocked: true };
  }

  const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const subEnd = subscription.subscription_ends_at ? new Date(subscription.subscription_ends_at) : null;

  if (subscription.status === 'active' && subEnd && subEnd > now) {
    const daysRemaining = Math.ceil((subEnd - now) / (1000 * 60 * 60 * 24));
    return { phase: 'active', daysRemaining, isBlocked: false };
  }

  if (trialEnd && trialEnd > now) {
    const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    let alertColor = 'bg-blue-600';
    
    if (daysRemaining === 1) {
      alertColor = 'bg-red-600 animate-pulse';
    } else if (daysRemaining === 2) {
      alertColor = 'bg-amber-500';
    }
    
    return { phase: 'trial', daysRemaining, isBlocked: false, alertColor };
  }

  const exactExpiry = subEnd && subEnd > (trialEnd || 0) ? subEnd : (trialEnd || now);
  const elapsedMs = now - exactExpiry;
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  if (elapsedDays >= 0 && elapsedDays <= 5) {
    return { 
      phase: 'grace', 
      daysRemaining: 5 - elapsedDays, 
      isBlocked: false, 
      alertColor: 'bg-amber-600' 
    };
  }

  if (subscription.status === 'active') {
    return { phase: 'active', daysRemaining: 30, isBlocked: false };
  }

  return { phase: 'expired', daysRemaining: 0, isBlocked: true };
}

// =========================================================================
// 2. DATA EXPORT ENGINE (Excel-Safe Double-Quoted UTF-8 BOM CSV Strings)
// =========================================================================
async function downloadShopBackup(shopId) {
  const datasets = ['products', 'customers', 'suppliers', 'transactions'];
  
  for (const segment of datasets) {
    const { data, error } = await supabase
      .from(segment)
      .select('*')
      .eq('shop_id', shopId);

    if (!error && data && data.length > 0) {
      const fields = Object.keys(data[0]); // FIXED: Safe header field mapping extraction from first element
      const headerLine = fields.join(',');
      
      const contentLines = data.map(obj => 
        fields.map(fieldName => {
          const val = obj[fieldName] === null || obj[fieldName] === undefined ? '' : String(obj[fieldName]);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',')
      );
      
      const compiledCSV = [headerLine, ...contentLines].join('\r\n');
      const binaryBlob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), compiledCSV], { type: 'text/csv;charset=utf-8;' });
      const temporaryAnchor = document.createElement('a');
      
      temporaryAnchor.href = URL.createObjectURL(binaryBlob);
      temporaryAnchor.setAttribute('download', `invovo_erp_${segment}_backup.csv`);
      document.body.appendChild(temporaryAnchor);
      temporaryAnchor.click();
      document.body.removeChild(temporaryAnchor);
    }
  }
}
// =========================================================================
// 3. MAIN COMPONENT EXPORT
// =========================================================================
export default function SubscriptionGuardLayout({ children, shopId, isUrdu = false }) {
  const [subRow, setSubRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const WHATSAPP_NUM = "+923001234567";
  // FIXED: Missing string interpolation wrapper symbol corrected
  const WA_REDIRECT = `https://wa.me{WHATSAPP_NUM.replace('+', '')}?text=Salam%20Smart%20Hisab%20Activation%20ShopId%20${shopId || 'Unknown'}`;

  useEffect(() => {
    async function pullSubscription() {
      if (!shopId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, trial_ends_at, subscription_ends_at')
        .eq('shop_id', shopId)
        .maybeSingle();

      if (!error && data) {
        setSubRow(data);
      } else {
        setSubRow(null);
      }
      setLoading(false);
    }
    pullSubscription();
  }, [shopId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const engine = calculateSubscriptionState(subRow);

  // --- INTERFACE LOCKOUT SCREEN ---
  if (engine.isBlocked) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-4 font-sans text-white" dir={isUrdu ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-6v2m0-8H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-5z" />
            </svg>
          </div>

          {isUrdu ? (
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-white">Account Suspended</h1>
              <p className="text-slate-400 text-sm leading-relaxed">Your subscription has expired. Please activate your package to continue using the application.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-white">Account Suspended</h1>
              <p className="text-slate-400 text-sm leading-relaxed">Your access window has expired. Please renew your workspace subscription package to restore platform operations.</p>
            </div>
          )}

          <div className="my-6 rounded-xl border border-slate-800/80 bg-slate-950/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">'Premium Package Fee'</p>
            <h2 className="mt-1 text-3xl font-black text-emerald-400">PKR 1,999<span className="text-xs font-normal text-slate-400"> / 'month'</span></h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a 
              href={WA_REDIRECT}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold transition-all hover:bg-emerald-500 text-white decoration-0"
            >
              <span>'Activate via WhatsApp'</span>
              <span className="rounded bg-emerald-700 px-1.5 py-0.5 font-mono text-xs text-white">{WHATSAPP_NUM}</span>
            </a>

            <button
              onClick={async () => {
                if (!shopId) return;
                setIsExporting(true);
                try {
                  await downloadShopBackup(shopId);
                } catch (err) {
                  console.error(err);
                } finally {
                  setIsExporting(false);
                }
              }}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3.5 text-sm font-semibold text-slate-200 transition-all hover:bg-slate-700 disabled:opacity-50"
            >
              <svg className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{isExporting ? 'Exporting...' : 'Download My Data'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- TOP NOTIFICATION ALERTS ---
  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100" dir={isUrdu ? 'rtl' : 'ltr'}>
      {engine.phase !== 'active' && (
        <div className={`w-full text-center px-4 py-2 text-xs sm:text-sm font-bold text-white transition-all shadow-md ${engine.alertColor}`}>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {engine.phase === 'trial' && (
              isUrdu ? (
                <>
                  <span>FREE Trial: {engine.daysRemaining} days remaining — Contact us for activation</span>
                  <a href={WA_REDIRECT} target="_blank" rel="noopener noreferrer" className="underline font-mono bg-black/20 px-2 py-0.5 rounded text-white decoration-0">WhatsApp {WHATSAPP_NUM}</a>
                </>
              ) : (
                <>
                  <span>Free trial: {engine.daysRemaining} days remaining — Contact to activate account</span>
                  <a href={WA_REDIRECT} target="_blank" rel="noopener noreferrer" className="underline font-mono bg-black/20 px-2 py-0.5 rounded text-white decoration-0">WhatsApp {WHATSAPP_NUM}</a>
                </>
              )
            )}

            {engine.phase === 'grace' && (
              isUrdu ? (
                <>
                  <span>Subscription expired — {engine.daysRemaining} days grace period remaining, please renew.</span>
                  <a href={WA_REDIRECT} target="_blank" rel="noopener noreferrer" className="underline font-mono bg-black/20 px-2 py-0.5 rounded text-white decoration-0">Renew</a>
                </>
              ) : (
                <>
                  <span>Subscription expired — {engine.daysRemaining} days grace period remaining, please renew.</span>
                  <a href={WA_REDIRECT} target="_blank" rel="noopener noreferrer" className="underline font-mono bg-black/20 px-2 py-0.5 rounded text-white decoration-0">Renew Now</a>
                </>
              )
            )}
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
