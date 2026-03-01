import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCRMInteractions } from "@/hooks/useCRMInteractions";
import { useCRMOrganizations } from "@/hooks/useCRMOrganizations";
import { useCRMContacts } from "@/hooks/useCRMContacts";
import { useAuth } from "@/contexts/AuthContext";
import { INTERACTION_TYPES } from "@/modules/crm/types";
import { Plus, MessageSquare } from "lucide-react";
import { format } from "date-fns";

export default function CRMInteractions() {
  const { data: interactions, isLoading, create } = useCRMInteractions();
  const { data: orgs } = useCRMOrganizations();
  const { data: contacts } = useCRMContacts();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", interaction_type: "note", organization_id: "", contact_id: "", description: "" });

  const handleCreate = () => {
    if (!form.subject) return;
    create.mutate(
      { subject: form.subject, interaction_type: form.interaction_type, organization_id: form.organization_id || undefined, contact_id: form.contact_id || undefined, description: form.description || undefined, logged_by_user_id: user?.id },
      { onSuccess: () => { setDialogOpen(false); setForm({ subject: "", interaction_type: "note", organization_id: "", contact_id: "", description: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Interactions</h1>
            <p className="text-muted-foreground">Activity log and communication history</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Log Interaction</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log Interaction</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.interaction_type} onValueChange={v => setForm(f => ({ ...f, interaction_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INTERACTION_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Organization</Label>
                  <Select value={form.organization_id} onValueChange={v => setForm(f => ({ ...f, organization_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                    <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contact</Label>
                  <Select value={form.contact_id} onValueChange={v => setForm(f => ({ ...f, contact_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                    <SelectContent>{contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.subject || create.isPending} className="w-full">Log Interaction</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Logged By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : !interactions?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No interactions logged</TableCell></TableRow>
                ) : interactions.map(i => (
                  <TableRow key={i.id}>
                    <TableCell><Badge variant="outline" className="text-xs">{i.interaction_type}</Badge></TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{i.subject}</p>
                        {i.description && <p className="text-xs text-muted-foreground line-clamp-1">{i.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{(i as any).crm_organizations?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{(i as any).crm_contacts ? `${(i as any).crm_contacts.first_name} ${(i as any).crm_contacts.last_name}` : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(i.interaction_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(i as any).profiles?.full_name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
