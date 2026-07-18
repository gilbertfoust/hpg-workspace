import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Send } from "lucide-react";
import type { FormField, FormTemplate } from "@/hooks/useFormTemplates";
import { useSaveFormWorkflow } from "@/hooks/useFormSubmissions";
import { useNGOs } from "@/hooks/useNGOs";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { useUploadFormSubmissionFile } from "@/hooks/useDocuments";
import type { FormWorkflowResult } from "@/hooks/useFormSubmissions";

interface FormRunnerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FormTemplate | null;
  initialNgoId?: string | null;
  initialSubmission?: {
    id: string;
    ngo_id?: string | null;
    payload_json?: Json;
    submission_status?: string | null;
  } | null;
  assignmentId?: string | null;
  onSuccess?: (
    result: FormWorkflowResult,
    payload: Record<string, unknown>,
    submitted: boolean,
  ) => void | Promise<void>;
}

const isEmptyValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const validateFields = (
  fields: FormField[],
  values: Record<string, unknown>,
  pendingFiles: Record<string, File | undefined>,
) => {
  const errors: Record<string, string> = {};

  fields.forEach((field) => {
    const value = field.type === "file" ? pendingFiles[field.name] || values[field.name] : values[field.name];

    if (field.required) {
      if (field.type === "checkbox") {
        if (!value) {
          errors[field.name] = "This field is required.";
        }
      } else if (isEmptyValue(value)) {
        errors[field.name] = "This field is required.";
      }
    }

    if (field.type === "number" && !isEmptyValue(value)) {
      if (Number.isNaN(Number(value))) {
        errors[field.name] = "Enter a valid number.";
      }
    }

    if (field.type === "email" && !isEmptyValue(value)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        errors[field.name] = "Enter a valid email address.";
      }
    }

    if (field.type === "url" && !isEmptyValue(value)) {
      try {
        const parsed = new URL(String(value));
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid");
      } catch {
        errors[field.name] = "Enter a complete URL beginning with http:// or https://.";
      }
    }

    if (field.type === "file" && value instanceof File && value.size > 50 * 1024 * 1024) {
      errors[field.name] = "Files must be 50 MB or smaller.";
    }

    if (typeof value === "string" && field.minLength && value.length < field.minLength) {
      errors[field.name] = `Enter at least ${field.minLength} characters.`;
    }

    if (typeof value === "string" && field.maxLength && value.length > field.maxLength) {
      errors[field.name] = `Use no more than ${field.maxLength} characters.`;
    }
  });

  return errors;
};

const formatNgoLabel = (legalName: string, commonName?: string | null) =>
  commonName ? `${commonName} (${legalName})` : legalName;

