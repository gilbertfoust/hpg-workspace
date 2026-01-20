import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ArrowRight } from "lucide-react";
import { useFormTemplates, FormTemplate } from "@/hooks/useFormTemplates";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";
import { FormRunnerSheet } from "@/components/forms/FormRunnerSheet";

const moduleLabels: Record<string, string> = {
  ngo_coordination: "NGO Coordination",
  administration: "Administration",
  operations: "Operations",
  program: "Program",
  curriculum: "Curriculum",
  development: "Development",
  partnership: "Partnership",
  marketing: "Marketing",
  communications: "Communications",
  hr: "HR",
  it: "IT",
  finance: "Finance",
  legal: "Legal",
};

const formatModuleLabel = (module: string) =>
  moduleLabels[module] || module.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function Forms() {
  const { data: templates, isLoading, error } = useFormTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, FormTemplate[]>();
    (templates || []).forEach((template) => {
      const label = formatModuleLabel(template.module);
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)?.push(template);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [templates]);

  const handleLaunch = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setSheetOpen(true);
  };

  if (isSupabaseNotConfiguredError(error)) {
    return (
      <MainLayout title="Forms" subtitle="Launch forms to create work items and submit data">
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Forms"
      subtitle="Launch forms to create work items and submit data"
    >
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      )}

      {!isLoading && groupedTemplates.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No form templates are available.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && groupedTemplates.length > 0 && (
        <div className="space-y-8">
          {groupedTemplates.map(([module, moduleTemplates]) => (
            <section key={module} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{module}</h2>
                  <p className="text-sm text-muted-foreground">
                    {moduleTemplates.length} template{moduleTemplates.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {moduleTemplates.map((template) => (
                  <Card key={template.id} className="module-card group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <FileText className="w-5 h-5" />
                        </div>
                        <Badge variant="outline" className="text-xs capitalize">
                          {formatModuleLabel(template.module)}
                        </Badge>
                      </div>
                      <CardTitle className="text-base mt-3 group-hover:text-primary transition-colors">
                        {template.name}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {template.description || "No description provided"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button className="w-full mt-4" variant="outline" onClick={() => handleLaunch(template)}>
                        Launch Form
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <FormRunnerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        template={selectedTemplate}
      />
    </MainLayout>
  );
}
