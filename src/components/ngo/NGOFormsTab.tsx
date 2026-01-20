import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, ArrowRight, Eye } from "lucide-react";
import { format } from "date-fns";
import { useFormTemplates, FormTemplate } from "@/hooks/useFormTemplates";
import { useFormSubmissions, FormSubmission } from "@/hooks/useFormSubmissions";
import { useProfiles } from "@/hooks/useProfiles";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";
import { FormRunnerSheet } from "@/components/forms/FormRunnerSheet";
import { FormSubmissionDetailSheet } from "@/components/forms/FormSubmissionDetailSheet";

interface NGOFormsTabProps {
  ngoId: string;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Needs Revision",
};

export function NGOFormsTab({ ngoId }: NGOFormsTabProps) {
  const { data: templates, isLoading: templatesLoading, error: templatesError } = useFormTemplates();
  const { data: submissions, isLoading: submissionsLoading, error: submissionsError } = useFormSubmissions({ ngo_id: ngoId });
  const { data: profiles } = useProfiles();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);

  const isLoading = templatesLoading || submissionsLoading;
  const activeTemplates = templates?.filter((template) => template.is_active) || [];

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles?.forEach((profile) => {
      map.set(profile.id, profile.full_name || profile.email || "Unknown User");
    });
    return map;
  }, [profiles]);

  const handleStartForm = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setSheetOpen(true);
  };

  const handleViewSubmission = (submission: FormSubmission) => {
    setSelectedSubmission(submission);
    setDetailOpen(true);
  };

  if (isSupabaseNotConfiguredError(templatesError) || isSupabaseNotConfiguredError(submissionsError)) {
    return <SupabaseNotConfiguredNotice />;
  }

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
                        Launch for this NGO
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

        {/* Past Submissions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Past Submissions</h3>
          </div>

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}

          {!isLoading && submissions && submissions.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-medium">
                          {submission.form_template?.name || "Unknown Form"}
                        </TableCell>
                        <TableCell>
                          {submission.submitted_by_user_id
                            ? profileMap.get(submission.submitted_by_user_id) || "Unknown User"
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {submission.submitted_at
                            ? format(new Date(submission.submitted_at), "MMM d, yyyy")
                            : "Draft"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {statusLabels[submission.submission_status || "draft"]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewSubmission(submission)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {!isLoading && (!submissions || submissions.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-3">No form submissions yet</p>
                <p className="text-sm text-muted-foreground">
                  Launch a form from the templates on the left.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <FormRunnerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        template={selectedTemplate}
        initialNgoId={ngoId}
      />

      <FormSubmissionDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        submission={selectedSubmission}
        submittedByLabel={
          selectedSubmission?.submitted_by_user_id
            ? profileMap.get(selectedSubmission.submitted_by_user_id)
            : undefined
        }
      />
    </>
  );
}
