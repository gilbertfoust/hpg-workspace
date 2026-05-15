import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Construction, ArrowRight, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HPGAssistant from "@/pages/HPGAssistant";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  features?: string[];
  links?: { label: string; path: string }[];
}

export function ModulePlaceholder({ title, description, features = [], links = [] }: ModulePlaceholderProps) {
  const navigate = useNavigate();
  return (
    <MainLayout title={title} subtitle={description}>
      <div className="space-y-6 max-w-4xl mx-auto">
        {links.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {links.map((l) => (
              <Card key={l.path} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(l.path)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="font-medium text-sm">{l.label}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {features.length > 0 && (
          <Card>
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Construction className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">{links.length ? "More Features Coming Soon" : "Module Coming Soon"}</CardTitle>
              <CardDescription>Additional features are part of the HPG ERP roadmap.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 justify-center">
                {features.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

export function NGOCoordinationModule() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2 px-4 pt-4 lg:px-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/hpg-assistant")}>Assistant Workspace</Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/hpg-assistant/history")}>
          <History className="mr-2 h-4 w-4" /> Packet History
        </Button>
      </div>
      <HPGAssistant />
    </div>
  );
}

export function AdministrationModule() {
  return <ModulePlaceholder title="Administration" description="Executive secretariat and cross-department coordination" links={[{ label: "Admin Panel", path: "/admin" }, { label: "Admin Config", path: "/admin/config" }, { label: "Calendar", path: "/calendar" }, { label: "Forms", path: "/forms" }]} features={["Meeting Minutes", "Policy Acknowledgments", "Cabinet Packs"]} />;
}

export function OperationsModule() {
  return <ModulePlaceholder title="Operations" description="Internal project delivery and implementation" links={[{ label: "Work Items", path: "/work-items" }, { label: "My Queue", path: "/my-queue" }, { label: "Dept Queue", path: "/dept-queue" }, { label: "Automations", path: "/automations" }]} features={["Project Kickoffs", "Risk Tracking", "Milestones"]} />;
}

export function ProgramModule() {
  return <ModulePlaceholder title="Program" description="Program activities and delivery tracking" links={[{ label: "Program Dashboard", path: "/program" }]} features={["Activity Reports", "Incident Reports", "Evidence Tracking", "Event Management"]} />;
}

export function CurriculumModule() {
  return <ModulePlaceholder title="Curriculum" description="Educational content development and management" links={[{ label: "Curriculum Dashboard", path: "/curriculum" }]} features={["Asset Library", "Change Requests", "Version Control", "Publishing Workflow"]} />;
}

export function DevelopmentModule() {
  return <ModulePlaceholder title="Development" description="Grants, fundraising, and donor relations" links={[{ label: "Development Dashboard", path: "/development" }, { label: "Grants Hub", path: "/grants" }, { label: "Grant Search", path: "/grants/search" }, { label: "Grant Pipeline", path: "/grants/pipeline" }]} features={["Post-Award Reporting"]} />;
}

export function PartnershipsModule() {
  return <ModulePlaceholder title="Partnership Development" description="Strategic partnership management" links={[{ label: "Partnerships Dashboard", path: "/partnerships" }, { label: "CRM", path: "/crm" }]} features={["MOU Tracking", "Activation Checklists"]} />;
}

export function MarketingModule() {
  return <ModulePlaceholder title="Marketing" description="Marketing campaigns and asset management" links={[{ label: "Department Forms", path: "/department-forms" }, { label: "Documents", path: "/documents" }]} features={["Request Intake", "Campaign Tracking", "Monthly Reports"]} />;
}

export function CommunicationsModule() {
  return <ModulePlaceholder title="Communications" description="Internal and external messaging" links={[{ label: "Department Forms", path: "/department-forms" }, { label: "Documents", path: "/documents" }]} features={["Press Releases", "Newsletter Builder", "Internal Memos"]} />;
}

export function HRModule() {
  return <ModulePlaceholder title="HR" description="Recruiting, hiring, and staff management" links={[{ label: "HR Dashboard", path: "/hr" }, { label: "HR & Workforce (ERP)", path: "/erp/hr" }, { label: "Staff Profiles", path: "/erp/hr/staff" }, { label: "Timesheets", path: "/erp/hr/timesheets" }, { label: "PTO Management", path: "/erp/hr/pto" }, { label: "Payroll Export", path: "/erp/hr/payroll" }]} />;
}

export function ITModule() {
  return <ModulePlaceholder title="IT" description="Technology access and support" links={[{ label: "IT Dashboard", path: "/it" }]} features={["SLA Tracking"]} />;
}

export function FinanceModule() {
  return <ModulePlaceholder title="Finance" description="Expense management and financial operations" links={[{ label: "Financial Hub", path: "/financial-hub" }, { label: "Accounts", path: "/financial-hub/accounts" }, { label: "Transactions", path: "/financial-hub/transactions" }, { label: "General Ledger", path: "/financial-hub/ledger" }, { label: "Trial Balance", path: "/financial-hub/trial-balance" }, { label: "Compliance", path: "/financial-hub/compliance" }]} />;
}

export function LegalModule() {
  return <ModulePlaceholder title="Legal" description="Contracts, compliance, and legal operations" links={[{ label: "Governance", path: "/governance" }, { label: "Country Compliance", path: "/governance/compliance" }, { label: "Documents", path: "/documents" }]} features={["Contract Review", "At-Risk Engine", "Renewal Tracking"]} />;
}
