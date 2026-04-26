import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/data/client';
import type { AppRole } from '@/domain/auth/roles';
import { logAuth } from '@/lib/logger';

type Profile = {
  id: string;
  email: string;
  name: string;
  team_id: string | null;
  qr_token: string;
  is_inside_venue: boolean | null;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<{ error: Error | null }>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadFor(uid: string) {
    const [profileRes, roleRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, name, team_id, qr_token, is_inside_venue')
        .eq('id', uid)
        .single(),
      supabase.from('user_roles').select('role').eq('user_id', uid).single(),
    ]);
    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (roleRes.data) setRole(roleRes.data.role as AppRole);
  }

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadFor(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      if (next?.user) {
        setTimeout(() => loadFor(next.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    user,
    session,
    profile,
    role,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Best-effort: the snapshot trigger fills user_id from auth.uid() if a
        // session exists; otherwise the row goes in anonymously with email
        // metadata so failed attempts are still attributable.
        logAuth('sign_in_failed', { email, error: error.message });
      } else {
        logAuth('sign_in', { email });
      }
      return { error: error as Error | null };
    },
    async signOut() {
      logAuth('sign_out');
      // Flush before the auth context tears down — best-effort. If the page
      // navigates away immediately the visibilitychange handler also fires.
      await supabase.auth.signOut();
    },
    async refresh() {
      if (user) await loadFor(user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
