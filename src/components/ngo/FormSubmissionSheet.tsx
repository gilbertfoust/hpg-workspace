import { FormRunnerSheet } from "@/components/forms/FormRunnerSheet";
import type { FormSubmission } from "@/hooks/useFormSubmissions";
import type { FormTemplate } from "@/hooks/useFormTemplates";
import type { ModuleType } from "@/hooks/useWorkItems";

interface WorkItemConfig {
  title: string;
  type: string;
  description?: string;
  module: ModuleType;
  ngoId?: string;
  external_visible?: boolean;
}

interface FormSubmissionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FormTemplate | null;
  submission?: FormSubmission | null;
  ngoId: string;
  initialValues?: Record<string, unknown>;
  onSubmitSuccess?: (
    submission: FormSubmission,
    payload: Record<string, unknown>,
    submitted: boolean,
  ) => void | Promise<void>;
  workItemConfig?: WorkItemConfig;
  assignmentId?: string | null;
}

/**
 * Compatibility adapter for NGO cards and work-item drawers. All form entry
 * points now use FormRunnerSheet and the same private-draft/atomic-submit RPCs.
 * workItemConfig is retained for call-site compatibility; department routing
 * is governed by the template instead of client-created work items.
 */
export function FormSubmissionSheet({
  open,
  onOpenChange,
  template,
  submission,
  ngoId,
  initialValues,
  onSubmitSuccess,
  assignmentId,
}: FormSubmissionSheetProps) {
  const payload = submission?.payload_json && typeof submission.payload_json === "object"
    ? submission.payload_json
    : initialValues;

  return (
    <FormRunnerSheet
      open={open}
      onOpenChange={onOpenChange}
      template={template}
      initialNgoId={ngoId}
      assignmentId={assignmentId}
      initialSubmission={submission ? {
        id: submission.id,
        ngo_id: submission.ngo_id,
        payload_json: payload as FormSubmission["payload_json"],
        submission_status: submission.submission_status,
      } : payload ? {
        id: "",
        ngo_id: ngoId,
        payload_json: payload as FormSubmission["payload_json"],
        submission_status: 'draft',
      } : null}
      onSuccess={async (result, values, submitted) => {
        await onSubmitSuccess?.(result.submission, values, submitted);
      }}
    />
  );
}
