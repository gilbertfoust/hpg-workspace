import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCloseFinanceFiscalPeriod,
  useFinanceFiscalPeriods,
  useLockFinanceFiscalPeriod,
  useReopenFinanceFiscalPeriod,
} from "@/hooks/useFinanceFiscalPeriods";
import { hasFinancePermission } from "@/lib/financePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";

const FinanceFiscalPeriodsPage = () => {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const { role } = useUserRole();
  const canManage = hasFinancePermission(role, "edit_settings");
  const { data: periods = [], isLoading } = useFinanceFiscalPeriods(selectedNgoId);
  const closePeriod = useCloseFinanceFiscalPeriod();
  const lockPeriod = useLockFinanceFiscalPeriod();
  const reopenPeriod = useReopenFinanceFiscalPeriod();
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  const statusTone = (status: string) =>
    status === "open" ? "default" : status === "closed" ? "secondary" : "destructive";

  return (
    <MainLayout
      title="Fiscal Periods"
      subtitle={`Open, close, lock, and reopen periods for ${selectedNgo?.common_name || selectedNgo?.legal_name || "HPG operating"}`}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period controls</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading periods…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    <TableCell className="capitalize">{p.period_type}</TableCell>
                    <TableCell>{p.start_date} → {p.end_date}</TableCell>
                    <TableCell><Badge variant={statusTone(p.status)}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      {canManage && p.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => closePeriod.mutate(p.id)}>Close</Button>
                      )}
                      {canManage && p.status !== "locked" && (
                        <Button size="sm" variant="outline" onClick={() => lockPeriod.mutate(p.id)}>Lock</Button>
                      )}
                      {canManage && p.status !== "open" && (
                        <Button size="sm" variant="ghost" onClick={() => setReopenId(p.id)}>Reopen</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {reopenId && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Reopen period</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-md">
            <Label>Reason (required)</Label>
            <Input value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
            <div className="flex gap-2">
              <Button
                disabled={!reopenReason.trim()}
                onClick={() => {
                  reopenPeriod.mutate({ periodId: reopenId, reason: reopenReason }, { onSuccess: () => { setReopenId(null); setReopenReason(""); } });
                }}
              >
                Confirm reopen
              </Button>
              <Button variant="outline" onClick={() => setReopenId(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
};

export default FinanceFiscalPeriodsPage;
