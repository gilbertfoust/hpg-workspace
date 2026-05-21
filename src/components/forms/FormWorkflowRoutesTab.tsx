import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BellRing, Save, Settings2 } from "lucide-react";
import { useDepartmentWorkflowRoutes, useUpdateDepartmentWorkflowRoute, type DepartmentWorkflowRoute } from "@/hooks/useDepartmentWorkflowRoutes";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";
import { useToast } from "@/hooks/use-toast";

function parseRecipients(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function RouteEditorCard({ route }: { route: DepartmentWorkflowRoute }) {
  const { toast } = useToast();
  const updateRoute = useUpdateDepartmentWorkflowRoute();
  const [channelLabel, setChannelLabel] = useState(route.slack_channel || "");
  const [recipients, setRecipients] = useState((route.email_recipients || []).join(", "));
  const [isActive, setIsActive] = useState(route.is_active);

  const handleSave = async () => {
    try {
      await updateRoute.mutateAsync({
        id: route.id,
        slack_channel: channelLabel.trim() || null,
        email_recipients: parseRecipients(recipients),
        is_active: isActive,
      });
      toast({ title: "Route updated", description: `${route.department_name} workflow route has been saved.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Route not saved",
        description: error instanceof Error ? error.message : "Unable to update workflow route.",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{route.department_name}</CardTitle>
            <p className="text-sm text-muted-foreground">Module: {route.module}</p>
          </div>
          <Badge variant={isActive ? "default" : "outline"}>{isActive ? "Active" : "Inactive"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Internal channel label</Label>
          <Input value={channelLabel} onChange={(event) => setChannelLabel(event.target.value)} placeholder="#department-channel" />
        </div>
        <div className="space-y-2">
          <Label>Email recipients</Label>
          <Input value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="leader@example.org, team@example.org" />
          <p className="text-xs text-muted-foreground">Separate multiple recipients with commas.</p>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Route active</p>
            <p className="text-xs text-muted-foreground">Inactive routes will not create future workflow event records.</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
        <Button className="w-full" onClick={handleSave} disabled={updateRoute.isPending}>
          <Save className="mr-2 h-4 w-4" /> Save Route
        </Button>
      </CardContent>
    </Card>
  );
}

export function FormWorkflowRoutesTab() {
  const { data: routes = [], isLoading, error } = useDepartmentWorkflowRoutes();

  if (isSupabaseNotConfiguredError(error)) {
    return <SupabaseNotConfiguredNotice />;
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-72" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Settings2 className="h-4 w-4" />
        <AlertTitle>Department workflow routes</AlertTitle>
        <AlertDescription>
          Configure where each department's submitted form workflow events should be routed. These settings prepare internal records; external delivery still requires server-side provider setup.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {routes.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <BellRing className="mx-auto mb-3 h-8 w-8" />
              No workflow routes are configured yet.
            </CardContent>
          </Card>
        ) : (
          routes.map((route) => <RouteEditorCard key={route.id} route={route} />)
        )}
      </div>
    </div>
  );
}
