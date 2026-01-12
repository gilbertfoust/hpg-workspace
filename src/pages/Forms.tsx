import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Plus,
  Users,
  Briefcase,
  DollarSign,
  Scale,
  Megaphone,
  MessageSquare,
  GraduationCap,
  Wrench,
  Monitor,
  Handshake,
  UserPlus,
  ArrowRight,
  Clock,
} from "lucide-react";

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  module: string;
  icon: React.ReactNode;
  lastUsed?: string;
  drafts?: number;
}

const formTemplates: FormTemplate[] = [
  {
    id: "1",
    name: "NGO Intake Form",
    description: "Register a new NGO partner with contact and jurisdiction details",
    module: "NGO Coordination",
    icon: <Users className="w-5 h-5" />,
    lastUsed: "2 days ago",
  },
  {
    id: "2",
    name: "Monthly NGO Check-in",
    description: "Record monthly status, activities, and support needs",
    module: "NGO Coordination",
    icon: <Users className="w-5 h-5" />,
    lastUsed: "1 week ago",
  },
  {
    id: "3",
    name: "Document Request",
    description: "Request specific documents from an NGO partner",
    module: "NGO Coordination",
    icon: <Users className="w-5 h-5" />,
  },
  {
    id: "4",
    name: "Expense Request",
    description: "Submit expense reimbursement with receipt attachments",
    module: "Finance",
    icon: <DollarSign className="w-5 h-5" />,
    drafts: 2,
  },
  {
    id: "5",
    name: "Payment Processing",
    description: "Request payment processing for approved expenses",
    module: "Finance",
    icon: <DollarSign className="w-5 h-5" />,
  },
  {
    id: "6",
    name: "Grant Research Update",
    description: "Document grant opportunity research findings",
    module: "Development",
    icon: <DollarSign className="w-5 h-5" />,
  },
  {
    id: "7",
    name: "LOI/Proposal Submission",
    description: "Submit letter of intent or grant proposal for review",
    module: "Development",
    icon: <DollarSign className="w-5 h-5" />,
    lastUsed: "3 days ago",
  },
  {
    id: "8",
    name: "Contract Review Request",
    description: "Request legal review of contracts or agreements",
    module: "Legal",
    icon: <Scale className="w-5 h-5" />,
  },
  {
    id: "9",
    name: "Compliance Filing Proof",
    description: "Submit evidence of regulatory filing completion",
    module: "Legal",
    icon: <Scale className="w-5 h-5" />,
  },
  {
    id: "10",
    name: "Marketing Request",
    description: "Request marketing support for campaigns or assets",
    module: "Marketing",
    icon: <Megaphone className="w-5 h-5" />,
  },
  {
    id: "11",
    name: "IT Access Request",
    description: "Request access to tools, systems, or accounts",
    module: "IT",
    icon: <Monitor className="w-5 h-5" />,
    lastUsed: "1 day ago",
  },
  {
    id: "12",
    name: "Support Ticket",
    description: "Submit IT support request or report an issue",
    module: "IT",
    icon: <Monitor className="w-5 h-5" />,
  },
  {
    id: "13",
    name: "Application Intake",
    description: "Process new job applications",
    module: "HR",
    icon: <UserPlus className="w-5 h-5" />,
  },
  {
    id: "14",
    name: "Interview Scorecard",
    description: "Record interview feedback and scoring",
    module: "HR",
    icon: <UserPlus className="w-5 h-5" />,
  },
  {
    id: "15",
    name: "Meeting Minutes",
    description: "Upload and link meeting minutes to relevant items",
    module: "Administration",
    icon: <Briefcase className="w-5 h-5" />,
  },
];

const modules = [
  { name: "All Forms", count: formTemplates.length },
  { name: "NGO Coordination", count: 3 },
  { name: "Finance", count: 2 },
  { name: "Development", count: 2 },
  { name: "Legal", count: 2 },
  { name: "Marketing", count: 1 },
  { name: "IT", count: 2 },
  { name: "HR", count: 2 },
  { name: "Administration", count: 1 },
];

export default function Forms() {
  return (
    <MainLayout
      title="Forms"
      subtitle="Launch forms to create work items and submit data"
      actions={
        <Button variant="outline">
          <Clock className="w-4 h-4 mr-2" />
          My Drafts (2)
        </Button>
      }
    >
      <Tabs defaultValue="All Forms" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {modules.map((module) => (
            <TabsTrigger
              key={module.name}
              value={module.name}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {module.name}
              <Badge variant="secondary" className="ml-2 text-xs">
                {module.count}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {modules.map((module) => (
          <TabsContent key={module.name} value={module.name}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {formTemplates
                .filter(
                  (form) =>
                    module.name === "All Forms" || form.module === module.name
                )
                .map((form) => (
                  <Card key={form.id} className="module-card group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          {form.icon}
                        </div>
                        {form.drafts && form.drafts > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {form.drafts} draft{form.drafts > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base mt-3 group-hover:text-primary transition-colors">
                        {form.name}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {form.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs font-normal">
                          {form.module}
                        </Badge>
                        {form.lastUsed && (
                          <span className="text-xs text-muted-foreground">
                            Used {form.lastUsed}
                          </span>
                        )}
                      </div>
                      <Button className="w-full mt-4" variant="outline">
                        Launch Form
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </MainLayout>
  );
}
