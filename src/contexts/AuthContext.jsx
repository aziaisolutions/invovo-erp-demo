import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [shopMember, setShopMember] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchShopMember = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('shop_members')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (!error && data) {
        setShopMember(data);
      } else {
        setShopMember(null);
      }
    } catch (err) {
      setShopMember(null);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchShopMember(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        fetchShopMember(session.user.id).finally(() => setLoading(false));
      } else {
        setShopMember(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user,
    shopMember,
    activeShopId: shopMember?.shop_id || null,
    role: shopMember?.role || null,
    signOut: () => supabase.auth.signOut(),
    refreshAuth: async () => {
      if (user) await fetchShopMember(user.id);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
