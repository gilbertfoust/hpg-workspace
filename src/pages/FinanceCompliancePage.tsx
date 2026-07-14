import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useFinanceFunctionalExpenseReport,
  useFinanceRestrictedFundReport,
  useFinanceTrialBalanceValidation,
  useFinanceYearEndPackages,
  useGenerateYearEndPackage,
} from "@/hooks/useFinanceCompliance";
import { exportToCsv } from "@/hooks/useFinanceReports";
import { logFinanceExport } from "@/hooks/useFinanceCompliance";
import { hasFinancePermission } from "@/lib/financePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";

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

  const { data: tbValidation } = useFinanceTrialBalanceValidation(startDate, endDate, selectedNgoId);
  const { data: functional } = useFinanceFunctionalExpenseReport(startDate, endDate, selectedNgoId);
  const { data: restricted } = useFinanceRestrictedFundReport(endDate, selectedNgoId);
  const { data: packages = [] } = useFinanceYearEndPackages(selectedNgoId);
  const generatePackage = useGenerateYearEndPackage();

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
              <Button variant="outline" size="sm" onClick={() => {
                if (!functional) return;
                exportToCsv("functional-expenses.csv", ["Category", "Amount"], [
                  ["Program", functional.program], ["Management & General", functional.management_general],
                  ["Fundraising", functional.fundraising], ["Pass-through", functional.pass_through],
                ]);
                logFinanceExport("functional_expense", { startDate, endDate });
              }}>Export CSV</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {functional && Object.entries(functional).filter(([k]) => !k.includes("date")).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm"><span className="capitalize">{k.replace(/_/g, " ")}</span><span>{fmt(Number(v))}</span></div>
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
              <CardContent className="pt-6 flex gap-3 items-end">
                <div><Label>Fiscal year</Label><Input type="number" value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))} className="w-32" /></div>
                <Button onClick={() => generatePackage.mutate({ fiscalYear, ngoId: selectedNgoId })}>Generate audit package</Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Saved packages</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {packages.map((pkg: { id: string; label: string; fiscal_year: number; status: string }) => (
                  <li key={pkg.id}>{pkg.label} — FY{pkg.fiscal_year} ({pkg.status})</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default FinanceCompliancePage;
