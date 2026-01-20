import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import {
  CreateJobRequisitionInput,
  JobRequisition,
  RequisitionStatus,
  useCreateHRRequisition,
  useDeleteHRRequisition,
  useHRRequisitions,
  useUpdateHRRequisition,
} from "@/hooks/useHRRequisitions";

const statusOptions: RequisitionStatus[] = ["Open", "Paused", "Closed"];

const emptyForm: CreateJobRequisitionInput = {
  title: "",
  department_id: null,
  location: "",
  employment_type: "",
  status: "Open",
  description: "",
};

export function HRRequisitionsSection() {
  const { data: requisitions = [], isLoading } = useHRRequisitions();
  const { data: orgUnits = [] } = useOrgUnits();
  const createRequisition = useCreateHRRequisition();
  const updateRequisition = useUpdateHRRequisition();
  const deleteRequisition = useDeleteHRRequisition();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState<JobRequisition | null>(null);
  const [formState, setFormState] = useState<CreateJobRequisitionInput>(emptyForm);
  const [requisitionToDelete, setRequisitionToDelete] = useState<JobRequisition | null>(null);

  const departmentMap = useMemo(() => {
    return new Map(orgUnits.map((unit) => [unit.id, unit.department_name]));
  }, [orgUnits]);

  const openCreateDialog = () => {
    setEditingRequisition(null);
    setFormState(emptyForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (requisition: JobRequisition) => {
    setEditingRequisition(requisition);
    setFormState({
      title: requisition.title,
      department_id: requisition.department_id,
      location: requisition.location ?? "",
      employment_type: requisition.employment_type ?? "",
      status: requisition.status,
      description: requisition.description ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formState.title.trim()) return;

    if (editingRequisition) {
      await updateRequisition.mutateAsync({
        id: editingRequisition.id,
        ...formState,
      });
    } else {
      await createRequisition.mutateAsync(formState);
    }

    setIsDialogOpen(false);
    setEditingRequisition(null);
    setFormState(emptyForm);
  };

  const handleDelete = async () => {
    if (!requisitionToDelete) return;
    await deleteRequisition.mutateAsync(requisitionToDelete.id);
    setRequisitionToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Job Requisitions</h2>
          <p className="text-sm text-muted-foreground">Track open roles and hiring needs.</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          New Requisition
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Employment Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Loading requisitions...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && requisitions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No requisitions yet. Add one to start hiring.
                </TableCell>
              </TableRow>
            )}
            {requisitions.map((requisition) => (
              <TableRow key={requisition.id}>
                <TableCell className="font-medium text-foreground">{requisition.title}</TableCell>
                <TableCell>{departmentMap.get(requisition.department_id ?? "") ?? "Unassigned"}</TableCell>
                <TableCell>{requisition.location ?? "—"}</TableCell>
                <TableCell>{requisition.employment_type ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={requisition.status === "Open" ? "default" : "secondary"}>
                    {requisition.status}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(requisition.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(requisition)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRequisitionToDelete(requisition)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingRequisition ? "Edit Requisition" : "New Requisition"}</DialogTitle>
            <DialogDescription>
              Capture the essentials for this role so the recruiting pipeline can move quickly.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="requisition-title">Title</Label>
              <Input
                id="requisition-title"
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Program Manager"
              />
            </div>
            <div className="grid gap-2">
              <Label>Department</Label>
              <Select
                value={formState.department_id ?? ""}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, department_id: value || null }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {orgUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="requisition-location">Location</Label>
                <Input
                  id="requisition-location"
                  value={formState.location ?? ""}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, location: event.target.value }))
                  }
                  placeholder="Remote / Nairobi"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="requisition-type">Employment Type</Label>
                <Input
                  id="requisition-type"
                  value={formState.employment_type ?? ""}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, employment_type: event.target.value }))
                  }
                  placeholder="Full-time"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={formState.status ?? "Open"}
                onValueChange={(value: RequisitionStatus) =>
                  setFormState((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="requisition-description">Description</Label>
              <Textarea
                id="requisition-description"
                value={formState.description ?? ""}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Role summary and responsibilities"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formState.title.trim()}>
              {editingRequisition ? "Save changes" : "Create requisition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!requisitionToDelete} onOpenChange={() => setRequisitionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete requisition?</AlertDialogTitle>
            <AlertDialogDescription>
              This action removes the requisition and its history from the HR dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
