import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCountryCompliance } from "@/hooks/useCountryCompliance";
import { Plus, Search, Globe, CheckCircle, XCircle } from "lucide-react";

export default function CountryCompliance() {
  const [search, setSearch] = useState("");
  const { data: profiles, isLoading, create } = useCountryCompliance();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ country_code: "", country_name: "", registration_required: false, tax_filing_required: false, annual_audit_required: false, filing_deadline: "", regulatory_body: "", notes: "" });

  const filtered = (profiles ?? []).filter(p =>
    p.country_name.toLowerCase().includes(search.toLowerCase()) ||
    p.country_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.country_code || !form.country_name) return;
    create.mutate(
      { ...form, filing_deadline: form.filing_deadline || undefined, regulatory_body: form.regulatory_body || undefined, notes: form.notes || undefined },
      { onSuccess: () => { setOpen(false); setForm({ country_code: "", country_name: "", registration_required: false, tax_filing_required: false, annual_audit_required: false, filing_deadline: "", regulatory_body: "", notes: "" }); } }
    );
  };

  const BoolIcon = ({ value }: { value: boolean }) => value
    ? <CheckCircle className="h-4 w-4 text-green-600" />
    : <XCircle className="h-4 w-4 text-muted-foreground" />;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="h-6 w-6" />Country Compliance</h1>
            <p className="text-muted-foreground">Compliance requirements by jurisdiction</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Country</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Compliance Profile</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Country Code *</Label><Input value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))} placeholder="US" maxLength={3} /></div>
                  <div><Label>Country Name *</Label><Input value={form.country_name} onChange={e => setForm(f => ({ ...f, country_name: e.target.value }))} placeholder="United States" /></div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={form.registration_required} onCheckedChange={v => setForm(f => ({ ...f, registration_required: !!v }))} />
                    <Label>Registration Required</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={form.tax_filing_required} onCheckedChange={v => setForm(f => ({ ...f, tax_filing_required: !!v }))} />
                    <Label>Tax Filing Required</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={form.annual_audit_required} onCheckedChange={v => setForm(f => ({ ...f, annual_audit_required: !!v }))} />
                    <Label>Annual Audit Required</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Filing Deadline</Label><Input value={form.filing_deadline} onChange={e => setForm(f => ({ ...f, filing_deadline: e.target.value }))} placeholder="e.g. May 15" /></div>
                  <div><Label>Regulatory Body</Label><Input value={form.regulatory_body} onChange={e => setForm(f => ({ ...f, regulatory_body: e.target.value }))} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.country_code || !form.country_name || create.isPending} className="w-full">Create Profile</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search countries..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Tax Filing</TableHead>
                  <TableHead>Annual Audit</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Regulatory Body</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !filtered?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No compliance profiles</TableCell></TableRow>
                ) : filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{p.country_code}</Badge>
                        <span className="font-medium">{p.country_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center"><BoolIcon value={p.registration_required} /></TableCell>
                    <TableCell className="text-center"><BoolIcon value={p.tax_filing_required} /></TableCell>
                    <TableCell className="text-center"><BoolIcon value={p.annual_audit_required} /></TableCell>
                    <TableCell className="text-sm">{p.filing_deadline || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.regulatory_body || "—"}</TableCell>
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
