import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isNgoPortalRole, isStaffWorkspaceRole, useUserRole } from '@/hooks/useUserRole';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { GlobalAtmosphereBackground } from "@/components/background/GlobalAtmosphereBackground";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedAudience?: 'staff' | 'ngo' | 'any';
}

const ProtectedRoute = ({ children, allowedAudience = 'any' }: ProtectedRouteProps) => {
  const { user, loading, signOut } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const location = useLocation();

  const { data: approvalStatus, isLoading: approvalLoading } = useQuery({
    queryKey: ['approval-status', user?.id],
    queryFn: async () => {
      if (!supabase || !user) return { is_approved: true };
      const { data } = await supabase
        .from('profiles')
        .select('is_approved, approval_status')
        .eq('id', user.id)
        .maybeSingle();
      return data || { is_approved: true };
    },
    enabled: !!user && !!supabase,
  });

  if (loading || roleLoading || approvalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (approvalStatus && !approvalStatus.is_approved) {
    signOut();
    return <Navigate to="/auth" replace />;
  }

  const userRole = role?.role || null;
  const isNgoUser = isNgoPortalRole(userRole);
  const isStaffUser = isStaffWorkspaceRole(userRole);
  const isPortalRoute = location.pathname.startsWith('/portal');

  if (isNgoUser && !isPortalRoute) {
    return <Navigate to="/portal" replace />;
  }

  if (allowedAudience === 'ngo' && !isNgoUser) {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedAudience === 'staff' && !isStaffUser) {
    return <Navigate to={isNgoUser ? "/portal" : "/auth"} replace />;
  }

  if (!isNgoUser && isPortalRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <GlobalAtmosphereBackground />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default ProtectedRoute;
