import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FormField, FormTemplate } from "@/hooks/useFormTemplates";
import { useAdminUpsertFormTemplate } from "@/hooks/useFormTemplates";
import type { ModuleType } from "@/hooks/useWorkItems";

interface FormTemplateBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: FormTemplate | null;
}

const modules: Array<{ value: ModuleType; label: string }> = [
  ['ngo_coordination', 'NGO Coordination'], ['administration', 'Administration'],
  ['operations', 'Operations'], ['program', 'Program'], ['curriculum', 'Curriculum'],
  ['development', 'Development'], ['partnership', 'Partnerships'], ['marketing', 'Marketing'],
  ['communications', 'Communications'], ['hr', 'Human Resources'], ['it', 'Technology'],
  ['finance', 'Finance'], ['legal', 'Legal / Compliance'],
].map(([value, label]) => ({ value: value as ModuleType, label }));

const fieldTypes: FormField['type'][] = [
  'text', 'textarea', 'email', 'tel', 'url', 'number', 'date',
  'select', 'multiselect', 'checkbox', 'file',
];

const emptyField = (): FormField => ({
  name: `field_${crypto.randomUUID().slice(0, 8)}`,
  type: 'text',
  label: 'New field',
  required: false,
});

export function FormTemplateBuilderDialog({ open, onOpenChange, template }: FormTemplateBuilderDialogProps) {
  const saveTemplate = useAdminUpsertFormTemplate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [module, setModule] = useState<ModuleType>('ngo_coordination');
  const [audience, setAudience] = useState<'staff' | 'ngo_portal'>('staff');
  const [active, setActive] = useState(true);
  const [fields, setFields] = useState<FormField[]>([emptyField()]);

  useEffect(() => {
    if (!open) return;
    setName(template?.name || '');
    setDescription(template?.description || '');
    setModule(template?.module || 'ngo_coordination');
    setAudience(template?.form_audience || 'staff');
    setActive(template?.is_active ?? true);
    setFields(template?.schema_json?.fields?.length ? template.schema_json.fields : [emptyField()]);
  }, [open, template]);

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields((current) => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...updates } : field));
  };

  const handleSave = async () => {
    await saveTemplate.mutateAsync({
      templateId: template?.id,
      name,
      description,
      module,
      fields: fields.map((field) => ({
        ...field,
        name: field.name.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        label: field.label.trim(),
      })),
      mappingJson: template?.mapping_json || {},
      formAudience: audience,
      intakeModule: audience === 'ngo_portal' ? 'ngo_coordination' : module,
      isActive: active,
    });
    onOpenChange(false);
  };

  const invalid = !name.trim() || fields.length === 0 || fields.some((field) =>
    !field.name.trim() || !field.label.trim()
    || ((field.type === 'select' || field.type === 'multiselect') && !field.options?.length)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Publish a new form version' : 'Create HPG form'}</DialogTitle>
          <DialogDescription>
            Configure the form, publish it to staff or NGO users, then assign it to the appropriate NGO.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="form-name">Form name</Label>
            <Input id="form-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Responsible department</Label>
            <Select value={module} onValueChange={(value) => setModule(value as ModuleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{modules.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="form-description">Instructions</Label>
            <Textarea id="form-description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={(value) => setAudience(value as 'staff' | 'ngo_portal')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">HPG staff</SelectItem>
                <SelectItem value="ngo_portal">NGO portal and HPG staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-7">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Published and available</Label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold">Fields</h3><p className="text-sm text-muted-foreground">Required fields are enforced in both the browser and database.</p></div>
            <Button type="button" variant="outline" size="sm" onClick={() => setFields((current) => [...current, emptyField()])}>
              <Plus className="mr-2 h-4 w-4" />Add field
            </Button>
          </div>
          {fields.map((field, index) => (
            <div key={`${field.name}-${index}`} className="grid gap-3 rounded-lg border p-4 md:grid-cols-12">
              <div className="space-y-2 md:col-span-3">
                <Label>Label</Label>
                <Input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Field key</Label>
                <Input value={field.name} onChange={(event) => updateField(index, { name: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Type</Label>
                <Select value={field.type} onValueChange={(value) => updateField(index, { type: value as FormField['type'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{fieldTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-7 md:col-span-2">
                <Switch checked={field.required || false} onCheckedChange={(checked) => updateField(index, { required: checked })} />
                <Label>Required</Label>
              </div>
              <div className="pt-6 text-right md:col-span-2">
                <Button type="button" variant="ghost" size="icon" onClick={() => setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index))} disabled={fields.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {(field.type === 'select' || field.type === 'multiselect') && (
                <div className="space-y-2 md:col-span-12">
                  <Label>Options (comma separated)</Label>
                  <Input
                    value={(field.options || []).join(', ')}
                    onChange={(event) => updateField(index, { options: event.target.value.split(',').map((option) => option.trim()).filter(Boolean) })}
                  />
                </div>
              )}
              {field.type === 'file' && (
                <div className="space-y-2 md:col-span-12">
                  <Label>Accepted file types (optional)</Label>
                  <Input placeholder=".pdf,.doc,.docx,image/*" value={field.accept || ''} onChange={(event) => updateField(index, { accept: event.target.value })} />
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={invalid || saveTemplate.isPending}>
            <Save className="mr-2 h-4 w-4" />{saveTemplate.isPending ? 'Publishing…' : 'Publish form'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
