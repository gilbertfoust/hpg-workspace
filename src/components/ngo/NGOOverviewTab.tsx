import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  MapPin, 
  Globe, 
  Users, 
  Edit2,
  FileText,
  Clock,
  AlertTriangle,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { NGO } from "@/hooks/useNGOs";
import { useContacts } from "@/hooks/useContacts";
import { useWorkItems } from "@/hooks/useWorkItems";
import { useProfile } from "@/hooks/useProfiles";
import { ContactCard } from "./ContactCard";

interface NGOOverviewTabProps {
  ngo: NGO;
  onEdit: () => void;
  onGenerateFromTemplate?: () => void;
  onMonthlyCheckIn?: () => void;
  onRequestDocument?: () => void;
}

const fiscalTypeLabels: Record<string, string> = {
  model_a: "Model A",
  model_c: "Model C",
  other: "Other",
};

const statusLabels: Record<string, string> = {
  prospect: "Prospect",
  onboarding: "Onboarding",
  active: "Active",
  at_risk: "At Risk",
  offboarding: "Offboarding",
  closed: "Closed",
};

export function NGOOverviewTab({ ngo, onEdit, onGenerateFromTemplate, onMonthlyCheckIn, onRequestDocument }: NGOOverviewTabProps) {
  const { data: contacts } = useContacts(ngo.id);
  const { data: workItems } = useWorkItems({ ngo_id: ngo.id });
  const { data: coordinator } = useProfile(ngo.ngo_coordinator_user_id || "");
  const { data: adminPm } = useProfile(ngo.admin_pm_user_id || "");

  const primaryContact = contacts?.find(c => c.is_primary) || contacts?.[0];
  const activeStatuses = ['not_started', 'in_progress', 'waiting_on_ngo', 'waiting_on_hpg', 'submitted', 'under_review'];
  const openItems = workItems?.filter(wi => wi.status && !['complete', 'canceled'].includes(wi.status)).length || 0;
  const overdueItems = workItems?.filter(wi => 
    wi.due_date && new Date(wi.due_date) < new Date() && 
    wi.status && !['complete', 'canceled'].includes(wi.status)
  ).length || 0;
  const missingEvidenceItems = workItems?.filter(wi => 
    wi.evidence_required && wi.evidence_status !== 'approved' &&
    wi.status && activeStatuses.includes(wi.status)
  ).length || 0;

  const location = [ngo.city, ngo.state_province, ngo.country].filter(Boolean).join(", ");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content - Left Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Organization Details Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Organization Details</CardTitle>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Legal Name</p>
                <p className="font-medium">{ngo.legal_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Common Name</p>
                <p className="font-medium">{ngo.common_name || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Bundle</p>
                <p className="font-medium">{ngo.bundle || "Unassigned"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Fiscal Type</p>
                <p className="font-medium">{ngo.fiscal_type ? fiscalTypeLabels[ngo.fiscal_type] || ngo.fiscal_type : "—"}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{location || "No location set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Website</p>
                  {ngo.website ? (
                    <a 
                      href={ngo.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {ngo.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <p className="font-medium text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            </div>

            {ngo.notes && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{ngo.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Primary Contact Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Primary Contact</CardTitle>
          </CardHeader>
          <CardContent>
            {primaryContact ? (
              <ContactCard contact={primaryContact} />
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No primary contact set</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Add Contact
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Staff Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Assigned Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">NGO Coordinator</p>
                {coordinator ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {coordinator.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{coordinator.full_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{coordinator.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not assigned</p>
                )}
              </div>
              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Admin PM</p>
                {adminPm ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {adminPm.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{adminPm.full_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{adminPm.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not assigned</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar - Right Column */}
      <div className="space-y-6">
        {/* Status Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-sm">
                {ngo.status ? statusLabels[ngo.status] || ngo.status : "Unknown"}
              </Badge>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                Change
              </Button>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(ngo.created_at), "MMM d, yyyy")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last updated</span>
                <span>{format(new Date(ngo.updated_at), "MMM d, yyyy")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Key Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Open Work Items</span>
              </div>
              <span className="font-semibold">{openItems}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Overdue Items</span>
              </div>
              <span className="font-semibold">{overdueItems}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Missing Evidence</span>
              </div>
              <span className="font-semibold">{missingEvidenceItems}</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={onGenerateFromTemplate} disabled={!onGenerateFromTemplate}>
              <Zap className="w-4 h-4 mr-2" />
              Generate from Template
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={onMonthlyCheckIn} disabled={!onMonthlyCheckIn}>
              <Clock className="w-4 h-4 mr-2" />
              Monthly Check-in
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={onRequestDocument} disabled={!onRequestDocument}>
              <FileText className="w-4 h-4 mr-2" />
              Request Document
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
