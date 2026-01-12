import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Construction, ArrowRight } from "lucide-react";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  features?: string[];
}

export function ModulePlaceholder({ title, description, features = [] }: ModulePlaceholderProps) {
  return (
    <MainLayout title={title} subtitle={description}>
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Construction className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Module Coming Soon</CardTitle>
          <CardDescription>
            This module is part of the HPG Workstation roadmap and will be available soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {features.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Planned Features:</h4>
              <div className="flex flex-wrap gap-2">
                {features.map((feature) => (
                  <Badge key={feature} variant="secondary">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-center mt-6">
            <Button variant="outline">
              View Roadmap
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}

// Module-specific placeholder pages
export function NGOCoordinationModule() {
  return (
    <ModulePlaceholder
      title="NGO Coordination"
      description="Manage NGO partnerships and liaison activities"
      features={["NGO Intake Forms", "Monthly Check-ins", "Document Requests", "Relationship Notes"]}
    />
  );
}

export function AdministrationModule() {
  return (
    <ModulePlaceholder
      title="Administration"
      description="Executive secretariat and cross-department coordination"
      features={["Meeting Minutes", "Assignment Requests", "Policy Acknowledgments", "Cabinet Packs"]}
    />
  );
}

export function OperationsModule() {
  return (
    <ModulePlaceholder
      title="Operations"
      description="Internal project delivery and implementation"
      features={["Project Kickoffs", "Weekly Status Updates", "Risk Tracking", "Milestones"]}
    />
  );
}

export function ProgramModule() {
  return (
    <ModulePlaceholder
      title="Program"
      description="Program activities and delivery tracking"
      features={["Activity Reports", "Incident Reports", "Evidence Tracking", "Event Management"]}
    />
  );
}

export function CurriculumModule() {
  return (
    <ModulePlaceholder
      title="Curriculum"
      description="Educational content development and management"
      features={["Asset Library", "Change Requests", "Version Control", "Publishing Workflow"]}
    />
  );
}

export function DevelopmentModule() {
  return (
    <ModulePlaceholder
      title="Development"
      description="Grants, fundraising, and donor relations"
      features={["Grant Research", "Opportunity Pipeline", "LOI/Proposal Tracking", "Post-Award Reporting"]}
    />
  );
}

export function PartnershipsModule() {
  return (
    <ModulePlaceholder
      title="Partnership Development"
      description="Strategic partnership management"
      features={["Partner Intake", "Meeting Notes", "MOU Tracking", "Activation Checklists"]}
    />
  );
}

export function MarketingModule() {
  return (
    <ModulePlaceholder
      title="Marketing"
      description="Marketing campaigns and asset management"
      features={["Request Intake", "Asset Requests", "Campaign Tracking", "Monthly Reports"]}
    />
  );
}

export function CommunicationsModule() {
  return (
    <ModulePlaceholder
      title="Communications"
      description="Internal and external messaging"
      features={["Press Releases", "Newsletter Builder", "Internal Memos", "Channel Tracking"]}
    />
  );
}

export function HRModule() {
  return (
    <ModulePlaceholder
      title="HR"
      description="Recruiting, hiring, and staff management"
      features={["Job Requisitions", "Application Intake", "Interview Scorecards", "Onboarding Triggers"]}
    />
  );
}

export function ITModule() {
  return (
    <ModulePlaceholder
      title="IT"
      description="Technology access and support"
      features={["Access Requests", "Support Tickets", "Provisioning Tasks", "SLA Tracking"]}
    />
  );
}

export function FinanceModule() {
  return (
    <ModulePlaceholder
      title="Finance"
      description="Expense management and financial operations"
      features={["Expense Requests", "Payment Processing", "Budget Adjustments", "Vendor Management"]}
    />
  );
}

export function LegalModule() {
  return (
    <ModulePlaceholder
      title="Legal"
      description="Contracts, compliance, and legal operations"
      features={["Contract Review", "Compliance Filings", "At-Risk Engine", "Renewal Tracking"]}
    />
  );
}
