import { useState } from "react";
import { Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import CreateUserDialog from "@/components/admin/CreateUserDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, ShieldCheck, Users } from "lucide-react";
import { canManageNgoPortalAccounts } from "@/lib/accessControl";
import { useUserRole } from "@/hooks/useUserRole";
import { useNgoPortalMemberships, useSetNgoPortalMembership } from "@/hooks/useNgoPortalMemberships";

const accessLabels = {
  viewer: "Viewer",
  preparer: "Accounting preparer",
  approver: "Quarterly approver",
  ngo_admin: "NGO administrator",
} as const;

export default function NgoAccessAdminPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const { data: memberships = [], isLoading } = useNgoPortalMemberships();
  const setMembership = useSetNgoPortalMembership();

  if (roleLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (!canManageNgoPortalAccounts(userRole?.role, userRole)) return <Navigate to="/dashboard" replace />;

  return (
    <MainLayout
      title="NGO Portal Access"
      subtitle="Create NGO-scoped accounts without exposing HPG's internal workspace or another NGO's records."
      actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Create NGO account</Button>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Portal members</p><p className="mt-1 text-3xl font-semibold">{memberships.length}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Active</p><p className="mt-1 text-3xl font-semibold">{memberships.filter((m) => m.status === "active").length}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Security boundary</p><p className="mt-2 flex items-center gap-2 font-medium"><ShieldCheck className="h-5 w-5 text-emerald-600" />One NGO per membership</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />NGO staff</CardTitle>
            <CardDescription>Accounting rights are separate from HPG department access.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : memberships.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No NGO portal accounts have been assigned yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left"><tr><th className="p-3">Staff member</th><th className="p-3">NGO</th><th className="p-3">Accounting access</th><th className="p-3">Status</th><th className="p-3">Control</th></tr></thead>
                  <tbody>
                    {memberships.map((membership) => (
                      <tr key={membership.id} className="border-t">
                        <td className="p-3"><p className="font-medium">{membership.profiles?.full_name || "Portal user"}</p><p className="text-xs text-muted-foreground">{membership.profiles?.email}</p></td>
                        <td className="p-3">{membership.ngos?.common_name || membership.ngos?.legal_name || "NGO"}</td>
                        <td className="p-3">
                          <Select
                            value={membership.access_level}
                            onValueChange={(value) => setMembership.mutate({ membershipId: membership.id, status: membership.status, accessLevel: value as typeof membership.access_level })}
                          >
                            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(accessLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="p-3"><Badge variant={membership.status === "active" ? "default" : "secondary"}>{membership.status}</Badge></td>
                        <td className="p-3">
                          <Button
                            size="sm"
                            variant={membership.status === "active" ? "outline" : "default"}
                            disabled={setMembership.isPending}
                            onClick={() => setMembership.mutate({ membershipId: membership.id, status: membership.status === "active" ? "suspended" : "active" })}
                          >
                            {membership.status === "active" ? "Suspend" : "Reactivate"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} ngoOnly />
    </MainLayout>
  );
}
