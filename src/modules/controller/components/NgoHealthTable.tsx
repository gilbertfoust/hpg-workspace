import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";

interface NgoHealthRow {
  id: string;
  legal_name: string;
  common_name: string | null;
  country: string | null;
  region: string | null;
  risk_level: string;
  overall_risk_score: number;
  alert_count: number;
  critical_alerts: number;
  grants_awarded: number;
  grants_pipeline: number;
  staff_count: number;
  asset_value: number;
  pending_compliance: number;
}

const riskColors: Record<string, string> = {
  low: "default",
  medium: "secondary",
  high: "destructive",
};

export function NgoHealthTable({ rows }: { rows: NgoHealthRow[] }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = rows.filter(r =>
    (r.common_name ?? r.legal_name).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">NGO Health Overview</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search NGOs…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NGO</TableHead>
              <TableHead>Region</TableHead>
              <TableHead className="text-center">Risk</TableHead>
              <TableHead className="text-center">Alerts</TableHead>
              <TableHead className="text-right">Grants Awarded</TableHead>
              <TableHead className="text-center">Pipeline</TableHead>
              <TableHead className="text-center">Staff</TableHead>
              <TableHead className="text-right">Asset Value</TableHead>
              <TableHead className="text-center">Compliance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No NGOs found</TableCell></TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/controller/ngo/${r.id}`)}>
                <TableCell className="font-medium">{r.common_name || r.legal_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.region ?? r.country ?? "—"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={riskColors[r.risk_level] as any ?? "secondary"}>
                    {r.risk_level} ({r.overall_risk_score})
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {r.alert_count > 0 ? (
                    <Badge variant={r.critical_alerts > 0 ? "destructive" : "secondary"}>{r.alert_count}</Badge>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono">${r.grants_awarded.toLocaleString()}</TableCell>
                <TableCell className="text-center">{r.grants_pipeline}</TableCell>
                <TableCell className="text-center">{r.staff_count}</TableCell>
                <TableCell className="text-right font-mono">${r.asset_value.toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  {r.pending_compliance > 0 ? (
                    <Badge variant="secondary">{r.pending_compliance} pending</Badge>
                  ) : <Badge variant="outline">OK</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