export function FormRunnerSheet({
  open,
  onOpenChange,
  template,
  initialNgoId,
  initialSubmission,
  assignmentId,
  onSuccess,
}: FormRunnerSheetProps) {
  const { toast } = useToast();
  const { data: ngos } = useNGOs();
  const saveWorkflow = useSaveFormWorkflow();
  const uploadFormFile = useUploadFormSubmissionFile();

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedNgoId, setSelectedNgoId] = useState<string | null>(initialNgoId || null);
  const [draftSubmissionId, setDraftSubmissionId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File | undefined>>({});
  const submitIdempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    if (open) {
      const initialPayload = initialSubmission?.payload_json;
      setFormData(
        initialPayload && typeof initialPayload === "object" && !Array.isArray(initialPayload)
          ? initialPayload as Record<string, unknown>
          : {}
      );
      setFieldErrors({});
      setSelectedNgoId(initialSubmission?.ngo_id || initialNgoId || null);
      setDraftSubmissionId(initialSubmission?.id || null);
      setPendingFiles({});
      submitIdempotencyKey.current = crypto.randomUUID();
    }
  }, [open, initialNgoId, initialSubmission, template?.id]);

  const fields = useMemo<FormField[]>(
    () => template?.schema_json?.fields || [],
    [template]
  );
  const isLocked = !!initialSubmission?.submission_status && initialSubmission.submission_status !== 'draft';

  const handleFieldChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (name: string, file: File | null) => {
    setPendingFiles((current) => ({ ...current, [name]: file || undefined }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleSave = async (submit: boolean) => {
    if (!template) return;

    if (submit) {
      const errors = validateFields(fields, formData, pendingFiles);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        toast({
          variant: "destructive",
          title: "Missing required fields",
          description: "Please complete the required fields before submitting.",
        });
        return;
      }
    }

    setFieldErrors({});

    try {
      const answeredFields = fields.filter((field) => !isEmptyValue(pendingFiles[field.name] || formData[field.name])).length;
      const progress = fields.length === 0 ? 100 : Math.round((answeredFields / fields.length) * 100);
      let submissionId = draftSubmissionId;
      const nextPayload = { ...formData };
      const filesToUpload = Object.entries(pendingFiles).filter((entry): entry is [string, File] => entry[1] instanceof File);

      if (filesToUpload.length > 0) {
        const reserved = await saveWorkflow.mutateAsync({
          formTemplateId: template.id,
          ngoId: selectedNgoId,
          submissionId,
          payloadJson: nextPayload as Json,
          progress,
          submit: false,
          assignmentId,
          suppressToast: true,
        });
        submissionId = reserved.submission.id;

        for (const [fieldName, file] of filesToUpload) {
          const document = await uploadFormFile.mutateAsync({
            file,
            submissionId,
            formTemplateId: template.id,
            fieldName,
            module: template.module,
            ngoId: selectedNgoId,
          });
          nextPayload[fieldName] = {
            document_id: document.id,
            name: document.file_name,
            size: document.file_size,
            type: document.file_type,
          };
        }
        setFormData(nextPayload);
        setPendingFiles({});
      }

      const result = await saveWorkflow.mutateAsync({
        formTemplateId: template.id,
        ngoId: selectedNgoId,
        submissionId,
        payloadJson: nextPayload as Json,
        progress,
        submit,
        assignmentId,
        idempotencyKey: submitIdempotencyKey.current,
      });

      if (!submit) {
        setDraftSubmissionId(result.submission.id);
        await onSuccess?.(result, nextPayload, false);
        return;
      }

      setFormData({});
      setFieldErrors({});
      setDraftSubmissionId(null);
      await onSuccess?.(result, nextPayload, true);
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: submit ? "Submission failed" : "Draft save failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const isSaving = saveWorkflow.isPending || uploadFormFile.isPending;

  const ngoOptions = useMemo(
    () =>
      (ngos || [])
        .slice()
        .sort((a, b) =>
          formatNgoLabel(a.legal_name, a.common_name).localeCompare(
            formatNgoLabel(b.legal_name, b.common_name)
          )
        ),
    [ngos]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{template?.name || "Form"}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            {template?.description || "Fill out the form below"}
            {template?.module && (
              <Badge variant="outline" className="capitalize">
                {template.module.replace(/_/g, " ")}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        <ScrollArea className="h-[calc(100vh-260px)] pr-4">
          <div className="space-y-6">
            {!initialNgoId && (
              <div className="space-y-2">
                <p className="text-sm font-medium">NGO (optional)</p>
                <Select
                  value={selectedNgoId || "none"}
                  onValueChange={(value) =>
                    setSelectedNgoId(value === "none" ? null : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an NGO" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No NGO</SelectItem>
                    {ngoOptions.map((ngo) => (
                      <SelectItem key={ngo.id} value={ngo.id}>
                        {formatNgoLabel(ngo.legal_name, ngo.common_name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <FormRenderer
              fields={fields}
              values={formData}
              errors={fieldErrors}
              onChange={handleFieldChange}
              pendingFiles={pendingFiles}
              onFileChange={handleFileChange}
              readOnly={isLocked}
            />
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        <div className="flex gap-3 justify-end">
          {isLocked ? (
            <>
              <p className="mr-auto self-center text-sm text-muted-foreground">This submission is locked for department review.</p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </>
          ) : (
            <>
          {draftSubmissionId && (
            <p className="mr-auto self-center text-xs text-muted-foreground">
              Private draft saved
            </p>
          )}
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Submit
          </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
