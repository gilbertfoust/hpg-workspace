import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  FileText, Users, Briefcase, DollarSign, Scale, Megaphone, MessageSquare,
  GraduationCap, Wrench, Monitor, Handshake, UserPlus, ArrowRight, Bell,
  Building2, TrendingUp, Inbox, BarChart3, Settings2, Upload,
  Plus, Pencil, ClipboardPlus,
} from "lucide-react";
import { useFormTemplates, FormTemplate } from "@/hooks/useFormTemplates";
import { ModuleType } from "@/hooks/useWorkItems";
import { FormRunnerSheet } from "@/components/forms/FormRunnerSheet";
import { FormSubmissionsTab } from "@/components/forms/FormSubmissionsTab";
import { FormAnalyticsTab } from "@/components/forms/FormAnalyticsTab";
import { FormWorkflowEventsTab } from "@/components/forms/FormWorkflowEventsTab";
import { FormWorkflowRoutesTab } from "@/components/forms/FormWorkflowRoutesTab";
import { FormTemplateDocumentUploadDialog } from "@/components/forms/FormTemplateDocumentUploadDialog";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";
import { FormTemplateBuilderDialog } from "@/components/forms/FormTemplateBuilderDialog";
import { FormAssignmentDialog } from "@/components/forms/FormAssignmentDialog";
import { isAdminRole, useUserRole } from "@/hooks/useUserRole";

const moduleDisplayNames: Record<ModuleType | "All Forms", string> = {
  "All Forms": "All Forms",
  ngo_coordination: "NGO Coordination",
  administration: "Administration",
  operations: "Operations",
  program: "Program",
  curriculum: "Curriculum",
  development: "Development",
  partnership: "Partnership Development",
  marketing: "Marketing",
  communications: "Communications",
  hr: "HR",
  it: "IT",
  finance: "Finance",
  legal: "Legal/Compliance",
};

const moduleIcons: Record<ModuleType, React.ReactNode> = {
  ngo_coordination: <Users className="w-5 h-5" />,
  administration: <Briefcase className="w-5 h-5" />,
  operations: <Wrench className="w-5 h-5" />,
  program: <Building2 className="w-5 h-5" />,
  curriculum: <GraduationCap className="w-5 h-5" />,
  development: <TrendingUp className="w-5 h-5" />,
  partnership: <Handshake className="w-5 h-5" />,
  marketing: <Megaphone className="w-5 h-5" />,
  communications: <MessageSquare className="w-5 h-5" />,
  hr: <UserPlus className="w-5 h-5" />,
  it: <Monitor className="w-5 h-5" />,
  finance: <DollarSign className="w-5 h-5" />,
  legal: <Scale className="w-5 h-5" />,
};

type ViewMode = "templates" | "submissions" | "analytics" | "workflow_events" | "workflow_routes";

