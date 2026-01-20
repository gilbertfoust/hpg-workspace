import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FormField } from "@/hooks/useFormTemplates";

interface FormRendererProps {
  fields: FormField[];
  values: Record<string, unknown>;
  errors?: Record<string, string>;
  readOnly?: boolean;
  onChange: (name: string, value: unknown) => void;
}

export function FormRenderer({
  fields,
  values,
  errors = {},
  readOnly = false,
  onChange,
}: FormRendererProps) {
  const handleMultiSelectToggle = (name: string, option: string) => {
    const current = (values[name] as string[]) || [];
    const updated = current.includes(option)
      ? current.filter((value) => value !== option)
      : [...current, option];
    onChange(name, updated);
  };

  const renderField = (field: FormField) => {
    const value = values[field.name];

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
            onChange={(event) => onChange(field.name, event.target.value)}
            disabled={readOnly}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={(value as string) || ""}
            onChange={(event) => onChange(field.name, event.target.value)}
            disabled={readOnly}
          />
        );

      case "textarea":
        return (
          <Textarea
            value={(value as string) || ""}
            onChange={(event) => onChange(field.name, event.target.value)}
            disabled={readOnly}
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
              onCheckedChange={(checked) => onChange(field.name, checked)}
              disabled={readOnly}
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
            onValueChange={(nextValue) => onChange(field.name, nextValue)}
            disabled={readOnly}
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

      case "multiselect":
        const selected = (value as string[]) || [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {field.options?.map((option) => (
                <Badge
                  key={option}
                  variant={selected.includes(option) ? "default" : "outline"}
                  className={`cursor-pointer ${readOnly ? "opacity-50" : ""}`}
                  onClick={() => !readOnly && handleMultiSelectToggle(field.name, option)}
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

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {renderField(field)}
          {errors[field.name] && (
            <p className="text-xs text-destructive">{errors[field.name]}</p>
          )}
        </div>
      ))}

      {fields.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          This form has no fields configured.
        </p>
      )}
    </div>
  );
}
