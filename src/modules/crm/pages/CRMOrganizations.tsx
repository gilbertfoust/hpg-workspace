import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCRMOrganizations } from "@/hooks/useCRMOrganizations";
import { CRM_ORG_TYPES } from "@/modules/crm/types";
import { Plus, Search, Building2, Globe, Mail } from "lucide-react";

export default function CRMOrganizations() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { data: orgs, isLoading, create } = useCRMOrganizations({ search: search || undefined, org_type: typeFilter || undefined });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", org_type: "donor", email: "", phone: "", website: "", city: "", country: "", description: "" });

  const handleCreate = () => {
    if (!form.name) return;
    create.mutate(
      { name: form.name, org_type: form.org_type, email: form.email || undefined, phone: form.phone || undefined, website: form.website || undefined, city: form.city || undefined, country: form.country || undefined, description: form.description || undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ name: "", org_type: "donor", email: "", phone: "", website: "", city: "", country: "", description: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Organizations</h1>
            <p className="text-muted-foreground">Manage donors, partners, vendors, and funders</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Organization</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Organization</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.org_type} onValueChange={v => setForm(f => ({ ...f, org_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CRM_ORG_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                </div>
                <div><Label>Website</Label><Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                  <div><Label>Country</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.name || create.isPending} className="w-full">Create Organization</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search organizations..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {CRM_ORG_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : !orgs?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No organizations found</TableCell></TableRow>
                ) : orgs.map(org => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{org.name}</p>
                          {org.website && <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />{org.website}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{org.org_type}</Badge></TableCell>
                    <TableCell>{org.email && <span className="flex items-center gap-1 text-sm"><Mail className="h-3 w-3" />{org.email}</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{[org.city, org.country].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell><Badge variant={org.is_active ? "default" : "secondary"}>{org.is_active ? "Active" : "Inactive"}</Badge></TableCell>
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
