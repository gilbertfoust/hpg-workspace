import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQuickStartSeed, type QuickStartSeedAction, type QuickStartSeedResult } from '@/hooks/useQuickStartSeed';
import { useUserRole } from '@/hooks/useUserRole';

const adminRoles = new Set(['super_admin', 'admin_pm', 'executive_secretariat']);

type ActionState = {
  status: 'idle' | 'running' | 'success' | 'error';
  message?: string;
};

const initialState: Record<QuickStartSeedAction, ActionState> = {
  ngos: { status: 'idle' },
  templates: { status: 'idle' },
  'work-items': { status: 'idle' },
};

const formatResultMessage = (result: QuickStartSeedResult) =>
  `Created ${result.created}, skipped ${result.skipped}.`;

const confirmAction = (title: string) =>
  window.confirm(`Are you sure you want to ${title.toLowerCase()}?`);

export default function AdminQuickStart() {
  const { data: role, isLoading } = useUserRole();
  const isAdmin = !!role && adminRoles.has(role.role);
  const { toast } = useToast();
  const { createSampleNgos, createBaseFormTemplates, generateSampleWorkItems } = useQuickStartSeed();
  const [actionState, setActionState] = useState(initialState);

  const runAction = async (
    action: QuickStartSeedAction,
    label: string,
    runner: () => Promise<QuickStartSeedResult>,
  ) => {
    if (!confirmAction(label)) {
      return;
    }

    setActionState((prev) => ({
      ...prev,
      [action]: { status: 'running', message: 'Working...' },
    }));

    try {
      const result = await runner();
      const message = formatResultMessage(result);

      setActionState((prev) => ({
        ...prev,
        [action]: { status: 'success', message },
      }));

      toast({
        title: `${label} complete`,
        description: message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      setActionState((prev) => ({
        ...prev,
        [action]: { status: 'error', message },
      }));

      toast({
        variant: 'destructive',
        title: `${label} failed`,
        description: message,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <MainLayout title="Quick Start / Seed Data" subtitle="Admin-only data seeding tools">
        <Card>
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>This page is only available to admins.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <p>Contact an administrator if you need access to demo data tools.</p>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const renderStatus = (state: ActionState) => {
    if (state.status === 'idle') {
      return <span className="text-sm text-muted-foreground">No actions run yet.</span>;
    }

    if (state.status === 'running') {
      return (
        <span className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {state.message}
        </span>
      );
    }

    if (state.status === 'success') {
      return (
        <span className="text-sm text-success flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {state.message}
        </span>
      );
    }

    return (
      <span className="text-sm text-destructive flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        {state.message}
      </span>
    );
  };

  return (
    <MainLayout
      title="Quick Start / Seed Data"
      subtitle="Generate sample NGOs, templates, and work items for testing and demos"
    >
      <div className="space-y-6">
        <Alert>
          <AlertTitle>Admin-only tools</AlertTitle>
          <AlertDescription>
            Use these actions to bootstrap demo data. Each action is idempotent and will skip records
            that already exist.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Create sample NGOs</CardTitle>
                  <CardDescription>
                    Insert demo NGOs (Detroit, Chicago, Ghana, etc.) with realistic metadata.
                  </CardDescription>
                </div>
                <Badge variant="outline">NGOs</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {renderStatus(actionState.ngos)}
              <Button
                onClick={() => runAction('ngos', 'Create sample NGOs', createSampleNgos)}
                disabled={actionState.ngos.status === 'running'}
              >
                Create sample NGOs
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Create base form templates</CardTitle>
                  <CardDescription>
                    Ensure onboarding, monthly upkeep, compliance, and offboarding templates exist.
                  </CardDescription>
                </div>
                <Badge variant="outline">Templates</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {renderStatus(actionState.templates)}
              <Button
                onClick={() => runAction('templates', 'Create base form templates', createBaseFormTemplates)}
                disabled={actionState.templates.status === 'running'}
              >
                Create base form templates
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generate sample work items</CardTitle>
                  <CardDescription>
                    Create onboarding and monthly upkeep work items with mixed statuses.
                  </CardDescription>
                </div>
                <Badge variant="outline">Work Items</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {renderStatus(actionState['work-items'])}
              <Button
                onClick={() => runAction('work-items', 'Generate sample work items', generateSampleWorkItems)}
                disabled={actionState['work-items'].status === 'running'}
              >
                Generate sample work items
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
