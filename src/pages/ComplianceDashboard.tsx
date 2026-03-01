import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialStatements } from "@/hooks/useFinancialStatements";
import { useCompliancePackages } from "@/hooks/useCompliancePackages";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { ComplianceDashboardCards } from "@/components/compliance/ComplianceDashboardCards";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronRight, FileText, Package, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ComplianceDashboard = () => {
  const { data: ngos } = useQuery({
    queryKey: ["ngos_compliance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ngos").select("id, legal_name, common_name").order("common_name");
      if (error) throw error;
      return data || [];
    },
  });

  const [selectedNgo, setSelectedNgo] = useState<string>("");
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);

  const { data: statements } = useFinancialStatements(selectedNgo || undefined, fiscalYear);
  const { data: packages } = useCompliancePackages(selectedNgo || undefined, fiscalYear);
  const { data: periods } = useFiscalPeriods(selectedNgo || undefined);

  const yearPeriods = (periods || []).filter((p) => new Date(p.start_date).getFullYear() === fiscalYear);
  const allLocked = yearPeriods.length > 0 && yearPeriods.every((p) => (p as any).is_locked);
  const approvedCount = (packages || []).filter((p) => p.status === "approved").length;

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/financial-hub" className="hover:text-foreground">Financial Hub</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Compliance</span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Compliance & Statements</h1>
          <div className="flex gap-2">
            <Select value={selectedNgo} onValueChange={setSelectedNgo}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Select NGO" /></SelectTrigger>
              <SelectContent>
                {(ngos || []).map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedNgo ? (
          <>
            <ComplianceDashboardCards
              statementsCount={(statements || []).length}
              packagesCount={(packages || []).length}
              packagesApproved={approvedCount}
              isLocked={allLocked}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover:shadow-md transition-shadow">
                <Link to="/financial-hub/compliance/statements">
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Financial Statements</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">Generate balance sheet, income statement, cash flows, and functional expenses.</p></CardContent>
                </Link>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <Link to="/financial-hub/compliance/packages">
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Compliance Packages</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">Create 990, annual report, and audit packages.</p></CardContent>
                </Link>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <Link to="/financial-hub/compliance/close-year">
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> Year-End Close</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">Review, reconcile, generate closing entries, and lock the fiscal year.</p></CardContent>
                </Link>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Select an NGO to view compliance status.</p>
        )}
      </div>
    </MainLayout>
  );
};

export default ComplianceDashboard;
