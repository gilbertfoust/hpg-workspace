import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePolicyRegistry, useCreatePolicy, type PolicyRecord } from "@/hooks/usePolicyRegistry";
import { Plus, Search, ShieldCheck, AlertTriangle } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  draft: "bg-muted text-muted-foreground",
  under_review: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  archived: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

const CATEGORIES = [
  "Governance & Oversight",
  "Financial & Programmatic",
  "Operational Controls",
  "Policy & Staff Resources",
  "HR & Compliance",
  "IT & Security",
  "Legal",
  "General",
];

export default function PolicyRegistryPage() {
  const { data: policies, isLoading } = usePolicyRegistry();
  const createPolicy = useCreatePolicy();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    policy_name: "",
    category: "General",
    owner_name: "",
    description: "",
    status: "active",
    last_review_date: "",
    next_review_date: "",
  });

  const filtered = useMemo(() => {
    if (!policies) return [];
    const q = search.toLowerCase();
    return policies.filter(
      (p) =>
        p.policy_name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.owner_name || "").toLowerCase().includes(q)
    );
  }, [policies, search]);

  const upcomingReviews = useMemo(() => {
    if (!policies) return 0;
    const now = new Date();
    return policies.filter((p) => {
      if (!p.next_review_date) return false;
      const days = differenceInDays(parseISO(p.next_review_date), now);
      return days >= 0 && days <= 30;
    }).length;
  }, [policies]);

  const handleCreate = () => {
    createPolicy.mutate(
      {
        policy_name: form.policy_name,
        category: form.category,
        owner_name: form.owner_name || null,
        description: form.description || null,
        document_path: null,
        status: form.status,
        last_review_date: form.last_review_date || null,
        next_review_date: form.next_review_date || null,
        notes: null,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setForm({ policy_name: "", category: "General", owner_name: "", description: "", status: "active", last_review_date: "", next_review_date: "" });
        },
      }
    );
  };

  return (
    <MainLayout title="Policy Registry" subtitle="Organizational policies, review schedules, and compliance tracking">
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Total Policies</p>
              <p className="text-2xl font-semibold">{policies?.length ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Active</p>
              <p className="text-2xl font-semibold">{policies?.filter((p) => p.status === "active").length ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className={upcomingReviews > 0 ? "border-amber-500/40" : ""}>
            <CardContent className="p-4 flex items-center gap-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Reviews Due (30 days)</p>
                <p className="text-2xl font-semibold">{upcomingReviews}</p>
              </div>
              {upcomingReviews > 0 && <AlertTriangle className="w-5 h-5 text-amber-500 ml-auto" />}
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search policies..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Policy</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Policy</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Policy Name *</Label><Input value={form.policy_name} onChange={(e) => setForm({ ...form, policy_name: e.target.value })} /></div>
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Owner</Label><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="under_review">Under Review</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Next Review Date</Label><Input type="date" value={form.next_review_date} onChange={(e) => setForm({ ...form, next_review_date: e.target.value })} /></div>
                </div>
                <Button onClick={handleCreate} disabled={!form.policy_name || createPolicy.isPending} className="w-full">
                  {createPolicy.isPending ? "Creating..." : "Create Policy"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No policies found</TableCell></TableRow>
                  ) : (
                    filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.policy_name}</TableCell>
                        <TableCell>{p.category}</TableCell>
                        <TableCell>{p.owner_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[p.status] || ""}>
                            {p.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {p.next_review_date ? format(parseISO(p.next_review_date), "MMM d, yyyy") : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
