import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { useFormTemplates, FormTemplate } from "@/hooks/useFormTemplates";
import { useFormSubmissions, FormSubmission } from "@/hooks/useFormSubmissions";
import { FormSubmissionSheet } from "./FormSubmissionSheet";

interface NGOFormsTabProps {
  ngoId: string;
}

const statusIcons: Record<string, React.ReactNode> = {
  draft: <Clock className="w-4 h-4 text-muted-foreground" />,
  submitted: <CheckCircle className="w-4 h-4 text-info" />,
  accepted: <CheckCircle className="w-4 h-4 text-success" />,
  rejected: <XCircle className="w-4 h-4 text-destructive" />,
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Needs Revision",
};

export function NGOFormsTab({ ngoId }: NGOFormsTabProps) {
  const { data: templates, isLoading: templatesLoading } = useFormTemplates();
  const { data: submissions, isLoading: submissionsLoading } = useFormSubmissions({ ngo_id: ngoId });
  
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);

  const isLoading = templatesLoading || submissionsLoading;
  const activeTemplates = templates?.filter(t => t.is_active) || [];

  const handleStartForm = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setSelectedSubmission(null);
    setSheetOpen(true);
  };

  const handleViewSubmission = (submission: FormSubmission) => {
    // Find the template for this submission
    const template = templates?.find(t => t.id === submission.form_template_id);
    if (template) {
      setSelectedTemplate(template);
      setSelectedSubmission(submission);
      setSheetOpen(true);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Forms */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Available Forms</h3>
          </div>

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          )}

          {!isLoading && activeTemplates.length > 0 && (
            <div className="space-y-3">
              {activeTemplates.map((template) => (
                <Card key={template.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {template.description || "No description"}
                          </p>
                          <Badge variant="outline" className="mt-2 text-xs capitalize">
                            {template.module.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleStartForm(template)}>
                        Start
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && activeTemplates.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No form templates available</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Submissions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Recent Submissions</h3>
          </div>

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}

          {!isLoading && submissions && submissions.length > 0 && (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <Card 
                  key={submission.id} 
                  className="hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => handleViewSubmission(submission)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {statusIcons[submission.submission_status || "draft"]}
                        <div>
                          <h4 className="font-medium">
                            {submission.form_template?.name || "Unknown Form"}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {submission.submitted_at 
                              ? `Submitted ${format(new Date(submission.submitted_at), "MMM d, yyyy")}`
                              : `Last edited ${format(new Date(submission.updated_at), "MMM d, yyyy")}`
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {statusLabels[submission.submission_status || "draft"]}
                        </Badge>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && (!submissions || submissions.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-3">No form submissions yet</p>
                <p className="text-sm text-muted-foreground">
                  Start a form from the templates on the left
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <FormSubmissionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        template={selectedTemplate}
        submission={selectedSubmission}
        ngoId={ngoId}
      />
    </>
  );
}
