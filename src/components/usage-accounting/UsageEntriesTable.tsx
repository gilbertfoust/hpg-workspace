import { useState } from "react";
import { useUsageEntries } from "@/hooks/useUsageEntries";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useUsageSources } from "@/hooks/useUsageSources";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  allocated: "bg-blue-100 text-blue-800",
};

export function UsageEntriesTable({ filters }: { filters?: { fiscal_period_id?: string; cost_center_id?: string; ngo_id?: string; status?: string } }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const effectiveFilters = { ...filters, ...(statusFilter !== "all" ? { status: statusFilter } : {}) };
  const { data: entries = [], isLoading, updateStatus } = useUsageEntries(effectiveFilters);

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Loading usage entries…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="allocated">Allocated</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{entries.length} entries</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Cost Center</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Unit Cost</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No usage entries</TableCell></TableRow>
          ) : (
            entries.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-sm">{e.usage_date}</TableCell>
                <TableCell className="text-sm font-medium">{e.cost_centers?.code} — {e.cost_centers?.name}</TableCell>
                <TableCell><Badge variant="outline">{e.usage_sources?.type?.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-sm max-w-48 truncate">{e.description}</TableCell>
                <TableCell className="text-right font-mono">{Number(e.quantity).toLocaleString()}</TableCell>
                <TableCell className="text-sm">{e.unit_type}</TableCell>
                <TableCell className="text-right font-mono">${Number(e.unit_cost).toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono font-medium">${Number(e.total_cost).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[e.status] || ""}>{e.status.replace(/_/g, " ")}</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
