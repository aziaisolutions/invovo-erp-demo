import React, { useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../hooks/useRole';
import { 
  LayoutDashboard, 
  Package, 
  Receipt, 
  FileText, 
  Settings as SettingsIcon, 
  LogOut, 
  Store,
  Users,
  Truck,
  LineChart,
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';
import InstallBanner from './InstallBanner';
import SubscriptionGuardLayout from './SubscriptionGuardLayout';

export default function Layout() {
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  const currentShopId = user?.user_metadata?.shop_id || user?.shop_id;

  const [darkMode, setDarkMode] = React.useState(() => document.documentElement.classList.contains('dark') || true);

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [darkMode]);

  const toggleThemeMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      setDarkMode(true);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Locked Production Navigation Links (Always English Standard)
  const navLinks = useMemo(() => {
    return [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Inventory (Maal Setup)', path: '/inventory', icon: Package },
      { name: 'Customers (Gāhak Khata)', path: '/customers', icon: Users },
      { name: 'Suppliers (Beopari Khata)', path: '/suppliers', icon: Truck },
      { name: 'Invoices & Billing', path: '/invoices', icon: FileText },
      ...(role === 'shop_owner' || role === 'super_admin' ? [{ name: 'Reports (Asan Munafa)', path: '/reports', icon: LineChart }] : []),
      ...(role === 'super_admin' ? [{ name: 'Admin Panel', path: '/admin', icon: ShieldCheck }] : []),
      { name: 'Settings', path: '/settings', icon: SettingsIcon },
    ];
  }, [role]);

  const getInitials = (email) => {
    if (!email) return 'SH';
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <SubscriptionGuardLayout shopId={currentShopId} isUrdu={false}>
      <div className={`min-h-screen ${darkMode ? 'dark bg-[#0b1329] text-slate-100' : 'bg-[#f4f6fa] text-[#1e293b]'} flex flex-col md:flex-row font-sans transition-colors duration-300 text-left`}>
        
        {/* 1. Desktop Sidebar */}
        <aside className={`hidden md:flex flex-col w-64 ${darkMode ? 'bg-[#11192e] border-slate-800' : 'bg-white border-slate-200'} border-r fixed h-full z-40 left-0 transition-all duration-300 shadow-xl`}>
          <div className="p-5 flex flex-col h-full overflow-y-auto">
            
            {/* Main Application Identity Logo Header */}
            <div className="flex items-center gap-3 mb-8 px-2">
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md shadow-indigo-600/20">
                <Store className="w-5 h-5" />
              </div>
              <span className={`text-lg font-black tracking-tight ${darkMode ? 'bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent' : 'text-slate-900'}`}>
                Invovo ERP
              </span>
            </div>

            {/* Navigation Element Stack Wrapper */}
            <nav className="space-y-1 flex-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-500' 
                        : `${darkMode ? 'text-slate-400 hover:text-white border-transparent hover:bg-slate-800/40' : 'text-slate-700 hover:text-indigo-600 border-transparent hover:bg-slate-100'}`
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
                    <span className="flex-1 text-left flex flex-col leading-tight">
                      <span className="font-black">{link.name.split(' (')[0]}</span>
                      {link.name.includes(' (') && (
                        <span className={`text-[10px] font-medium mt-0.5 ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                          ({link.name.split(' (')[1]}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* 👑 Invovo SUPPORT BANNER WITH FIXED MOBILE NUMBER */}
            <div className="mt-auto pt-4 no-print">
              <div className={`border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'} p-3.5 rounded-2xl shadow-sm relative overflow-hidden group transition-all`}>
                <div className="space-y-1.5 relative z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">🚀</span>
                    <h4 className={`text-xs font-black tracking-wide ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Invovo Support</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Developed & Managed by <span className="text-indigo-600 dark:text-indigo-400 font-bold">Invovo</span>. Need help?
                  </p>
                  <a 
                    href="https://wa.me/18000000000" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[11px] transition-all shadow-sm cursor-pointer text-center block"
                  >
                    <span>💬 WhatsApp: +1-800-INVOVO</span>
                  </a>
                </div>
              </div>
            </div>

          </div>
        </aside>

        {/* 2. Main Content Area Wrapper */}
        <div className="flex-1 flex flex-col pb-24 md:pb-0 md:ms-64 md:me-0">
          
          {/* Top Sticky Dashboard Navigation Header Row */}
          <header className={`${darkMode ? 'bg-[#11192e] border-slate-800' : 'bg-white border-slate-200'} border-b sticky top-0 z-30 h-16 flex items-center justify-between px-6 transition-colors duration-300 print:hidden shadow-sm`}>
            
            {/* Mobile View Title */}
            <div className="md:hidden flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-md shadow-indigo-600/10">
                <Store className="w-4 h-4" />
              </div>
              <span className={`font-black text-sm tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>Invovo ERP</span>
            </div>

            <div className="hidden md:block"></div>

            {/* Profile Action Items Controls Header Section */}
            <div className="flex items-center gap-3">
              
              {/* Ultra Smooth Design Toggle Light/Dark Button Element */}
              <button 
                type="button" 
                onClick={toggleThemeMode} 
                className={`p-2 rounded-xl border transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 ${
                  darkMode 
                    ? 'text-amber-400 bg-slate-800/80 border-slate-700 hover:bg-slate-800' 
                    : 'text-indigo-600 bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span className={darkMode ? 'text-slate-200' : 'text-slate-700'}>{darkMode ? 'Light' : 'Dark'}</span>
              </button>

              {/* Identity Dynamic User Initials Avatar Icon Layout */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-md border border-white/10">
                {getInitials(user?.email)}
              </div>

              {/* Secure Log Out System Handle Action Component */}
              <button 
                type="button"
                onClick={handleSignOut}
                className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold border border-transparent ${
                  darkMode ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-600 hover:text-red-600 hover:bg-red-50/60'
                }`}
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </div>
          </header>

          <InstallBanner />

          {/* Core Content Shell Layout with Strict Light/Dark Global Dynamic Visibility Typography Text Selection */}
          <main className={`p-4 md:p-8 w-full max-w-7xl mx-auto flex-1 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            <Outlet />
          </main>
        </div>

        {/* 3. Mobile Navigation Bottom Tab Bar UI Layer */}
        <nav className={`md:hidden fixed bottom-0 w-full ${darkMode ? 'bg-[#11192e]/95 border-slate-800' : 'bg-white/95 border-slate-200'} backdrop-blur-xl border-t z-40 pb-safe overflow-x-auto scrolling-touch print:hidden shadow-2xl`}>
          <div className="flex items-center justify-start min-w-max gap-1 px-4 py-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex flex-col items-center gap-0.5 p-1.5 min-w-[72px] rounded-xl transition-all ${
                    isActive 
                      ? 'text-indigo-600 dark:text-indigo-400 font-black' 
                      : `${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-600 hover:text-slate-900'}`
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                  <span className="text-[10px] font-bold tracking-tight text-center flex flex-col leading-tight mt-0.5">
                    <span>{link.name.split(' (')[0]}</span>
                    {link.name.includes(' (') && (
                      <span className={`text-[8px] font-medium opacity-70 mt-px`}>
                        ({link.name.split(' (')[1]}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

      </div>
    </SubscriptionGuardLayout>
  );
}