export default function Forms() {
  const { data: templates, isLoading, error } = useFormTemplates();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [uploadTemplate, setUploadTemplate] = useState<FormTemplate | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("templates");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [assignmentTemplate, setAssignmentTemplate] = useState<FormTemplate | null>(null);
  const { data: userRole } = useUserRole();
  const canManageTemplates = isAdminRole(userRole?.role);

  const modules = useMemo(() => {
    if (!templates) return [{ name: "All Forms" as const, count: 0 }];
    const activeTemplates = templates.filter((t) => t.is_active);

    const moduleCounts = new Map<ModuleType | "All Forms", number>();
    moduleCounts.set("All Forms", activeTemplates.length);
    activeTemplates.forEach((template) => {
      moduleCounts.set(template.module, (moduleCounts.get(template.module) || 0) + 1);
    });

    const moduleOrder: ModuleType[] = [
      "ngo_coordination", "administration", "operations", "program", "curriculum",
      "development", "partnership", "marketing", "communications", "hr", "it", "finance", "legal",
    ];

    const moduleList: Array<{ name: ModuleType | "All Forms"; count: number }> = [
      { name: "All Forms", count: activeTemplates.length },
    ];

    moduleOrder.forEach((module) => {
      const count = moduleCounts.get(module);
      if (count && count > 0) {
        moduleList.push({ name: module, count });
      }
    });

    return moduleList;
  }, [templates]);

  const handleLaunchForm = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setSheetOpen(true);
  };

  if (isSupabaseNotConfiguredError(error)) {
    return (
      <MainLayout title="Forms">
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

  const activeTemplates = templates?.filter((t) => t.is_active) || [];

  return (
    <TooltipProvider>
      <MainLayout
        title="Forms"
        subtitle="Launch forms to create work items and submit data"
        actions={
          <div className="flex gap-2 flex-wrap">
            {canManageTemplates && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingTemplate(null);
                  setBuilderOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Form
              </Button>
            )}
            <Button
              variant={viewMode === "templates" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("templates")}
            >
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </Button>
            <Button
              variant={viewMode === "submissions" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("submissions")}
            >
              <Inbox className="w-4 h-4 mr-2" />
              Submissions
            </Button>
            <Button
              variant={viewMode === "workflow_events" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("workflow_events")}
            >
              <Bell className="w-4 h-4 mr-2" />
              Workflow Events
            </Button>
            <Button
              variant={viewMode === "workflow_routes" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("workflow_routes")}
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Routes
            </Button>
            <Button
              variant={viewMode === "analytics" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("analytics")}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
          </div>
        }
      >
        {viewMode === "analytics" ? (
          <FormAnalyticsTab />
        ) : viewMode === "workflow_routes" ? (
          <FormWorkflowRoutesTab />
        ) : viewMode === "workflow_events" ? (
          <FormWorkflowEventsTab />
        ) : viewMode === "submissions" ? (
          <FormSubmissionsTab />
        ) : (
          <Tabs defaultValue="All Forms" className="space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
              {modules.map((module) => (
                <TabsTrigger
                  key={module.name}
                  value={module.name}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {moduleDisplayNames[module.name]}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {module.count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {modules.map((module) => {
              const filteredTemplates =
                module.name === "All Forms"
                  ? activeTemplates
                  : activeTemplates.filter((form) => form.module === module.name);

              return (
                <TabsContent key={module.name} value={module.name}>
                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i}>
                          <CardHeader>
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-full mt-2" />
                          </CardHeader>
                          <CardContent>
                            <Skeleton className="h-9 w-full" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">No forms available for this module</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredTemplates.map((form) => {
                        const moduleIcon = moduleIcons[form.module] || <FileText className="w-5 h-5" />;
                        const moduleDisplayName =
                          moduleDisplayNames[form.module] ||
                          form.module.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

                        return (
                          <Card key={form.id} className="module-card group">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                  {moduleIcon}
                                </div>
                                <div className="flex">
                                  {canManageTemplates && (
                                    <Button variant="ghost" size="icon" title="Edit and publish a new version" onClick={() => { setEditingTemplate(form); setBuilderOpen(true); }}>
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" title="Assign to NGO" onClick={() => setAssignmentTemplate(form)}>
                                    <ClipboardPlus className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" title="Upload template attachment" onClick={() => setUploadTemplate(form)}>
                                    <Upload className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <CardTitle className="text-base mt-3 group-hover:text-primary transition-colors">
                                {form.name}
                              </CardTitle>
                              <CardDescription className="text-sm">
                                {form.description || "No description available"}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-xs font-normal">
                                  {moduleDisplayName}
                                </Badge>
                              </div>
                              <div className="mt-4 grid gap-2">
                                <Button
                                  className="w-full"
                                  variant="outline"
                                  onClick={() => handleLaunchForm(form)}
                                >
                                  Launch Form
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                                <Button
                                  className="w-full"
                                  variant="secondary"
                                  onClick={() => setUploadTemplate(form)}
                                >
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload Document
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        <FormRunnerSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          template={selectedTemplate}
        />
        <FormTemplateDocumentUploadDialog
          open={!!uploadTemplate}
          onOpenChange={(open) => {
            if (!open) setUploadTemplate(null);
          }}
          template={uploadTemplate}
          moduleLabel={uploadTemplate ? moduleDisplayNames[uploadTemplate.module] : undefined}
        />
        <FormTemplateBuilderDialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          template={editingTemplate}
        />
        <FormAssignmentDialog
          open={!!assignmentTemplate}
          onOpenChange={(open) => { if (!open) setAssignmentTemplate(null); }}
          template={assignmentTemplate}
        />
      </MainLayout>
    </TooltipProvider>
  );
}
