import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAppUrl } from "@/lib/appUrl";

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
  signOut: () => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  deleteUser: (userId: string) => Promise<{ error: Error | null }>;
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
        emailRedirectTo: getAppUrl("auth/callback"),
        data: {
          full_name: fullName,
        },
      },
    });

    return { error: error ?? null };
  };

  const signOut = async () => {
    if (!supabase) {
      // Nothing to do if we have no backend
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Sign out error:", error);
        return { error: error as Error };
      }

      // Clear local state immediately
      setSession(null);
      setUser(null);
      
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error("An unexpected error occurred during sign out");
      console.error("Sign out error:", error);
      return { error };
    }
  };

  const deleteAccount = async () => {
    if (!supabase) {
      return { error: getSupabaseNotConfiguredError() };
    }

    if (!user) {
      return { error: new Error("No user logged in") };
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke("delete-user", {
        body: { target_user_id: user.id },
      });

      if (fnError) {
        console.error("Delete account error:", fnError);
        return { error: fnError as Error };
      }

      if (data?.error) {
        return { error: new Error(data.error) };
      }

      // Sign out and clear local state
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);

      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error("An unexpected error occurred during account deletion");
      console.error("Delete account error:", error);
      return { error };
    }
  };

  const deleteUser = async (userId: string) => {
    if (!supabase) {
      return { error: getSupabaseNotConfiguredError() };
    }

    if (!user) {
      return { error: new Error("No user logged in") };
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke("delete-user", {
        body: { target_user_id: userId },
      });

      if (fnError) {
        console.error("Delete user error:", fnError);
        return { error: fnError as Error };
      }

      if (data?.error) {
        return { error: new Error(data.error) };
      }

      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error("An unexpected error occurred during user deletion");
      console.error("Delete user error:", error);
      return { error };
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signOut, deleteAccount, deleteUser }}
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
