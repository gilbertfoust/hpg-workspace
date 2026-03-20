import { useEffect, useMemo, useState } from "react";
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
import { useCreateFormSubmission } from "@/hooks/useFormSubmissions";
import { useCreateWorkItem, useUpdateWorkItem } from "@/hooks/useWorkItems";
import { useAuth } from "@/contexts/AuthContext";
import { useNGOs } from "@/hooks/useNGOs";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { buildWorkItemPlan } from "@/lib/formMapping";

interface FormRunnerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FormTemplate | null;
  initialNgoId?: string | null;
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

const removeUndefined = <T extends Record<string, unknown>>(input: T) => {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as T;
};

export function FormRunnerSheet({
  open,
  onOpenChange,
  template,
  initialNgoId,
}: FormRunnerSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: ngos } = useNGOs();

  const createSubmission = useCreateFormSubmission();
  const createWorkItem = useCreateWorkItem();
  const updateWorkItem = useUpdateWorkItem();

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedNgoId, setSelectedNgoId] = useState<string | null>(initialNgoId || null);

  useEffect(() => {
    if (open) {
      setFormData({});
      setFieldErrors({});
      setSelectedNgoId(initialNgoId || null);
    }
  }, [open, initialNgoId, template?.id]);

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

    const plan = buildWorkItemPlan(template, formData, selectedNgoId);
    let workItemId = plan.workItemId;

    if (plan.action === "create" && plan.createInput) {
      const created = await createWorkItem.mutateAsync(plan.createInput);
      workItemId = created.id;
    }

    if (plan.action === "update" && plan.workItemId) {
      const updateInput = plan.updateInput ? removeUndefined(plan.updateInput) : {};
      if (Object.keys(updateInput).length > 0) {
        await updateWorkItem.mutateAsync({ id: plan.workItemId, ...updateInput });
      }
    }

    const payload: Json = formData as Json;

    await createSubmission.mutateAsync({
      form_template_id: template.id,
      ngo_id: selectedNgoId || undefined,
      work_item_id: workItemId,
      submitted_by_user_id: user?.id,
      payload_json: payload,
      submission_status: submit ? "submitted" : "draft",
      submitted_at: submit ? new Date().toISOString() : null,
    });

    onOpenChange(false);
  };

  const isSaving =
    createSubmission.isPending || createWorkItem.isPending || updateWorkItem.isPending;

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
