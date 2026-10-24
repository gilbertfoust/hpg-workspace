import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useFinalizeFinanceYearEnd,
  useFinanceFunctionalExpenseReport,
  useFinanceRestrictedFundReport,
  useFinanceTrialBalanceValidation,
  useFinanceYearEndCloseReadiness,
  useFinanceYearEndCloses,
  useFinanceYearEndPackages,
  useGenerateYearEndPackage,
  useReopenFinanceYearEnd,
} from "@/hooks/useFinanceCompliance";
import { exportToCsv } from "@/hooks/useFinanceReports";
import { logFinanceExport } from "@/hooks/useFinanceCompliance";
import { hasFinancePermission } from "@/lib/financePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import type { FinanceYearEndPackage } from "@/types/financeAccounting";
import { Download, LockKeyhole, Printer, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const yearStart = `${new Date().getFullYear()}-01-01`;
const today = new Date().toISOString().slice(0, 10);

const FinanceCompliancePage = () => {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const { role } = useUserRole();
  const canManage = hasFinancePermission(role, "edit_settings");
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [reopenYear, setReopenYear] = useState<number | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  const { data: tbValidation } = useFinanceTrialBalanceValidation(startDate, endDate, selectedNgoId);
  const { data: functional } = useFinanceFunctionalExpenseReport(startDate, endDate, selectedNgoId);
  const { data: restricted } = useFinanceRestrictedFundReport(endDate, selectedNgoId);
  const { data: packages = [] } = useFinanceYearEndPackages(selectedNgoId);
  const { data: closes = [] } = useFinanceYearEndCloses(selectedNgoId);
  const { data: yearReadiness, refetch: refreshYearReadiness } = useFinanceYearEndCloseReadiness(fiscalYear, selectedNgoId);
  const generatePackage = useGenerateYearEndPackage();
  const finalizeYear = useFinalizeFinanceYearEnd();
  const reopenFiscalYear = useReopenFinanceYearEnd();
  const currentClose = closes.find((close) => close.fiscal_year === fiscalYear);
  const functionalRows: Array<[string, number]> = functional ? [
    ["Program", Number(functional.program)],
    ["Management & general", Number(functional.management_general)],
    ["Fundraising", Number(functional.fundraising)],
    ["Pass-through", Number(functional.pass_through)],
  ] : [];

  const downloadPackage = async (pkg: FinanceYearEndPackage) => {
    try {
      await logFinanceExport("year_end_package", { fiscalYear: pkg.fiscal_year, packageId: pkg.id, ngoId: selectedNgoId });
      const blob = new Blob([JSON.stringify(pkg.package_json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${pkg.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Download canceled because the audit event could not be recorded", {
        description: error instanceof Error ? error.message : "Unknown export error",
      });
    }
  };

  const printPackage = async (pkg: FinanceYearEndPackage) => {
    try {
      await logFinanceExport("year_end_package_print", { fiscalYear: pkg.fiscal_year, packageId: pkg.id, ngoId: selectedNgoId });
      window.print();
    } catch (error) {
      toast.error("Print canceled because the audit event could not be recorded", {
        description: error instanceof Error ? error.message : "Unknown export error",
      });
    }
  };

  return (
    <MainLayout
      title="Compliance & Year-End"
      subtitle={`Functional expenses, restricted funds, validation, and audit packages for ${selectedNgo?.common_name || selectedNgo?.legal_name || "HPG operating"}`}
    >
      <Card className="mb-4">
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div><Label>Start</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
          <div><Label>End</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
          {tbValidation && (
            <Badge variant={tbValidation.is_balanced ? "default" : "destructive"}>
              Trial balance {tbValidation.is_balanced ? "balanced" : "OUT OF BALANCE"}
            </Badge>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="functional">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="functional">Functional Expenses</TabsTrigger>
          <TabsTrigger value="restricted">Restricted Funds</TabsTrigger>
          <TabsTrigger value="year-end">Year-End Package</TabsTrigger>
        </TabsList>

        <TabsContent value="functional" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row justify-between">
              <CardTitle className="text-base">Form 990 functional expense summary</CardTitle>
              <Button variant="outline" size="sm" onClick={async () => {
                if (!functional) return;
                try {
                  await logFinanceExport("functional_expense", { startDate, endDate, ngoId: selectedNgoId });
                  exportToCsv("functional-expenses.csv", ["Category", "Amount"], functionalRows);
                } catch (error) {
                  toast.error("Export canceled because the audit event could not be recorded", {
                    description: error instanceof Error ? error.message : "Unknown export error",
                  });
                }
              }}>Export CSV</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {functionalRows.map(([label, amount]) => (
                <div key={label} className="flex justify-between text-sm"><span>{label}</span><span>{fmt(amount)}</span></div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restricted" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Restricted fund balances</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {(restricted?.funds || []).map((f: Record<string, unknown>, i: number) => (
                  <li key={i} className="flex justify-between"><span>{String(f.fund_name)} ({String(f.fund_type)})</span><span>{fmt(Number(f.balance))}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="year-end" className="mt-4 space-y-4">
          {canManage && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                <div><Label>Fiscal year</Label><Input type="number" value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))} className="w-32" /></div>
                  <Button variant="outline" onClick={() => refreshYearReadiness()}>Refresh readiness</Button>
                  <Button variant="outline" onClick={() => generatePackage.mutate({ fiscalYear, ngoId: selectedNgoId })}>Generate draft package</Button>
                  <Button
                    disabled={!yearReadiness?.is_ready || currentClose?.status === "finalized" || finalizeYear.isPending}
                    onClick={() => finalizeYear.mutate({ fiscalYear, ngoId: selectedNgoId })}
                  >
                    <LockKeyhole className="h-4 w-4 mr-1" />Finalize & lock year
                  </Button>
                </div>
                {yearReadiness && (
                  <Alert variant={yearReadiness.is_ready ? "default" : "destructive"}>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>{yearReadiness.is_ready ? "Fiscal year is ready" : "Year-end finalization is blocked"}</AlertTitle>
                    <AlertDescription>
                      {yearReadiness.is_ready ? "All monthly periods are closed and every accounting control passed." : (
                        <ul className="list-disc pl-5 space-y-1">
                          {yearReadiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                        </ul>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Saved packages</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {packages.map((pkg) => (
                  <li key={pkg.id} className="rounded-md border p-3 flex flex-wrap gap-3 items-center justify-between">
                    <div>
                      <p className="font-medium">{pkg.label}</p>
                      <p className="text-muted-foreground">FY{pkg.fiscal_year} · {pkg.status}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadPackage(pkg)}>
                        <Download className="h-4 w-4 mr-1" />JSON
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => printPackage(pkg)}>
                        <Printer className="h-4 w-4 mr-1" />Print
                      </Button>
                    </div>
                  </li>
                ))}
                {!packages.length && <li className="text-muted-foreground">No year-end packages yet.</li>}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Year close history</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {closes.map((close) => (
                <div key={close.id} className="rounded-md border p-3 flex flex-wrap gap-3 items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">FY{close.fiscal_year} <Badge className="ml-2" variant={close.status === "finalized" ? "default" : "secondary"}>{close.status}</Badge></p>
                    <p className="text-muted-foreground">{close.finalized_at ? `Finalized ${new Date(close.finalized_at).toLocaleString()}` : ""}</p>
                  </div>
                  {canManage && close.status === "finalized" && (
                    <Button size="sm" variant="outline" onClick={() => setReopenYear(close.fiscal_year)}>Reopen with reason</Button>
                  )}
                </div>
              ))}
              {!closes.length && <p className="text-sm text-muted-foreground">No fiscal years finalized yet.</p>}
            </CardContent>
          </Card>
          {reopenYear !== null && (
            <Card>
              <CardHeader><CardTitle className="text-base">Reopen FY{reopenYear}</CardTitle></CardHeader>
              <CardContent className="space-y-3 max-w-xl">
                <p className="text-sm text-muted-foreground">The locked audit package remains unchanged. Periods return to closed status so a specific period can be reopened and corrected.</p>
                <Label>Reason (required)</Label>
                <Input value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
                <div className="flex gap-2">
                  <Button
                    disabled={!reopenReason.trim() || reopenFiscalYear.isPending}
                    onClick={() => reopenFiscalYear.mutate(
                      { fiscalYear: reopenYear, ngoId: selectedNgoId, reason: reopenReason },
                      { onSuccess: () => { setReopenYear(null); setReopenReason(""); } },
                    )}
                  >Reopen fiscal year</Button>
                  <Button variant="outline" onClick={() => { setReopenYear(null); setReopenReason(""); }}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default FinanceCompliancePage;
