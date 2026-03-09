import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLocalizedCOA } from "@/hooks/useLocalizedCOA";
import { useAccounts } from "@/hooks/useAccounts";
import { Plus, Search, Trash2, BookOpen } from "lucide-react";

export default function LocalizedCOA() {
  const [search, setSearch] = useState("");
  const { data: mappings, isLoading, create, remove } = useLocalizedCOA();
  const { data: accounts } = useAccounts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ country_code: "", local_account_code: "", local_account_name: "", standard_account_id: "", mapping_notes: "" });

  const filtered = (mappings ?? []).filter(m =>
    m.local_account_name.toLowerCase().includes(search.toLowerCase()) ||
    m.local_account_code.toLowerCase().includes(search.toLowerCase()) ||
    m.country_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.country_code || !form.local_account_code || !form.local_account_name) return;
    create.mutate(
      { ...form, standard_account_id: form.standard_account_id || undefined, mapping_notes: form.mapping_notes || undefined },
      { onSuccess: () => { setOpen(false); setForm({ country_code: "", local_account_code: "", local_account_name: "", standard_account_id: "", mapping_notes: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" />Localized COA</h1>
            <p className="text-muted-foreground">Map local chart of accounts to standard structure</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Mapping</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New COA Mapping</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Country Code *</Label><Input value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))} placeholder="US" maxLength={3} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Local Code *</Label><Input value={form.local_account_code} onChange={e => setForm(f => ({ ...f, local_account_code: e.target.value }))} placeholder="1000" /></div>
                  <div><Label>Local Name *</Label><Input value={form.local_account_name} onChange={e => setForm(f => ({ ...f, local_account_name: e.target.value }))} placeholder="Cash & Equivalents" /></div>
                </div>
                <div>
                  <Label>Standard Account</Label>
                  <Select value={form.standard_account_id} onValueChange={v => setForm(f => ({ ...f, standard_account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Map to standard account" /></SelectTrigger>
                    <SelectContent>{accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Notes</Label><Input value={form.mapping_notes} onChange={e => setForm(f => ({ ...f, mapping_notes: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.country_code || !form.local_account_code || !form.local_account_name || create.isPending} className="w-full">Create Mapping</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search mappings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Local Code</TableHead>
                  <TableHead>Local Name</TableHead>
                  <TableHead>Standard Account</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !filtered?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No COA mappings</TableCell></TableRow>
                ) : filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell><Badge variant="outline" className="font-mono">{m.country_code}</Badge></TableCell>
                    <TableCell className="font-mono text-sm">{m.local_account_code}</TableCell>
                    <TableCell className="font-medium">{m.local_account_name}</TableCell>
                    <TableCell className="text-sm">{m.accounts ? `${m.accounts.code} — ${m.accounts.name}` : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.mapping_notes || "—"}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => remove.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
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
