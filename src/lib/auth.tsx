import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  department: string | null;
  disabled?: boolean | null;
};

export type ClientRecord = {
  id: string;
  name: string;
  company: string | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isClient: boolean;
  clientRecord: ClientRecord | null;
  userRole: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const fetchUserRole = async (userId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  
  if (error) {
    console.error('Role fetch error (Database):', error)
    return `member (error: ${error.message})`
  }

  if (!data) {
    console.warn('Role fetch: No row found for user ID:', userId)
    return 'member (not found)'
  }
  
  return data.role
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [clientRecord, setClientRecord] = useState<ClientRecord | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    try {
      const [role, { data: p }, { data: clientData }] = await Promise.all([
        fetchUserRole(userId),
        supabase.from("profiles").select("id,email,full_name,department,disabled").eq("id", userId).maybeSingle(),
        supabase.from("clients").select("id,name,company").eq("user_id" as any, userId).maybeSingle(),
      ]);

      const loadedProfile = p as Profile | null;
      if (loadedProfile?.disabled) {
        await supabase.auth.signOut();
        setProfile(null);
        setUserRole(null);
        setIsAdmin(false);
        setIsClient(false);
        setClientRecord(null);
        return;
      }

      setProfile(loadedProfile);
      setUserRole(role);
      setIsAdmin(role === "admin");
      if (clientData) {
        setIsClient(true);
        setClientRecord(clientData as ClientRecord);
      } else {
        setIsClient(false);
        setClientRecord(null);
      }
    } catch (error) {
      console.error("Error loading profile/role:", error);
      setUserRole('member');
      setIsAdmin(false);
      setIsClient(false);
      setClientRecord(null);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id);
      } else {
        setProfile(null);
        setUserRole(null);
        setIsAdmin(false);
        setIsClient(false);
        setClientRecord(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        await loadProfile(s.user.id);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Session fetch error:", err);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin,
        isClient,
        clientRecord,
        userRole,
        loading,
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
