import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  useCreateDevelopmentFunder,
  useDevelopmentFunders,
  useUpdateDevelopmentFunder,
  type DevelopmentFunder,
} from "@/hooks/useDevelopmentFunders";
import {
  useCreateDevelopmentOpportunity,
  useDevelopmentOpportunities,
  useUpdateDevelopmentOpportunity,
  type DevelopmentOpportunityWithFunder,
} from "@/hooks/useDevelopmentOpportunities";

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy");
};

export function DevelopmentFundersOpportunities() {
  const { data: funders } = useDevelopmentFunders();
  const { data: opportunities } = useDevelopmentOpportunities();
  const createFunder = useCreateDevelopmentFunder();
  const updateFunder = useUpdateDevelopmentFunder();
  const createOpportunity = useCreateDevelopmentOpportunity();
  const updateOpportunity = useUpdateDevelopmentOpportunity();

  const [funderDialogOpen, setFunderDialogOpen] = useState(false);
  const [opportunityDialogOpen, setOpportunityDialogOpen] = useState(false);
  const [selectedFunder, setSelectedFunder] = useState<DevelopmentFunder | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<DevelopmentOpportunityWithFunder | null>(null);

  const [funderForm, setFunderForm] = useState({
    name: "",
    type: "",
    website: "",
    notes: "",
  });

  const [opportunityForm, setOpportunityForm] = useState({
    name: "",
    funder_id: "",
    program_area: "",
    min_amount: "",
    max_amount: "",
    deadline: "",
    status: "",
    notes: "",
  });

  const resetFunderForm = () => {
    setFunderForm({ name: "", type: "", website: "", notes: "" });
    setSelectedFunder(null);
  };

  const resetOpportunityForm = () => {
    setOpportunityForm({
      name: "",
      funder_id: "",
      program_area: "",
      min_amount: "",
      max_amount: "",
      deadline: "",
      status: "",
      notes: "",
    });
    setSelectedOpportunity(null);
  };

  const handleEditFunder = (funder: DevelopmentFunder) => {
    setSelectedFunder(funder);
    setFunderForm({
      name: funder.name,
      type: funder.type || "",
      website: funder.website || "",
      notes: funder.notes || "",
    });
    setFunderDialogOpen(true);
  };

  const handleEditOpportunity = (opportunity: DevelopmentOpportunityWithFunder) => {
    setSelectedOpportunity(opportunity);
    setOpportunityForm({
      name: opportunity.name,
      funder_id: opportunity.funder_id || "",
      program_area: opportunity.program_area || "",
      min_amount: opportunity.min_amount?.toString() || "",
      max_amount: opportunity.max_amount?.toString() || "",
      deadline: opportunity.deadline || "",
      status: opportunity.status || "",
      notes: opportunity.notes || "",
    });
    setOpportunityDialogOpen(true);
  };

  const handleSaveFunder = async () => {
    if (!funderForm.name) return;
    if (selectedFunder) {
      await updateFunder.mutateAsync({
        id: selectedFunder.id,
        ...funderForm,
      });
    } else {
      await createFunder.mutateAsync(funderForm);
    }
    setFunderDialogOpen(false);
    resetFunderForm();
  };

  const handleSaveOpportunity = async () => {
    if (!opportunityForm.name) return;
    const payload = {
      name: opportunityForm.name,
      funder_id: opportunityForm.funder_id || null,
      program_area: opportunityForm.program_area || null,
      min_amount: opportunityForm.min_amount ? Number(opportunityForm.min_amount) : null,
      max_amount: opportunityForm.max_amount ? Number(opportunityForm.max_amount) : null,
      deadline: opportunityForm.deadline || null,
      status: opportunityForm.status || null,
      notes: opportunityForm.notes || null,
    };

    if (selectedOpportunity) {
      await updateOpportunity.mutateAsync({ id: selectedOpportunity.id, ...payload });
    } else {
      await createOpportunity.mutateAsync(payload);
    }
    setOpportunityDialogOpen(false);
    resetOpportunityForm();
  };

  const funderOptions = useMemo(
    () =>
      (funders || []).map((funder) => ({
        value: funder.id,
        label: funder.name,
      })),
    [funders],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Funders</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              resetFunderForm();
              setFunderDialogOpen(true);
            }}
          >
            Add funder
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funders && funders.length > 0 ? (
                funders.map((funder) => (
                  <TableRow key={funder.id} className="cursor-pointer" onClick={() => handleEditFunder(funder)}>
                    <TableCell className="font-medium">{funder.name}</TableCell>
                    <TableCell>{funder.type || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{funder.website || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{funder.notes || "—"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No funders yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Grant Opportunities</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              resetOpportunityForm();
              setOpportunityDialogOpen(true);
            }}
          >
            Add opportunity
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Funder</TableHead>
                <TableHead>Program area</TableHead>
                <TableHead>Amount range</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities && opportunities.length > 0 ? (
                opportunities.map((opportunity) => (
                  <TableRow
                    key={opportunity.id}
                    className="cursor-pointer"
                    onClick={() => handleEditOpportunity(opportunity)}
                  >
                    <TableCell className="font-medium">{opportunity.name}</TableCell>
                    <TableCell>{opportunity.funder?.name || "—"}</TableCell>
                    <TableCell>{opportunity.program_area || "—"}</TableCell>
                    <TableCell>
                      {opportunity.min_amount || opportunity.max_amount ? (
                        <span>
                          {opportunity.min_amount ? `$${opportunity.min_amount.toLocaleString()}` : "—"} -{" "}
                          {opportunity.max_amount ? `$${opportunity.max_amount.toLocaleString()}` : "—"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{formatDate(opportunity.deadline)}</TableCell>
                    <TableCell>
                      {opportunity.status ? <Badge variant="secondary">{opportunity.status}</Badge> : "—"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No opportunities yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={funderDialogOpen} onOpenChange={setFunderDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedFunder ? "Edit funder" : "Add funder"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Funder name"
              value={funderForm.name}
              onChange={(event) => setFunderForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              placeholder="Type (foundation, government, etc.)"
              value={funderForm.type}
              onChange={(event) => setFunderForm((prev) => ({ ...prev, type: event.target.value }))}
            />
            <Input
              placeholder="Website"
              value={funderForm.website}
              onChange={(event) => setFunderForm((prev) => ({ ...prev, website: event.target.value }))}
            />
            <Textarea
              placeholder="Notes"
              value={funderForm.notes}
              onChange={(event) => setFunderForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFunderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFunder} disabled={!funderForm.name}>
              Save funder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={opportunityDialogOpen} onOpenChange={setOpportunityDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedOpportunity ? "Edit opportunity" : "Add opportunity"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Opportunity name"
              value={opportunityForm.name}
              onChange={(event) => setOpportunityForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Select
              value={opportunityForm.funder_id}
              onValueChange={(value) => setOpportunityForm((prev) => ({ ...prev, funder_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select funder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {funderOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Program area"
              value={opportunityForm.program_area}
              onChange={(event) => setOpportunityForm((prev) => ({ ...prev, program_area: event.target.value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Min amount"
                value={opportunityForm.min_amount}
                onChange={(event) => setOpportunityForm((prev) => ({ ...prev, min_amount: event.target.value }))}
              />
              <Input
                placeholder="Max amount"
                value={opportunityForm.max_amount}
                onChange={(event) => setOpportunityForm((prev) => ({ ...prev, max_amount: event.target.value }))}
              />
            </div>
            <Input
              type="date"
              placeholder="Deadline"
              value={opportunityForm.deadline}
              onChange={(event) => setOpportunityForm((prev) => ({ ...prev, deadline: event.target.value }))}
            />
            <Input
              placeholder="Status"
              value={opportunityForm.status}
              onChange={(event) => setOpportunityForm((prev) => ({ ...prev, status: event.target.value }))}
            />
            <Textarea
              placeholder="Notes"
              value={opportunityForm.notes}
              onChange={(event) => setOpportunityForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpportunityDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOpportunity} disabled={!opportunityForm.name}>
              Save opportunity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
