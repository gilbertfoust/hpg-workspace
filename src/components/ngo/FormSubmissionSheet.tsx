import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Save, Send, Loader2 } from "lucide-react";
import { FormTemplate, FormField } from "@/hooks/useFormTemplates";
import { FormSubmission, useCreateFormSubmission, useUpdateFormSubmission } from "@/hooks/useFormSubmissions";
import { ModuleType, useCreateWorkItem } from "@/hooks/useWorkItems";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

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
  workItemConfig?: WorkItemConfig;
}

export function FormSubmissionSheet({
  open,
  onOpenChange,
  template,
  submission,
  ngoId,
  workItemConfig,
}: FormSubmissionSheetProps) {
  const { user } = useAuth();
  const createMutation = useCreateFormSubmission();
  const updateMutation = useUpdateFormSubmission();
  const createWorkItem = useCreateWorkItem();
  
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const isEditing = !!submission;
  const isSubmitted = submission?.submission_status === "submitted" || 
                      submission?.submission_status === "accepted";

  // Initialize form data from submission or empty
  useEffect(() => {
    if (submission?.payload_json && typeof submission.payload_json === 'object') {
      setFormData(submission.payload_json as Record<string, unknown>);
    } else {
      setFormData({});
    }
  }, [submission, template]);

  const fields: FormField[] = template?.schema_json?.fields || [];

  const handleFieldChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMultiSelectToggle = (name: string, option: string) => {
    const current = (formData[name] as string[]) || [];
    const updated = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    handleFieldChange(name, updated);
  };

  const handleSave = async (submit: boolean = false) => {
    if (!template) return;

    const payload: Json = formData as Json;
    const status = submit ? "submitted" : "draft";
    let workItemId = submission?.work_item_id ?? undefined;

    if (submit && workItemConfig && !workItemId) {
      const workItem = await createWorkItem.mutateAsync({
        title: workItemConfig.title,
        module: workItemConfig.module,
        type: workItemConfig.type,
        ngo_id: workItemConfig.ngoId ?? ngoId,
        description: workItemConfig.description,
        external_visible: workItemConfig.external_visible,
      });
      workItemId = workItem.id;
    }

    if (isEditing && submission) {
      const updatePayload: Partial<FormSubmission> = {
        payload_json: payload,
        submission_status: status,
        submitted_at: submit ? new Date().toISOString() : submission.submitted_at,
      };

      if (submit && workItemId && !submission.work_item_id) {
        updatePayload.work_item_id = workItemId;
      }

      await updateMutation.mutateAsync({
        id: submission.id,
        ...updatePayload,
      });
    } else {
      await createMutation.mutateAsync({
        form_template_id: template.id,
        ngo_id: ngoId,
        work_item_id: workItemId,
        submitted_by_user_id: user?.id,
        payload_json: payload,
        submission_status: status,
      });
    }

    onOpenChange(false);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || createWorkItem.isPending;

  const renderField = (field: FormField) => {
    const value = formData[field.name];
    const isDisabled = isSubmitted;

    switch (field.type) {
      case "text":
      case "email":
      case "tel":
      case "url":
      case "number":
        return (
          <Input
            type={field.type}
            value={(value as string) || ""}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            disabled={isDisabled}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={(value as string) || ""}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            disabled={isDisabled}
          />
        );

      case "textarea":
        return (
          <Textarea
            value={(value as string) || ""}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            disabled={isDisabled}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            rows={3}
          />
        );

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
              disabled={isDisabled}
            />
            <label
              htmlFor={field.name}
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Yes
            </label>
          </div>
        );

      case "select":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => handleFieldChange(field.name, v)}
            disabled={isDisabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multiselect": {
        const selected = (value as string[]) || [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {field.options?.map((option) => (
                <Badge
                  key={option}
                  variant={selected.includes(option) ? "default" : "outline"}
                  className={`cursor-pointer ${isDisabled ? 'opacity-50' : ''}`}
                  onClick={() => !isDisabled && handleMultiSelectToggle(field.name, option)}
                >
                  {option}
                </Badge>
              ))}
            </div>
            {selected.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Selected: {selected.join(", ")}
              </p>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{template?.name || "Form"}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            {template?.description || "Fill out the form below"}
            {isEditing && (
              <Badge variant="outline" className="capitalize">
                {submission?.submission_status || "draft"}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        <ScrollArea className="h-[calc(100vh-220px)] pr-4">
          <div className="space-y-6">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {renderField(field)}
              </div>
            ))}

            {fields.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                This form has no fields configured.
              </p>
            )}
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        {!isSubmitted && (
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit
            </Button>
          </div>
        )}

        {isSubmitted && (
          <p className="text-center text-muted-foreground text-sm">
            This form has been submitted and cannot be edited.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
