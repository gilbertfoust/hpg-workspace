import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfiles } from "@/hooks/useProfiles";
import { useCreateOrgUnit, useOrgUnits, useUpdateOrgUnit } from "@/hooks/useOrgUnits";
import { useIsAdminUser } from "@/hooks/useUserRole";

interface UserSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  profiles: ReturnType<typeof useProfiles>["data"] | undefined;
}

const UserSelect = ({ value, onChange, disabled, profiles = [] }: UserSelectProps) => {
  const [open, setOpen] = useState(false);
  const selectedProfile = profiles?.find((profile) => profile.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-[240px] justify-between"
          disabled={disabled}
        >
          {selectedProfile?.full_name || selectedProfile?.email || "Select lead"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search users..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                None
              </CommandItem>
              {profiles?.map((profile) => {
                const label = profile.full_name || profile.email || profile.id;
                return (
                  <CommandItem
                    key={profile.id}
                    value={label}
                    onSelect={() => {
                      onChange(profile.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === profile.id ? "opacity-100" : "opacity-0")} />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function AdminDepartments() {
  const { data: orgUnits = [] } = useOrgUnits();
  const { data: profiles = [] } = useProfiles();
  const updateOrgUnit = useUpdateOrgUnit();
  const createOrgUnit = useCreateOrgUnit();
  const isAdminUser = useIsAdminUser();

  const departmentOptions = useMemo(() => {
    return [...new Set(orgUnits.map((unit) => unit.department_name))];
  }, [orgUnits]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [subDepartmentName, setSubDepartmentName] = useState("");
  const [leadUserId, setLeadUserId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!selectedDepartment || !subDepartmentName) return;
    createOrgUnit.mutate(
      {
        department_name: selectedDepartment,
        sub_department_name: subDepartmentName,
        lead_user_id: leadUserId,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setSelectedDepartment("");
          setSubDepartmentName("");
          setLeadUserId(null);
        },
      },
    );
  };

  return (
    <MainLayout title="Departments" subtitle="Manage org units and department leads">
      <div className="flex justify-end mb-4">
        {isAdminUser && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Sub-department
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Sub-department</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Sub-department name"
                  value={subDepartmentName}
                  onChange={(event) => setSubDepartmentName(event.target.value)}
                />
                <UserSelect value={leadUserId} onChange={setLeadUserId} profiles={profiles} />
                <div className="flex justify-end">
                  <Button onClick={handleCreate} disabled={!selectedDepartment || !subDepartmentName}>
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Org Units</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Sub-department</TableHead>
                <TableHead>Lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgUnits.map((unit) => {
                const leadProfile = profiles.find((profile) => profile.id === unit.lead_user_id);
                return (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.department_name}</TableCell>
                    <TableCell>{unit.sub_department_name ?? "General"}</TableCell>
                    <TableCell>
                      {isAdminUser ? (
                        <UserSelect
                          value={unit.lead_user_id}
                          profiles={profiles}
                          onChange={(value) => updateOrgUnit.mutate({ id: unit.id, lead_user_id: value })}
                        />
                      ) : (
                        <span>{leadProfile?.full_name || leadProfile?.email || "Unassigned"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
