import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCloseFinanceFiscalPeriod,
  useFinanceFiscalPeriods,
  useFinancePeriodCloseReadiness,
  useLockFinanceFiscalPeriod,
  useReopenFinanceFiscalPeriod,
} from "@/hooks/useFinanceFiscalPeriods";
import { hasFinancePermission } from "@/lib/financePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

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
  const [reviewId, setReviewId] = useState<string | null>(null);
  const { data: readiness, isFetching: readinessLoading, refetch: refreshReadiness } = useFinancePeriodCloseReadiness(reviewId);
  const reviewPeriod = periods.find((period) => period.id === reviewId);

  useEffect(() => {
    setReviewId(null);
    setReopenId(null);
  }, [selectedNgoId]);

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
                        <Button size="sm" variant="outline" onClick={() => setReviewId(p.id)}>Review & close</Button>
                      )}
                      {canManage && p.status === "closed" && (
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

      {reviewId && reviewPeriod && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Close readiness — {reviewPeriod.label}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">The database rechecks every control inside the close transaction.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => refreshReadiness()} disabled={readinessLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${readinessLoading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {readiness && (
              <>
                <Alert variant={readiness.is_ready ? "default" : "destructive"}>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>{readiness.is_ready ? "Ready to close" : "Close is blocked"}</AlertTitle>
                  <AlertDescription>
                    {readiness.is_ready ? "Trial balance, receipts, journals, bank statements, and prerequisite periods passed." : (
                      <ul className="list-disc pl-5 space-y-1">
                        {readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <ControlCount label="Pending journals" value={readiness.pending_journals} />
                  <ControlCount label="Receipt drafts" value={readiness.unresolved_receipts} />
                  <ControlCount label="Missing evidence" value={readiness.unsupported_expenses} />
                  <ControlCount label="Unreconciled accounts" value={readiness.unreconciled_bank_accounts} />
                  <ControlCount label="Statement issues" value={readiness.unresolved_statement_imports} />
                  <ControlCount label="Open dependencies" value={readiness.dependent_open_periods} />
                  <ControlCount label="Unposted opening rows" value={readiness.staged_opening_balances} />
                  <ControlCount label="Trial balance" value={readiness.trial_balance.is_balanced ? 0 : 1} />
                </div>
                {readiness.ecosystem_integrity ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium">Parent and child tie-outs</p>
                      <p className="text-xs text-muted-foreground">The period cannot close when a source schedule, control account, or parent statement disagrees.</p>
                    </div>
                    <div className="rounded-md border divide-y">
                      {readiness.ecosystem_integrity.checks.map((check) => (
                        <div key={check.key} className="p-3 flex items-start justify-between gap-4 text-sm">
                          <div className="flex items-start gap-2">
                            {check.is_balanced ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />}
                            <div>
                              <p className="font-medium">{check.label}</p>
                              <p className="text-xs text-muted-foreground">{humanize(check.child)} → {humanize(check.parent)}</p>
                            </div>
                          </div>
                          <Badge variant={check.is_balanced ? "secondary" : "destructive"}>
                            {check.is_balanced ? "Tied" : `Difference ${Number(check.difference).toLocaleString()}`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewId(null)}>Cancel</Button>
              <Button
                disabled={!readiness?.is_ready || closePeriod.isPending}
                onClick={() => closePeriod.mutate(reviewId, { onSuccess: () => setReviewId(null) })}
              >
                Close period
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

const ControlCount = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md border p-3 flex items-center justify-between">
    <span className="text-muted-foreground">{label}</span>
    <Badge variant={value === 0 ? "secondary" : "destructive"}>{value === 0 ? "Clear" : value}</Badge>
  </div>
);

const humanize = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default FinanceFiscalPeriodsPage;
