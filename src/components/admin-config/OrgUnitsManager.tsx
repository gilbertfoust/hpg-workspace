import { useMemo, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  OrgUnitWithLead,
  useAdminConfigOrgUnits,
  useCreateOrgUnit,
  useDeleteOrgUnit,
  useUpdateOrgUnit,
} from '@/hooks/useAdminConfigOrgUnits';
import { useProfiles } from '@/hooks/useProfiles';

const emptyForm = {
  department_name: '',
  sub_department_name: '',
  lead_user_id: 'unassigned',
};

export default function OrgUnitsManager() {
  const { data: orgUnits = [], isLoading, error } = useAdminConfigOrgUnits();
  const { data: profiles = [] } = useProfiles();
  const createOrgUnit = useCreateOrgUnit();
  const updateOrgUnit = useUpdateOrgUnit();
  const deleteOrgUnit = useDeleteOrgUnit();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState(emptyForm);
  const [editingOrgUnit, setEditingOrgUnit] = useState<OrgUnitWithLead | null>(null);

  const profileOptions = useMemo(() => {
    return profiles.map((profile) => ({
      id: profile.id,
      label: profile.full_name || profile.email || profile.id,
    }));
  }, [profiles]);

  const resetForm = () => {
    setFormState(emptyForm);
    setEditingOrgUnit(null);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleEdit = (orgUnit: OrgUnitWithLead) => {
    setEditingOrgUnit(orgUnit);
    setFormState({
      department_name: orgUnit.department_name,
      sub_department_name: orgUnit.sub_department_name ?? '',
      lead_user_id: orgUnit.lead_user_id ?? 'unassigned',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      department_name: formState.department_name.trim(),
      sub_department_name: formState.sub_department_name.trim() || null,
      lead_user_id: formState.lead_user_id === 'unassigned' ? null : formState.lead_user_id,
    };

    if (editingOrgUnit) {
      await updateOrgUnit.mutateAsync({ id: editingOrgUnit.id, ...payload });
    } else {
      await createOrgUnit.mutateAsync(payload);
    }

    setDialogOpen(false);
    resetForm();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Departments & Sub-Departments</CardTitle>
            <CardDescription>Maintain org unit structure and lead assignments.</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add org unit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingOrgUnit ? 'Edit org unit' : 'Add org unit'}</DialogTitle>
                <DialogDescription>
                  Set the department and optional sub-department. Assign a lead if needed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="department_name">Department name</Label>
                  <Input
                    id="department_name"
                    value={formState.department_name}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, department_name: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sub_department_name">Sub-department</Label>
                  <Input
                    id="sub_department_name"
                    value={formState.sub_department_name}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, sub_department_name: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead_user_id">Lead</Label>
                  <Select
                    value={formState.lead_user_id}
                    onValueChange={(value) =>
                      setFormState((prev) => ({ ...prev, lead_user_id: value }))
                    }
                  >
                    <SelectTrigger id="lead_user_id">
                      <SelectValue placeholder="Select a lead" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {profileOptions.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!formState.department_name.trim()}
                >
                  {editingOrgUnit ? 'Save changes' : 'Create org unit'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading org units...</p>}
        {error && (
          <p className="text-sm text-destructive">
            {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Sub-department</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgUnits.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.department_name}</TableCell>
                  <TableCell>{unit.sub_department_name ?? '—'}</TableCell>
                  <TableCell>
                    {unit.lead?.full_name || unit.lead?.email || 'Unassigned'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(unit)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove org unit?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action permanently deletes the org unit because no inactive flag
                              is available in the schema.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteOrgUnit.mutate(unit.id)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
