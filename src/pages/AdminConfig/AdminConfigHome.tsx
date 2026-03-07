import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Settings, Shield } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { isSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import OrgUnitsManager from '@/components/admin-config/OrgUnitsManager';
import BundlesManager from '@/components/admin-config/BundlesManager';
import TemplatesManager from '@/components/admin-config/TemplatesManager';

export default function AdminConfigHome() {
  const { data: role, isLoading, error } = useUserRole();
  const supabaseUnavailable = !supabase || isSupabaseNotConfiguredError(error);
  const isAdmin = role?.role === 'super_admin' || role?.role === 'admin_pm';

  return (
    <MainLayout
      title="Admin / Config"
      subtitle="Manage departments, bundles, and templates"
    >
      {supabaseUnavailable ? (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Admin / Config unavailable</AlertTitle>
          <AlertDescription>
            Admin / Config center is unavailable because Supabase is not configured in this
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
        <Tabs defaultValue="org-units" className="space-y-6">
          <TabsList>
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
          </TabsList>

          <TabsContent value="org-units">
            <OrgUnitsManager />
          </TabsContent>
          <TabsContent value="bundles">
            <BundlesManager />
          </TabsContent>
          <TabsContent value="templates">
            <TemplatesManager />
          </TabsContent>
        </Tabs>
      )}
    </MainLayout>
  );
}
