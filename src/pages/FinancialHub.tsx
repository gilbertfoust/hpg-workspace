import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReportingTable } from "@/components/finance/ReportingTable";
import { DollarSign, Building, FileCheck, ArrowRight, BookOpen, Scale, Receipt, BarChart3, ShieldCheck } from "lucide-react";

const FinancialHub = () => {
  const navigate = useNavigate();

  const quickLinks = [
    { label: "Accounting COA", path: "/financial-hub/accounting/chart-of-accounts", icon: BookOpen },
    { label: "Accounts (COA)", path: "/financial-hub/accounts", icon: BookOpen },
    { label: "Transactions", path: "/financial-hub/transactions", icon: Receipt },
    { label: "General Ledger", path: "/financial-hub/ledger", icon: BarChart3 },
    { label: "Trial Balance", path: "/financial-hub/trial-balance", icon: Scale },
    { label: "Intake Queue", path: "/intake", icon: Receipt },
    { label: "Usage Accounting", path: "/usage-accounting/entries", icon: DollarSign },
  ];

  return (
    <MainLayout>
      <div className="space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Hub</h1>
          <p className="text-muted-foreground">NGO financial reporting, budgets, ledger, and compliance.</p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map(link => (
            <Card key={link.path} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(link.path)}>
              <CardContent className="p-3 flex items-center gap-2">
                <link.icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{link.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Section 1: Reporting */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">NGO Reporting & Budgets</h2>
          </div>
          <ReportingTable onRowClick={(ngoId) => navigate(`/financial-hub/ngo/${ngoId}`)} />
        </section>

        {/* Section 2 & 3: Controller Hub & Compliance */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/controller")}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">HPG Controller Hub</CardTitle>
              </div>
              <CardDescription>Cross-NGO financial oversight and treasury</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Consolidated views, inter-NGO transfers, risk scoring, and treasury management.</p>
                <div className="flex items-center gap-1 text-primary text-xs font-medium mt-2">
                  Open Controller Hub <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/financial-hub/compliance")}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Year-End Compliance</CardTitle>
              </div>
              <CardDescription>Financial statements, Form 990, audit packages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Guided workflows for year-end statements, donor reporting, IRS Form 990, and audit support.</p>
                <div className="flex items-center gap-1 text-primary text-xs font-medium mt-2">
                  Open Compliance Dashboard <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default FinancialHub;
