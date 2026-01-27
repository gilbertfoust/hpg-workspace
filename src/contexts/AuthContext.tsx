import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: Error | null }>;
  signInWithGitHub: () => Promise<{ data: { url: string } | null; error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getSupabaseNotConfiguredError = () =>
  new Error(
    "Supabase not configured: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY"
  );

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Supabase is not configured, skip wiring auth
    if (!supabase) {
      console.warn(
        "AuthProvider: Supabase not configured, running in demo / unauthenticated mode."
      );
      setLoading(false);
      return;
    }

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .finally(() => setLoading(false));

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: getSupabaseNotConfiguredError() };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error ?? null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ) => {
    if (!supabase) {
      return { error: getSupabaseNotConfiguredError() };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });

    return { error: error ?? null };
  };

  const signInWithGitHub = async () => {
    if (!supabase) {
      return { data: null, error: getSupabaseNotConfiguredError() };
    }

    // Build redirectTo URL respecting GitHub Pages base path
    const base = import.meta.env.BASE_URL || "/";
    const redirectTo = `${window.location.origin}${base}auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo,
      },
    });

    return { data, error: error ? (error as Error) : null };
  };

  const signOut = async () => {
    if (!supabase) {
      // Nothing to do if we have no backend
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signInWithGitHub, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

