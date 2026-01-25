import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from the URL hash/fragment
        const { data: { session }, error: sessionError } = await supabase?.auth.getSession() ?? { data: { session: null }, error: null };

        if (sessionError) {
          setError(sessionError.message);
          // Redirect to auth page after a delay
          setTimeout(() => {
            const base = import.meta.env.BASE_URL || "/";
            navigate(`${base}auth`);
          }, 3000);
          return;
        }

        if (session) {
          // Successfully authenticated, redirect to dashboard
          const base = import.meta.env.BASE_URL || "/";
          navigate(`${base}dashboard`, { replace: true });
        } else {
          // No session found, redirect to auth page
          const base = import.meta.env.BASE_URL || "/";
          navigate(`${base}auth`, { replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        const base = import.meta.env.BASE_URL || "/";
        setTimeout(() => {
          navigate(`${base}auth`);
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <p className="text-destructive font-medium">Authentication Error</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">Redirecting to login...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
