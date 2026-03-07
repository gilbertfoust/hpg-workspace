import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getTemplateGroupId,
  useAdminConfigTemplateGroups,
  useAdminConfigTemplates,
  useUpdateTemplateGroupAssignment,
  useUpdateTemplateMetadata,
} from '@/hooks/useAdminConfigTemplates';

interface TemplateRowProps {
  templateId: string;
  description: string | null;
  onSave: (id: string, description: string) => void;
  isSaving: boolean;
}

const TemplateDescriptionEditor = ({
  templateId,
  description,
  onSave,
  isSaving,
}: TemplateRowProps) => {
  const [value, setValue] = useState(description ?? '');

  useEffect(() => {
    setValue(description ?? '');
  }, [description]);

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-w-[220px]"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => onSave(templateId, value)}
        disabled={isSaving}
      >
        Save
      </Button>
    </div>
  );
};

export default function TemplatesManager() {
  const { data: templates = [], isLoading, error } = useAdminConfigTemplates();
  const { data: groups = [] } = useAdminConfigTemplateGroups();
  const updateTemplate = useUpdateTemplateMetadata();
  const updateGroup = useUpdateTemplateGroupAssignment();

  const groupOptions = useMemo(() => {
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
    }));
  }, [groups]);

  const handleDescriptionSave = (id: string, description: string) => {
    updateTemplate.mutate({ id, description });
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            Manage template metadata and group assignments. Schema editing will be added later.
          </CardDescription>
          {/* TODO: Add schema JSON editor for templates in a future iteration. */}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading templates...</p>}
        {error && (
          <p className="text-sm text-destructive">
            {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="capitalize">
                    {template.module.replace('_', ' ')}
                  </TableCell>
                  <TableCell>
                    <TemplateDescriptionEditor
                      templateId={template.id}
                      description={template.description}
                      onSave={handleDescriptionSave}
                      isSaving={updateTemplate.isPending}
                    />
                  </TableCell>
                  <TableCell>{template.version ?? '—'}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Label className="sr-only" htmlFor={`group-${template.id}`}>
                        Template group
                      </Label>
                      <Select
                        value={getTemplateGroupId(template.id, groups) ?? 'unassigned'}
                        onValueChange={(value) =>
                          updateGroup.mutate({
                            templateId: template.id,
                            groupId: value === 'unassigned' ? null : value,
                          })
                        }
                      >
                        <SelectTrigger id={`group-${template.id}`}>
                          <SelectValue placeholder="Assign group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {groupOptions.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={template.is_active ?? false}
                      onCheckedChange={(checked) =>
                        updateTemplate.mutate({ id: template.id, is_active: checked })
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
