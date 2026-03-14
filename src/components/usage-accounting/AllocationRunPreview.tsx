import { useState } from "react";
import { useAllocationRuns } from "@/hooks/useAllocationRuns";
import { useAllocationResults } from "@/hooks/useAllocationResults";
import { AllocationResultsTable } from "./AllocationResultsTable";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, CheckCircle, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  preview: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  posted: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-800",
};

export function AllocationRunPreview() {
  const { user } = useAuth();
  const { data: periods = [] } = useFiscalPeriods();
  const { data: runs = [], create, updateStatus } = useAllocationRuns();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [form, setForm] = useState({ fiscal_period_id: "", name: "", status: "draft" as string, notes: "", created_by_user_id: user?.id || null });

  const handleCreate = () => {
    create.mutate(form, { onSuccess: () => { setCreateOpen(false); setForm(f => ({ ...f, name: "", notes: "", fiscal_period_id: "" })); } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Allocation Runs</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Run</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Allocation Run</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Q1 2026 Allocation" /></div>
              <div>
                <Label>Fiscal Period</Label>
                <Select value={form.fiscal_period_id} onValueChange={v => setForm(f => ({ ...f, fiscal_period_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                  <SelectContent>{periods.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button onClick={handleCreate} disabled={!form.name || !form.fiscal_period_id || create.isPending} className="w-full">
                {create.isPending ? "Creating…" : "Create Run"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {runs.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No allocation runs yet</CardContent></Card>
        ) : (
          runs.map(run => (
            <Card key={run.id} className={selectedRunId === run.id ? "ring-2 ring-primary" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{run.name}</CardTitle>
                  <Badge variant="outline" className={statusColors[run.status] || ""}>{run.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(run.created_at).toLocaleDateString()}
                  {run.posted_at && ` · Posted ${new Date(run.posted_at).toLocaleDateString()}`}
                </p>
              </CardHeader>
              <CardContent>
                {run.notes && <p className="text-sm text-muted-foreground mb-3">{run.notes}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedRunId(selectedRunId === run.id ? null : run.id)}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> {selectedRunId === run.id ? "Hide" : "View"} Results
                  </Button>
                  {run.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: run.id, status: "preview" })}>
                      Preview
                    </Button>
                  )}
                  {run.status === "preview" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: run.id, status: "approved" })}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                  )}
                  {run.status === "approved" && (
                    <Button size="sm" onClick={() => updateStatus.mutate({ id: run.id, status: "posted", posted_at: new Date().toISOString() })}>
                      <Send className="w-3.5 h-3.5 mr-1" /> Post to Ledger
                    </Button>
                  )}
                </div>
                {selectedRunId === run.id && (
                  <div className="mt-4 border-t pt-4">
                    <AllocationResultsTable runId={run.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
