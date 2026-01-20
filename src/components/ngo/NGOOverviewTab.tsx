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
  Mail,
  Phone,
  FileText,
  Clock,
  AlertTriangle
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
}

const fiscalTypeLabels: Record<string, string> = {
  "Model A": "Model A",
  "Model C": "Model C",
  Other: "Other",
};

const statusLabels: Record<string, string> = {
  Prospect: "Prospect",
  Onboarding: "Onboarding",
  Active: "Active",
  "At-Risk": "At Risk",
  Offboarding: "Offboarding",
  Closed: "Closed",
};

export function NGOOverviewTab({ ngo, onEdit }: NGOOverviewTabProps) {
  const { data: contacts } = useContacts(ngo.id);
  const { data: workItems } = useWorkItems({ ngo_id: ngo.id });
  const { data: coordinator } = useProfile(ngo.ngo_coordinator_user_id || "");
  const { data: adminPm } = useProfile(ngo.admin_pm_user_id || "");

  const primaryContact = contacts?.find(c => c.is_primary) || contacts?.[0];
  const totalWorkItems = workItems?.length || 0;
  const overdueItems = workItems?.filter(wi => 
    wi.due_date && new Date(wi.due_date) < new Date() && 
    !['Complete', 'Canceled'].includes(wi.status)
  ).length || 0;
  const pendingItems = workItems?.filter(wi => 
    ['Not Started', 'In Progress', 'Waiting on NGO', 'Waiting on HPG'].includes(wi.status)
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
                <p className="font-medium">{fiscalTypeLabels[ngo.fiscal_type] || ngo.fiscal_type}</p>
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
                {statusLabels[ngo.status] || ngo.status}
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
            <CardTitle className="text-lg font-medium">Work Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Total Items</span>
              </div>
              <span className="font-semibold">{totalWorkItems}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">In Progress</span>
              </div>
              <span className="font-semibold">{pendingItems}</span>
            </div>
            {overdueItems > 0 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-destructive/10">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">Overdue</span>
                </div>
                <span className="font-semibold text-destructive">{overdueItems}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
