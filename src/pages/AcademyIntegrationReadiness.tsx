/* External Workspace dependencies must be evidenced, never assumed from an
 * internal draft, channel nickname or a scheduled marketing task.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle,CheckCircle2,PlugZap,ShieldAlert } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole,isAdminRole } from "@/hooks/useUserRole";
import { ensureSupabase } from "@/integrations/supabase/client";
type Dependency={key:string;title:string;count:number;state:string;needed:string};
type IntegrationReport={checked_at:string;checks:Dependency[]};
export default function AcademyIntegrationReadiness(){
  const {user}=useAuth();
  const {data:role,isLoading}=useUserRole();
  const admin=isAdminRole(role?.role);
  const report=useQuery<IntegrationReport>({
    queryKey:["academy-integration-dependencies",user?.id],enabled:!!user?.id&&admin,
    retry:false,queryFn:async()=>{
      const {data,error}=await (ensureSupabase() as any).rpc("get_academy_integration_readiness");
      if(error)throw error;return data as IntegrationReport;
    }
  });
  return <MainLayout title="Academy — Live Integration Readiness"
    subtitle="Evidence-based HPG Workspace workflow dependencies, not simulated provider access.">
    <div className="mx-auto max-w-5xl space-y-4">
      <Card><CardContent className="flex flex-wrap items-start gap-3 p-5">
        <PlugZap className="h-8 w-8 text-primary"/>
        <div className="min-w-64 flex-1">
          <h2 className="font-semibold">Real connection and operational evidence</h2>
          <p className="text-sm text-muted-foreground">A registered social account, an approved internal post, and an actual externally published post are different stages. No access token, publisher credentials, or public release is implied by an HPG training lesson.</p>
        </div>
        <Button size="sm" variant="outline" asChild><Link to="/learning">Return to Academy</Link></Button>
      </CardContent></Card>
      {!isLoading&&!admin&&<Card><CardContent className="p-4 text-sm text-destructive">
        Only authorized Academy administrators can inspect organization-wide integration readiness.
      </CardContent></Card>}
      {report.isLoading&&<p className="text-sm text-muted-foreground">Inspecting current internal workflow evidence…</p>}
      {report.error&&<p role="alert" className="text-sm text-destructive">
        The live dependency report is unavailable; no integration is being marked connected.
      </p>}
      {report.data&&<div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Observed {new Date(report.data.checked_at).toLocaleString()} from authorized database records.
        </p>
        {report.data.checks.map(item=>{
          const good=item.state==="recorded";
          return <Card key={item.key}><CardContent className="flex flex-wrap gap-3 p-4">
            {good?<CheckCircle2 className="mt-1 h-5 w-5 text-primary"/>:
              item.state==="external_connection_required"?<ShieldAlert className="mt-1 h-5 w-5 text-amber-600"/>:
                <AlertCircle className="mt-1 h-5 w-5 text-muted-foreground"/>}
            <div className="min-w-56 flex-1 space-y-1">
              <h3 className="font-semibold">{item.title}</h3>
              <div className="flex gap-2 items-center">
                <Badge variant={good?"secondary":"outline"}>{item.state.replaceAll("_"," ")}</Badge>
                <span className="text-xs text-muted-foreground">{item.count} supporting records</span>
              </div>
              <p className="text-sm text-muted-foreground">{item.needed}</p>
            </div>
          </CardContent></Card>;
        })}
        <Card><CardHeader><CardTitle className="text-lg">Provider onboarding boundary</CardTitle>
          <CardDescription>Planned provider flow, not a live account connection.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>1. Confirm account ownership and the relevant social platform's developer requirements.</p>
            <p>2. Obtain the correct OAuth consent and narrowly scoped publishing permissions through the provider's official process.</p>
            <p>3. Store credentials outside the browser and establish secure renewal/revocation controls.</p>
            <p>4. Validate HPG's exact-package editorial, consent, legal and marketing approvals before transmitting a post.</p>
            <p>5. Record the real provider post ID, public URL, timestamp and independent evidence after a successful release.</p>
            <p className="font-medium">No external post will be issued from this readiness page.</p>
          </CardContent></Card>
      </div>}
    </div>
  </MainLayout>;
}
