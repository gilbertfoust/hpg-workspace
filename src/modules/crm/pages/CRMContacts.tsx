import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCRMContacts } from "@/hooks/useCRMContacts";
import { useCRMOrganizations } from "@/hooks/useCRMOrganizations";
import { Plus, Search, User, Mail, Phone } from "lucide-react";

export default function CRMContacts() {
  const [search, setSearch] = useState("");
  const { data: contacts, isLoading, create } = useCRMContacts({ search: search || undefined });
  const { data: orgs } = useCRMOrganizations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", organization_id: "", email: "", phone: "", title: "", notes: "" });

  const handleCreate = () => {
    if (!form.first_name || !form.last_name) return;
    create.mutate(
      { first_name: form.first_name, last_name: form.last_name, organization_id: form.organization_id || undefined, email: form.email || undefined, phone: form.phone || undefined, title: form.title || undefined, notes: form.notes || undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ first_name: "", last_name: "", organization_id: "", email: "", phone: "", title: "", notes: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contacts</h1>
            <p className="text-muted-foreground">People at donor, partner, and vendor organizations</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Contact</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                  <div><Label>Last Name *</Label><Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                </div>
                <div>
                  <Label>Organization</Label>
                  <Select value={form.organization_id} onValueChange={v => setForm(f => ({ ...f, organization_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                    <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                </div>
                <div><Label>Title / Role</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.first_name || !form.last_name || create.isPending} className="w-full">Create Contact</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Title</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : !contacts?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No contacts found</TableCell></TableRow>
                ) : contacts.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{c.first_name} {c.last_name}</span>
                        {c.is_primary && <Badge variant="default" className="text-xs">Primary</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{(c as any).crm_organizations?.name ?? "—"}</TableCell>
                    <TableCell>{c.email && <span className="flex items-center gap-1 text-sm"><Mail className="h-3 w-3" />{c.email}</span>}</TableCell>
                    <TableCell>{c.phone && <span className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{c.phone}</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.title ?? "—"}</TableCell>
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
