import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, KeyRound } from "lucide-react";

const HPG_LOGO_URL =
  "https://img1.wsimg.com/isteam/ip/8d5502d6-d937-4d80-bd56-8074053e4d77/Humanity%20Pathways%20Global.jpg/:/rs=h:175,m";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if this is a recovery flow from the URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
    setChecking(false);

    // Also listen for PASSWORD_RECOVERY event
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsRecovery(true);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({ variant: "destructive", title: "Password must be at least 8 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords do not match" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase!.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: "Password updated!", description: "You can now log in with your new password." });
      navigate("/auth");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to reset password", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${import.meta.env.BASE_URL}images/hpg-command-center-1.png')` }}
        />
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
        <Card className="w-full max-w-md relative z-10 text-center">
          <CardHeader>
            <CardTitle>Invalid Reset Link</CardTitle>
            <CardDescription>This password reset link is invalid or has expired.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full">Back to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${import.meta.env.BASE_URL}images/hpg-command-center-1.png')` }}
      />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="h-14 w-14 rounded-xl border bg-background/60 flex items-center justify-center overflow-hidden">
              {logoFailed ? (
                <Building2 className="h-6 w-6 text-muted-foreground" />
              ) : (
                <img
                  src={HPG_LOGO_URL}
                  alt="Humanity Pathways Global"
                  className="h-full w-full object-contain p-1"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <KeyRound className="h-5 w-5" /> Set New Password
          </CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
