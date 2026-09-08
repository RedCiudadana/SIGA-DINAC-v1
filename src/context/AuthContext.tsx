import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile, Permission, SecuritySettings } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  permissions: string[];
  securitySettings: SecuritySettings | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  logAction: (actionType: string, module: string, description: string, affectedRecord?: string, result?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*, role:roles(*)')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      setProfile(null);
      return null;
    }

    if (!data) {
      setProfile(null);
      return null;
    }

    const profileData = data as UserProfile & { role: { id: string; code: string; name: string } };
    setProfile(profileData);

    if (profileData.status !== 'active' || !profileData.is_active) {
      await supabase.auth.signOut();
      setProfile(null);
      setSession(null);
      return null;
    }

    if (profileData.access_expires_at && new Date(profileData.access_expires_at) < new Date()) {
      await supabase.auth.signOut();
      setProfile(null);
      setSession(null);
      return null;
    }

    if (profileData.locked_until && new Date(profileData.locked_until) > new Date()) {
      await supabase.auth.signOut();
      setProfile(null);
      setSession(null);
      return null;
    }

    const { data: permData } = await supabase
      .from('role_permissions')
      .select('permission:permissions(code)')
      .eq('role_id', profileData.role_id);

    const permCodes: string[] = [];
    for (const rp of (permData || [])) {
      const p = rp.permission as unknown;
      if (Array.isArray(p) && p.length > 0 && p[0]?.code) {
        permCodes.push(p[0].code as string);
      } else if (p && typeof p === 'object' && 'code' in p) {
        permCodes.push((p as { code: string }).code);
      }
    }
    setPermissions(permCodes);

    return profileData;
  }, []);

  const loadSecuritySettings = useCallback(async () => {
    const { data } = await supabase
      .from('security_settings')
      .select('*')
      .maybeSingle();
    if (data) setSecuritySettings(data as SecuritySettings);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        Promise.all([loadProfile(session.user.id), loadSecuritySettings()]).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        if (session?.user) {
          await Promise.all([loadProfile(session.user.id), loadSecuritySettings()]);
        } else {
          setProfile(null);
          setPermissions([]);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, loadSecuritySettings]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      try {
        await supabase.from('audit_logs').insert({
          action_type: 'login_failed',
          module: 'auth',
          description: `Intento fallido de acceso para ${email}`,
          result: 'failure',
          metadata: { email },
        });
      } catch {
        // ignore audit log failure
      }
      return { error: 'Credenciales incorrectas o cuenta no autorizada' };
    }

    if (data.user) {
      const loadedProfile = await loadProfile(data.user.id);
      if (!loadedProfile) {
        await supabase.auth.signOut();
        return { error: 'Su cuenta no está activa o no tiene permisos para acceder al sistema' };
      }

      await supabase.from('user_profiles')
        .update({
          last_login_at: new Date().toISOString(),
          failed_attempts: 0,
          locked_until: null,
        })
        .eq('user_id', data.user.id);

      try {
        await supabase.from('audit_logs').insert({
          action_type: 'login_success',
          module: 'auth',
          user_id: data.user.id,
          user_email: loadedProfile.email,
          user_role: loadedProfile.role?.code || null,
          user_unit: loadedProfile.organizational_unit,
          description: `Inicio de sesión exitoso: ${loadedProfile.email}`,
          result: 'success',
        });
      } catch {
        // ignore
      }
    }

    return { error: null };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (session?.user && profile) {
      try {
        await supabase.from('audit_logs').insert({
          action_type: 'logout',
          module: 'auth',
          user_id: session.user.id,
          user_email: profile.email,
          user_role: profile.role?.code || null,
          user_unit: profile.organizational_unit,
          description: `Cierre de sesión: ${profile.email}`,
          result: 'success',
        });
      } catch {
        // ignore
      }
    }
    await supabase.auth.signOut();
    setProfile(null);
    setPermissions([]);
    setSession(null);
  }, [session, profile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  }, [session, loadProfile]);

  const hasPermission = useCallback((code: string) => {
    return permissions.includes(code);
  }, [permissions]);

  const logAction = useCallback(async (
    actionType: string,
    module: string,
    description: string,
    affectedRecord?: string,
    result: string = 'success'
  ) => {
    if (!session?.user) return;
    try {
      await supabase.from('audit_logs').insert({
        action_type: actionType,
        module,
        user_id: session.user.id,
        user_email: profile?.email || null,
        user_role: profile?.role?.code || null,
        user_unit: profile?.organizational_unit || null,
        description,
        affected_record: affectedRecord || null,
        result,
      });
    } catch {
      // ignore
    }
  }, [session, profile]);

  const value: AuthContextValue = {
    session,
    profile,
    permissions,
    securitySettings,
    loading,
    signIn,
    signOut,
    refreshProfile,
    hasPermission,
    logAction,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
