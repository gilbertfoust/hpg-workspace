import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useNgoRiskProfiles } from "@/hooks/useNgoRiskProfiles";
import { useNGOs } from "@/hooks/useNGOs";
import { ShieldAlert, TrendingUp, TrendingDown, Minus, Plus } from "lucide-react";

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "bg-destructive" : score >= 40 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function RiskScoring() {
  const { data: profiles, isLoading, upsert } = useNgoRiskProfiles();
  const { ngos } = useNGOs();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [form, setForm] = useState({
    ngo_id: "",
    financial_risk_score: 50,
    compliance_risk_score: 50,
    hr_risk_score: 50,
    operations_risk_score: 50,
    notes: "",
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ngo_id: "", financial_risk_score: 50, compliance_risk_score: 50, hr_risk_score: 50, operations_risk_score: 50, notes: "" });
    setShowDialog(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      ngo_id: p.ngo_id,
      financial_risk_score: p.financial_risk_score,
      compliance_risk_score: p.compliance_risk_score,
      hr_risk_score: p.hr_risk_score,
      operations_risk_score: p.operations_risk_score,
      notes: p.notes || "",
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    const overall = Math.round(
      (form.financial_risk_score + form.compliance_risk_score + form.hr_risk_score + form.operations_risk_score) / 4
    );
    const risk_level = overall >= 70 ? "high" : overall >= 40 ? "medium" : "low";
    upsert.mutate(
      { ...form, overall_risk_score: overall, risk_level },
      { onSuccess: () => setShowDialog(false) }
    );
  };

  const totalProfiles = profiles?.length ?? 0;
  const highRisk = profiles?.filter((p) => p.risk_level === "high").length ?? 0;
  const avgScore = totalProfiles ? Math.round((profiles ?? []).reduce((s, p) => s + p.overall_risk_score, 0) / totalProfiles) : 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6" />
              NGO Risk Scoring
            </h1>
            <p className="text-muted-foreground">Assess and monitor NGO risk levels across all dimensions</p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Score NGO</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">NGOs Scored</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{totalProfiles}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">High Risk</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-destructive">{highRisk}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Score</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold flex items-center gap-2">
                {avgScore}
                {avgScore >= 50 ? <TrendingUp className="h-5 w-5 text-destructive" /> : <TrendingDown className="h-5 w-5 text-green-500" />}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NGO</TableHead>
                  <TableHead>Financial</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>HR</TableHead>
                  <TableHead>Operations</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : !profiles?.length ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No risk profiles yet</TableCell></TableRow>
                ) : (
                  profiles.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(p)}>
                      <TableCell className="font-medium">{(p as any).ngos?.legal_name ?? p.ngo_id.slice(0, 8)}</TableCell>
                      <TableCell>{p.financial_risk_score}</TableCell>
                      <TableCell>{p.compliance_risk_score}</TableCell>
                      <TableCell>{p.hr_risk_score}</TableCell>
                      <TableCell>{p.operations_risk_score}</TableCell>
                      <TableCell className="font-bold">{p.overall_risk_score}</TableCell>
                      <TableCell>
                        <Badge className={RISK_COLORS[p.risk_level] ?? ""}>{p.risk_level}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost">Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Risk Profile" : "Score NGO"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              {!editing && (
                <div className="space-y-2">
                  <Label>NGO</Label>
                  <Select value={form.ngo_id} onValueChange={(v) => setForm({ ...form, ngo_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>
                      {(ngos ?? []).map((n) => (
                        <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(["financial_risk_score", "compliance_risk_score", "hr_risk_score", "operations_risk_score"] as const).map((key) => (
                <div key={key} className="space-y-2">
                  <ScoreBar score={(form as any)[key]} label={key.replace(/_/g, " ").replace("score", "").trim()} />
                  <Slider
                    value={[(form as any)[key]]}
                    max={100}
                    step={1}
                    onValueChange={([v]) => setForm({ ...form, [key]: v })}
                  />
                </div>
              ))}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Risk assessment notes…" />
              </div>

              <Button className="w-full" onClick={handleSave} disabled={(!editing && !form.ngo_id) || upsert.isPending}>
                {upsert.isPending ? "Saving…" : "Save Risk Profile"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
