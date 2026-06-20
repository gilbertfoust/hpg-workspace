import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2, Handshake } from "lucide-react";
import {
  usePotentialSponsees,
  useCreatePotentialSponsee,
  useUpdatePotentialSponsee,
  type PotentialSponsee,
  type SponseeOutreachStatus,
} from "@/hooks/usePotentialSponsees";
import { useInternalUsers } from "@/hooks/useProfiles";
import { format } from "date-fns";

const OUTREACH_STATUSES: { value: SponseeOutreachStatus; label: string }[] = [
  { value: "research", label: "Research" },
  { value: "contacted", label: "Contacted" },
  { value: "in_conversation", label: "In conversation" },
  { value: "on_hold", label: "On hold" },
  { value: "declined", label: "Declined" },
  { value: "converted", label: "Converted" },
];

const emptyForm = {
  organization_name: "",
  country: "",
  state_province: "",
  city: "",
  contact_person: "",
  email: "",
  phone: "",
  website: "",
  mission_area: "",
  sponsorship_fit: "",
  outreach_status: "research" as SponseeOutreachStatus,
  next_follow_up_date: "",
  assigned_owner_user_id: "none",
  notes: "",
};

export default function PotentialSponsees() {
  const { data: prospects = [], isLoading } = usePotentialSponsees();
  const createProspect = useCreatePotentialSponsee();
  const updateProspect = useUpdatePotentialSponsee();
  const { data: internalUsers } = useInternalUsers();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PotentialSponsee | null>(null);
  const [form, setForm] = useState(emptyForm);

  const ownerMap = useMemo(() => {
    const map = new Map<string, string>();
    internalUsers?.forEach((user) => {
      map.set(user.id, user.full_name || user.email || "Unknown");
    });
    return map;
  }, [internalUsers]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (prospect: PotentialSponsee) => {
    setEditing(prospect);
    setForm({
      organization_name: prospect.organization_name,
      country: prospect.country || "",
      state_province: prospect.state_province || "",
      city: prospect.city || "",
      contact_person: prospect.contact_person || "",
      email: prospect.email || "",
      phone: prospect.phone || "",
      website: prospect.website || "",
      mission_area: prospect.mission_area || "",
      sponsorship_fit: prospect.sponsorship_fit || "",
      outreach_status: prospect.outreach_status,
      next_follow_up_date: prospect.next_follow_up_date || "",
      assigned_owner_user_id: prospect.assigned_owner_user_id || "none",
      notes: prospect.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.organization_name.trim()) return;

    const payload = {
      organization_name: form.organization_name.trim(),
      country: form.country.trim() || null,
      state_province: form.state_province.trim() || null,
      city: form.city.trim() || null,
      contact_person: form.contact_person.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      mission_area: form.mission_area.trim() || null,
      sponsorship_fit: form.sponsorship_fit.trim() || null,
      outreach_status: form.outreach_status,
      next_follow_up_date: form.next_follow_up_date || null,
      assigned_owner_user_id:
        form.assigned_owner_user_id === "none" ? null : form.assigned_owner_user_id,
      notes: form.notes.trim() || null,
    };

    if (editing) {
      await updateProspect.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createProspect.mutateAsync(payload);
    }

    setDialogOpen(false);
  };

  const isSaving = createProspect.isPending || updateProspect.isPending;

  return (
    <MainLayout
      title="Potential Sponsees"
      subtitle="Organizations HPG may reach out to for fiscal sponsorship"
      actions={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add prospect
        </Button>
      }
    >
      {prospects.length === 0 && !isLoading && (
        <Card className="mb-4">
          <CardContent className="py-6 text-sm text-muted-foreground">
            No prospects yet. Add organizations to track outreach. If saves fail, apply the proposed
            `potential_sponsees` migration in docs/proposed-schemas/user-access-bundle-schemas.md.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Handshake className="w-4 h-4" />
            Outreach pipeline ({prospects.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">Organization</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Mission / fit</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Follow-up</th>
                  <th className="p-3">Owner</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      Loading prospects...
                    </td>
                  </tr>
                ) : prospects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No potential sponsees documented yet.
                    </td>
                  </tr>
                ) : (
                  prospects.map((prospect) => (
                    <tr
                      key={prospect.id}
                      className="border-b hover:bg-muted/40 cursor-pointer"
                      onClick={() => openEdit(prospect)}
                    >
                      <td className="p-3 font-medium">{prospect.organization_name}</td>
                      <td className="p-3 text-muted-foreground">
                        {[prospect.city, prospect.state_province, prospect.country].filter(Boolean).join(", ") ||
                          "—"}
                      </td>
                      <td className="p-3">
                        <div>{prospect.contact_person || "—"}</div>
                        <div className="text-xs text-muted-foreground">{prospect.email || prospect.phone || ""}</div>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[220px] truncate">
                        {prospect.mission_area || prospect.sponsorship_fit || "—"}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="capitalize">
                          {prospect.outreach_status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {prospect.next_follow_up_date
                          ? format(new Date(prospect.next_follow_up_date), "MMM d, yyyy")
                          : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {prospect.assigned_owner_user_id
                          ? ownerMap.get(prospect.assigned_owner_user_id) || "Assigned"
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit prospect" : "Add potential sponsee"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-2 space-y-2">
              <Label>Organization name *</Label>
              <Input
                value={form.organization_name}
                onChange={(e) => setForm((f) => ({ ...f, organization_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>State / province</Label>
              <Input
                value={form.state_province}
                onChange={(e) => setForm((f) => ({ ...f, state_province: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Contact person</Label>
              <Input
                value={form.contact_person}
                onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Mission area</Label>
              <Input
                value={form.mission_area}
                onChange={(e) => setForm((f) => ({ ...f, mission_area: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Sponsorship fit</Label>
              <Input
                value={form.sponsorship_fit}
                onChange={(e) => setForm((f) => ({ ...f, sponsorship_fit: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Outreach status</Label>
              <Select
                value={form.outreach_status}
                onValueChange={(v) => setForm((f) => ({ ...f, outreach_status: v as SponseeOutreachStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTREACH_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next follow-up</Label>
              <Input
                type="date"
                value={form.next_follow_up_date}
                onChange={(e) => setForm((f) => ({ ...f, next_follow_up_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned owner</Label>
              <Select
                value={form.assigned_owner_user_id}
                onValueChange={(v) => setForm((f) => ({ ...f, assigned_owner_user_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {internalUsers?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.organization_name.trim() || isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
