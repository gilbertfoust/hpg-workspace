import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Settings, Shield, Users, Wrench } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { isSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import OrgUnitsManager from '@/components/admin-config/OrgUnitsManager';
import BundlesManager from '@/components/admin-config/BundlesManager';
import TemplatesManager from '@/components/admin-config/TemplatesManager';
import UsersManager from '@/components/admin-config/UsersManager';
import PendingApprovalsPanel from '@/components/admin-config/PendingApprovalsPanel';
import ConfigCheckPanel from '@/components/admin/ConfigCheckPanel';

export default function AdminConfigHome() {
  const { data: role, isLoading, error } = useUserRole();
  const supabaseUnavailable = !supabase || isSupabaseNotConfiguredError(error);
  const isAdmin = role?.role === 'super_admin' || role?.role === 'admin_pm';

  return (
    <MainLayout
      title="Admin / Config"
      subtitle="Manage users, departments, bundles, templates, and system settings"
    >
      {supabaseUnavailable ? (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Admin / Config unavailable</AlertTitle>
          <AlertDescription>
            Admin / Config center is unavailable because the backend is not configured in this
            environment.
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Checking access...</p>
      ) : !isAdmin ? (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>Access denied.</AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="org-units" className="gap-2">
              <Settings className="h-4 w-4" />
              Departments & Sub-Departments
            </TabsTrigger>
            <TabsTrigger value="bundles" className="gap-2">
              <Settings className="h-4 w-4" />
              Bundles
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Settings className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Wrench className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <PendingApprovalsPanel />
            <UsersManager />
          </TabsContent>
          <TabsContent value="org-units">
            <OrgUnitsManager />
          </TabsContent>
          <TabsContent value="bundles">
            <BundlesManager />
          </TabsContent>
          <TabsContent value="templates">
            <TemplatesManager />
          </TabsContent>
          <TabsContent value="system">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ConfigCheckPanel />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </MainLayout>
  );
}
