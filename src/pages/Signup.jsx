import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Phone, Lock, UserPlus, AlertCircle, Eye, EyeOff, Store, MapPin } from 'lucide-react';

export default function Signup() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [honeypotValue, setHoneypotValue] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (honeypotValue.trim() !== '') {
      setError('Automation detected / بوٹ بلاک کر دیا گیا ہے!');
      return;
    }

    const cleanedShopName = shopName.trim();
    const cleanedCity = city.trim();

    if (!cleanedShopName || !cleanedCity) {
      setError('Shop Name and City cannot be blank.');
      return;
    }

    if (!phone || phone.length < 10) {
      setError('Mobile Number must be valid.');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits long.');
      return;
    }

    setLoading(true);
    const fakeEmail = `${phone}@InvovoERP.com`;
    const fakePassword = `${pin}-InvovoERP2026`;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: fakePassword,
      });

      if (authError) throw authError;

      // Automatically create the shop right after signup!
      const { error: rpcError } = await supabase.rpc('create_new_shop', {
        p_shop_name: cleanedShopName,
        p_city: cleanedCity
      });

      if (rpcError) throw rpcError;

      // Safely map the phone number to the new shop
      if (authData?.user) {
        const { data: memberData } = await supabase
          .from('shop_members')
          .select('shop_id')
          .eq('user_id', authData.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (memberData?.shop_id) {
          await supabase
            .from('shops')
            .update({ phone: phone, whatsapp_number: phone })
            .eq('id', memberData.shop_id);
        }
      }

      // Log the user out so they can log back in with their new credentials
      await supabase.auth.signOut();
      
      // Navigate to login screen
      window.location.href = '/login';
    } catch (err) {
      console.error("Signup Error:", err);
      let errorMessage = 'Failed to create account.';
      if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === 'object') {
        errorMessage = JSON.stringify(err);
        if (errorMessage === '{}') errorMessage = 'Network or server error occurred.';
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      if (errorMessage.toLowerCase().includes('already registered') || errorMessage.toLowerCase().includes('already exists')) {
        errorMessage = 'Yeh Mobile Number pehle se registered hai. Barae meharbani "Log in" karein.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-500/20 p-4 rounded-full border border-indigo-500/30">
            <UserPlus className="w-8 h-8 text-indigo-400" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center text-white mb-2">Create Account</h2>
        <p className="text-center text-emerald-400 font-medium mb-1">Pehli dafa aaye hain?</p>
        <p className="text-center text-slate-300 text-sm mb-8 px-4">Naya account banane ke liye apna mobile number, 4-hinson ka asan PIN aur dukan ki maloomat darj karein.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-5">
          <div className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden" aria-hidden="true">
            <input
              type="text"
              name="system_username_verification"
              value={honeypotValue}
              onChange={(e) => setHoneypotValue(e.target.value)}
              tabIndex="-1"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Dukan Ka Naam (Shop Name)</label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="Mian Traders"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Shehar (City)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="Lahore"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mobile Number (0300...)</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="03001234567"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Secret PIN (4 Digits)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="1234"
              />
              <button 
                type="button" 
                onClick={() => setShowPin(!showPin)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-8 text-center text-base text-slate-400">
          Pehle se account hai?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 text-lg font-black tracking-wide transition-colors inline-block ml-2 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/30">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
