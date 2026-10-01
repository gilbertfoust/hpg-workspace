import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Construction, ArrowRight, History, BrainCircuit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HPGAssistant from "@/pages/HPGAssistant";
import { Phase6ExecutiveCommandPanel } from "@/components/agent-os/Phase6ExecutiveCommandPanel";
import { DepartmentAgentWorkspacePanel } from "@/components/agent-os/DepartmentAgentWorkspacePanel";
import { Phase5MonitoringPanel } from "@/components/agent-os/Phase5MonitoringPanel";
import { Phase4MemoryPanel } from "@/components/agent-os/Phase4MemoryPanel";
import { AgentOSQueuePanel } from "@/components/ngo/AgentOSQueuePanel";
import { AgentOSOperationsPanel } from "@/components/ngo/AgentOSOperationsPanel";
import { AgentOSFinanceVerificationPanel } from "@/components/ngo/AgentOSFinanceVerificationPanel";
import { NiaPilotPanel } from "@/components/ngo/NiaPilotPanel";
import { Phase3SponsorshipPanel } from "@/components/ngo/Phase3SponsorshipPanel";
import { useAgentOSCases } from "@/hooks/useAgentOSCases";
import { useAgentOSOperations } from "@/hooks/useAgentOSOperations";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  moduleKey: string;
  features?: string[];
  links?: { label: string; path: string }[];
}

