import { useCallback, useEffect, useState } from "react";
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
  Eye,
  CalendarCheck
} from "lucide-react";
import { format } from "date-fns";
import { useFormTemplates, FormTemplate, useEnsureFormTemplate } from "@/hooks/useFormTemplates";
import { useCreateFormRevision, useFormSubmissions, FormSubmission } from "@/hooks/useFormSubmissions";
import { FormSubmissionSheet } from "./FormSubmissionSheet";
import { monthlyCheckInTemplate } from "./ngoFormTemplates";
import { useFormAssignments } from "@/hooks/useFormAssignments";

interface NGOFormsTabProps {
  ngoId: string;
  launchMonthlyCheckIn?: boolean;
  onMonthlyCheckInHandled?: () => void;
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

export function NGOFormsTab({ ngoId, launchMonthlyCheckIn, onMonthlyCheckInHandled }: NGOFormsTabProps) {
  const { data: templates, isLoading: templatesLoading } = useFormTemplates();
  const { data: submissions, isLoading: submissionsLoading } = useFormSubmissions({ ngo_id: ngoId });
  const { data: assignments = [], isLoading: assignmentsLoading } = useFormAssignments({ ngoId });
  const ensureTemplate = useEnsureFormTemplate();
  const createRevision = useCreateFormRevision();
  
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const isLoading = templatesLoading || submissionsLoading || assignmentsLoading;
  const activeTemplates = templates?.filter((t) => t.is_active) || [];

  const handleStartForm = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setSelectedSubmission(null);
    setSelectedAssignmentId(null);
    setInitialValues(undefined);
    setSheetOpen(true);
  };

  const handleStartAssignment = async (assignmentId: string) => {
    const assignment = assignments.find((row) => row.id === assignmentId);
    if (!assignment?.form_template) return;
    let existingSubmission = submissions?.find((row) => row.id === assignment.submission_id) || null;
    if (assignment.status === 'needs_revision' && existingSubmission?.submission_status === 'rejected') {
      existingSubmission = await createRevision.mutateAsync(existingSubmission.id);
    }
    setSelectedTemplate(assignment.form_template);
    setSelectedSubmission(existingSubmission);
    setSelectedAssignmentId(assignment.id);
    setInitialValues(undefined);
    setSheetOpen(true);
  };

  const handleViewSubmission = (submission: FormSubmission) => {
    const template = templates?.find((t) => t.id === submission.form_template_id);
    if (template) {
      setSelectedTemplate(template);
      setSelectedSubmission(submission);
      setSelectedAssignmentId(submission.assignment_id || null);
      setInitialValues(undefined);
      setSheetOpen(true);
    }
  };

  const handleMonthlyCheckIn = useCallback(async () => {
    const template = await ensureTemplate.mutateAsync(monthlyCheckInTemplate);
    const today = new Date();
    setSelectedTemplate(template);
    setSelectedSubmission(null);
    setSelectedAssignmentId(null);
    setInitialValues({
      date: format(today, "yyyy-MM-dd"),
      period: format(today, "MMMM yyyy"),
    });
    setSheetOpen(true);
  }, [ensureTemplate]);

  useEffect(() => {
    if (launchMonthlyCheckIn) {
      handleMonthlyCheckIn().finally(() => onMonthlyCheckInHandled?.());
    }
  }, [handleMonthlyCheckIn, launchMonthlyCheckIn, onMonthlyCheckInHandled]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {assignments.some((assignment) => !['accepted', 'cancelled', 'waived'].includes(assignment.status)) && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">Assigned Forms</h3>
              {assignments.filter((assignment) => !['accepted', 'cancelled', 'waived'].includes(assignment.status)).map((assignment) => (
                <Card key={assignment.id} className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-medium">{assignment.form_template?.name || 'Assigned form'}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">{assignment.instructions || 'Complete this form for HPG review.'}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="capitalize">{assignment.status.replace(/_/g, ' ')}</Badge>
                          {assignment.due_at && <Badge variant="outline">Due {format(new Date(assignment.due_at), 'MMM d, yyyy')}</Badge>}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => void handleStartAssignment(assignment.id)} disabled={!assignment.form_template || createRevision.isPending}>
                        {assignment.status === 'assigned' ? 'Start' : assignment.status === 'submitted' ? 'View' : 'Continue'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Available Forms</h3>
            <Button size="sm" variant="outline" onClick={handleMonthlyCheckIn} disabled={ensureTemplate.isPending}>
              <CalendarCheck className="w-4 h-4 mr-2" />
              Monthly Check-in
            </Button>
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
                        Launch
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
                              : `Last edited ${format(new Date(submission.updated_at), "MMM d, yyyy")}`}
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
        initialValues={(selectedSubmission?.payload_json as Record<string, unknown> | undefined) ?? undefined}
        assignmentId={selectedAssignmentId}
      />
    </>
  );
}
