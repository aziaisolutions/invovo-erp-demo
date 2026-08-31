import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function InstallBanner() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Only bother listening if user is logged in
    if (!user) return;

    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Check if user previously dismissed it
      const hasDismissed = localStorage.getItem('invovo_erp_pwa_dismissed');
      if (!hasDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [user]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('invovo_erp_pwa_dismissed', 'true');
  };

  if (!showBanner || !user) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-900 to-slate-900 border-b border-emerald-500/30 px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between flex-wrap gap-4 max-w-7xl mx-auto">
        <div className="flex flex-1 items-center gap-3">
          <span className="flex p-2 rounded-lg bg-emerald-500/20">
            <Download className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-white truncate">
            <span className="md:hidden">Install Invovo ERP for faster access.</span>
            <span className="hidden md:inline">Install Invovo ERP on your device for a faster, app-like experience.</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 transition-colors"
          >
            Install App
          </button>
          <button 
            type="button" 
            onClick={handleDismiss}
            className="-m-1.5 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span className="sr-only">Dismiss</span>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