export function ModulePlaceholder({ title, description, moduleKey, features = [], links = [] }: ModulePlaceholderProps) {
  const navigate = useNavigate();
  return (
    <MainLayout title={title} subtitle={description}>
      <div className="space-y-6">
        <DepartmentAgentWorkspacePanel moduleKey={moduleKey} />
        <div className="mx-auto max-w-4xl space-y-6">
          {links.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {links.map((link) => (
                <Card key={link.path} className="cursor-pointer transition-colors hover:border-primary/50" onClick={() => navigate(link.path)}>
                  <CardContent className="flex items-center justify-between p-4">
                    <span className="text-sm font-medium">{link.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {features.length > 0 && (
            <Card>
              <CardHeader className="pb-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Construction className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{links.length ? "More Features Coming Soon" : "Module Coming Soon"}</CardTitle>
                <CardDescription>Additional features are part of the HPG ERP roadmap.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap justify-center gap-2">
                  {features.map((feature) => <Badge key={feature} variant="secondary">{feature}</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

export function NGOCoordinationModule() {
  const navigate = useNavigate();
  const agentCases = useAgentOSCases({ limit: 25 });
  const operations = useAgentOSOperations(50);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2 px-4 pt-4 lg:px-6">
        <Button size="sm" onClick={() => navigate("/agent-os")}>
          <BrainCircuit className="mr-2 h-4 w-4" /> Agent OS Executive Command
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/hpg-assistant")}>Assistant Workspace</Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/hpg-assistant/history")}>
          <History className="mr-2 h-4 w-4" /> Packet History
        </Button>
      </div>
      <div className="px-4 lg:px-6">
        <Phase6ExecutiveCommandPanel />
      </div>
      <div className="px-4 lg:px-6">
        <DepartmentAgentWorkspacePanel moduleKey="ngo_coordination" />
      </div>
      <div className="px-4 lg:px-6">
        <Phase5MonitoringPanel />
      </div>
      <div className="px-4 lg:px-6">
        <Phase4MemoryPanel />
      </div>
      <div className="px-4 lg:px-6">
        <Phase3SponsorshipPanel />
      </div>
      <div className="px-4 lg:px-6">
        <NiaPilotPanel />
      </div>
      {!agentCases.error && agentCases.data?.runtimeReady && (
        <div className="px-4 lg:px-6">
          <AgentOSFinanceVerificationPanel cases={agentCases.data.cases} />
        </div>
      )}
      {!agentCases.error && (
        <div className="px-4 lg:px-6">
          <AgentOSQueuePanel data={agentCases.data} isLoading={agentCases.isLoading} />
        </div>
      )}
      {!operations.error && (
        <div className="px-4 lg:px-6">
          <AgentOSOperationsPanel data={operations.data} isLoading={operations.isLoading} />
        </div>
      )}
      <HPGAssistant />
    </div>
  );
}

export function AdministrationModule() {
  return <ModulePlaceholder moduleKey="administration" title="Administration" description="Executive secretariat and cross-department coordination" links={[{ label: "Admin Panel", path: "/admin" }, { label: "Admin Config", path: "/admin/config" }, { label: "Calendar", path: "/calendar" }, { label: "Forms", path: "/forms" }]} features={["Meeting Minutes", "Policy Acknowledgments", "Cabinet Packs"]} />;
}

export function OperationsModule() {
  return <ModulePlaceholder moduleKey="operations" title="Operations" description="Internal project delivery and implementation" links={[{ label: "Work Items", path: "/work-items" }, { label: "My Queue", path: "/my-queue" }, { label: "Dept Queue", path: "/dept-queue" }, { label: "Automations", path: "/automations" }]} features={["Project Kickoffs", "Risk Tracking", "Milestones"]} />;
}

export function ProgramModule() {
  return <ModulePlaceholder moduleKey="program" title="Program" description="Program activities and delivery tracking" links={[{ label: "Program Dashboard", path: "/program" }]} features={["Activity Reports", "Incident Reports", "Evidence Tracking", "Event Management"]} />;
}

export function CurriculumModule() {
  return <ModulePlaceholder moduleKey="curriculum" title="Curriculum" description="Educational content development and management" links={[{ label: "Curriculum Dashboard", path: "/curriculum" }]} features={["Asset Library", "Change Requests", "Version Control", "Publishing Workflow"]} />;
}

export function DevelopmentModule() {
  return <ModulePlaceholder moduleKey="development" title="Development" description="Grants, fundraising, and donor relations" links={[{ label: "Development Dashboard", path: "/development" }, { label: "Grants Hub", path: "/grants" }, { label: "Grant Search", path: "/grants/search" }, { label: "Grant Pipeline", path: "/grants/pipeline" }]} features={["Post-Award Reporting"]} />;
}

export function PartnershipsModule() {
  return <ModulePlaceholder moduleKey="partnership" title="Partnership Development" description="Strategic partnership management" links={[{ label: "Partnerships Dashboard", path: "/partnerships" }, { label: "CRM", path: "/crm" }]} features={["MOU Tracking", "Activation Checklists"]} />;
}

export function MarketingModule() {
  return <ModulePlaceholder moduleKey="marketing" title="Marketing" description="Marketing campaigns and asset management" links={[{ label: "Department Forms", path: "/department-forms" }, { label: "Documents", path: "/documents" }]} features={["Request Intake", "Campaign Tracking", "Monthly Reports"]} />;
}

export function CommunicationsModule() {
  return <ModulePlaceholder moduleKey="communications" title="Communications" description="Internal and external messaging" links={[{ label: "Department Forms", path: "/department-forms" }, { label: "Documents", path: "/documents" }]} features={["Press Releases", "Newsletter Builder", "Internal Memos"]} />;
}

export function HRModule() {
  return <ModulePlaceholder moduleKey="hr" title="HR" description="Recruiting, hiring, and staff management" links={[{ label: "HR Dashboard", path: "/hr" }, { label: "HR & Workforce (ERP)", path: "/erp/hr" }, { label: "Staff Profiles", path: "/erp/hr/staff" }, { label: "Timesheets", path: "/erp/hr/timesheets" }, { label: "PTO Management", path: "/erp/hr/pto" }, { label: "Payroll Export", path: "/erp/hr/payroll" }]} />;
}

export function ITModule() {
  return <ModulePlaceholder moduleKey="it" title="IT" description="Technology access and support" links={[{ label: "IT Dashboard", path: "/it" }]} features={["SLA Tracking"]} />;
}

export function FinanceModule() {
  return <ModulePlaceholder moduleKey="finance" title="Finance" description="Double-entry accounting and financial operations" links={[{ label: "Financial Hub", path: "/financial-hub" }, { label: "Transactions", path: "/financial-hub/accounting/transactions" }, { label: "Operations", path: "/financial-hub/operations" }, { label: "Chart of Accounts", path: "/financial-hub/accounting/chart-of-accounts" }, { label: "Journal Entries", path: "/financial-hub/accounting/journal-entries" }, { label: "Financial Reports", path: "/financial-hub/accounting/reports" }, { label: "Compliance", path: "/financial-hub/accounting/compliance" }]} />;
}

export function LegalModule() {
  return <ModulePlaceholder moduleKey="legal" title="Legal" description="Contracts, compliance, and legal operations" links={[{ label: "Governance", path: "/governance" }, { label: "Country Compliance", path: "/governance/compliance" }, { label: "Documents", path: "/documents" }]} features={["Contract Review", "At-Risk Engine", "Renewal Tracking"]} />;
}
