import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCRMOrganizations } from "@/hooks/useCRMOrganizations";
import { useCRMContacts } from "@/hooks/useCRMContacts";
import { useCRMDeals } from "@/hooks/useCRMDeals";
import { useCRMInteractions } from "@/hooks/useCRMInteractions";
import { Building2, Users, Handshake, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DEAL_STAGES } from "@/modules/crm/types";
import { Badge } from "@/components/ui/badge";

export default function CRMDashboard() {
  const navigate = useNavigate();
  const { data: orgs } = useCRMOrganizations();
  const { data: contacts } = useCRMContacts();
  const { data: deals } = useCRMDeals();
  const { data: interactions } = useCRMInteractions();

  const pipelineValue = deals?.filter(d => !["won", "lost", "closed"].includes(d.stage)).reduce((s, d) => s + (d.amount ?? 0), 0) ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-muted-foreground">Manage donors, partners, vendors, and relationships</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm/organizations")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{orgs?.length ?? 0}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm/contacts")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{contacts?.length ?? 0}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm/pipeline")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <Handshake className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">${pipelineValue.toLocaleString()}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/crm/interactions")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Interactions</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{interactions?.length ?? 0}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Deal Pipeline</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {DEAL_STAGES.map(stage => {
                const count = deals?.filter(d => d.stage === stage).length ?? 0;
                return <Badge key={stage} variant={count > 0 ? "default" : "outline"} className="text-xs">{stage} ({count})</Badge>;
              })}
            </div>
          </CardContent>
        </Card>

        {interactions && interactions.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {interactions.slice(0, 5).map(i => (
                  <div key={i.id} className="flex items-start gap-3 text-sm">
                    <Badge variant="outline" className="text-xs shrink-0">{i.interaction_type}</Badge>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{i.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {(i as any).crm_organizations?.name && <span>{(i as any).crm_organizations.name} · </span>}
                        {new Date(i.interaction_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
