import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReportingTable } from "@/components/finance/ReportingTable";
import { DollarSign, Building, FileCheck } from "lucide-react";

const FinancialHub = () => {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Hub</h1>
          <p className="text-muted-foreground">NGO financial reporting, budgets, and compliance.</p>
        </div>

        {/* Section 1: Reporting */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">NGO Reporting & Budgets</h2>
          </div>
          <ReportingTable onRowClick={(ngoId) => navigate(`/financial-hub/ngo/${ngoId}`)} />
        </section>

        {/* Section 2 & 3: Placeholders */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">HPG Controller Hub</CardTitle>
              </div>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This section will manage HPG-level ledgers, inter-project allocations, consolidated financial views, and controller dashboards for the Executive Secretariat.
              </p>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">End of Year Compliance</CardTitle>
              </div>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This section will provide guided workflows for year-end financial statements, donor reporting, IRS Form 990 preparation, and audit support materials.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default FinancialHub;
