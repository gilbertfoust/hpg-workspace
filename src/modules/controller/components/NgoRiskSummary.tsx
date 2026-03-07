import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNgoRiskProfiles } from "@/hooks/useNgoRiskProfiles";
import { useState, useEffect } from "react";

const riskColor = (score: number) => {
  if (score >= 70) return "text-destructive";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
};

const riskBadgeVariant = (level: string) => {
  if (level === "high") return "destructive";
  if (level === "medium") return "secondary";
  return "default";
};

interface Props {
  ngoId: string;
  ngoName: string;
}

export function NgoRiskSummary({ ngoId, ngoName }: Props) {
  const { data: profiles, upsert } = useNgoRiskProfiles(ngoId);
  const profile = profiles?.[0];
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile?.notes) setNotes(profile.notes);
  }, [profile?.notes]);

  const scores = [
    { label: "Financial", value: profile?.financial_risk_score ?? 50 },
    { label: "Compliance", value: profile?.compliance_risk_score ?? 50 },
    { label: "HR", value: profile?.hr_risk_score ?? 50 },
    { label: "Operations", value: profile?.operations_risk_score ?? 50 },
  ];

  const overall = profile?.overall_risk_score ?? 50;
  const level = profile?.risk_level ?? "medium";

  const handleSaveNotes = () => {
    upsert.mutate({ ngo_id: ngoId, notes });
    setDirty(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Risk Profile — {ngoName}</CardTitle>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${riskColor(overall)}`}>{overall}</span>
            <Badge variant={riskBadgeVariant(level) as any}>{level.toUpperCase()}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {scores.map(s => (
            <div key={s.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className={`font-medium ${riskColor(s.value)}`}>{s.value}</span>
              </div>
              <Progress value={s.value} className="h-2" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Risk Notes</label>
          <Textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setDirty(true); }}
            placeholder="Add notes about this NGO's risk posture…"
            rows={3}
          />
          {dirty && (
            <Button size="sm" onClick={handleSaveNotes} disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Save Notes"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
