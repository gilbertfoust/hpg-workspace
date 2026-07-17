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

interface FormRunnerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FormTemplate | null;
  initialNgoId?: string | null;
  initialSubmission?: {
    id: string;
    ngo_id?: string | null;
    payload_json?: Json;
  } | null;
}

const isEmptyValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const validateFields = (fields: FormField[], values: Record<string, unknown>) => {
  const errors: Record<string, string> = {};

  fields.forEach((field) => {
    const value = values[field.name];

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
}: FormRunnerSheetProps) {
  const { toast } = useToast();
  const { data: ngos } = useNGOs();
  const saveWorkflow = useSaveFormWorkflow();

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedNgoId, setSelectedNgoId] = useState<string | null>(initialNgoId || null);
  const [draftSubmissionId, setDraftSubmissionId] = useState<string | null>(null);
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
      submitIdempotencyKey.current = crypto.randomUUID();
    }
  }, [open, initialNgoId, initialSubmission, template?.id]);

  const fields = useMemo<FormField[]>(
    () => template?.schema_json?.fields || [],
    [template]
  );

  const handleFieldChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (submit: boolean) => {
    if (!template) return;

    if (submit) {
      const errors = validateFields(fields, formData);
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
      const answeredFields = fields.filter((field) => !isEmptyValue(formData[field.name])).length;
      const progress = fields.length === 0 ? 100 : Math.round((answeredFields / fields.length) * 100);
      const result = await saveWorkflow.mutateAsync({
        formTemplateId: template.id,
        ngoId: selectedNgoId,
        submissionId: draftSubmissionId,
        payloadJson: formData as Json,
        progress,
        submit,
        idempotencyKey: submitIdempotencyKey.current,
      });

      if (!submit) {
        setDraftSubmissionId(result.submission.id);
        return;
      }

      setFormData({});
      setFieldErrors({});
      setDraftSubmissionId(null);
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: submit ? "Submission failed" : "Draft save failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const isSaving = saveWorkflow.isPending;

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
            />
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        <div className="flex gap-3 justify-end">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
