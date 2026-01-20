import { Filter } from "lucide-react";
import { WorkItemStatus, ModuleType } from "@/hooks/useWorkItems";
import { OrgUnit } from "@/hooks/useOrgUnits";
import { NGO } from "@/hooks/useNGOs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const moduleOptions: { value: string; label: string }[] = [
  { value: "all", label: "All Modules" },
  { value: "ngo_coordination", label: "NGO Coordination" },
  { value: "administration", label: "Administration" },
  { value: "operations", label: "Operations" },
  { value: "program", label: "Program" },
  { value: "curriculum", label: "Curriculum" },
  { value: "development", label: "Development" },
  { value: "partnership", label: "Partnership" },
  { value: "marketing", label: "Marketing" },
  { value: "communications", label: "Communications" },
  { value: "hr", label: "HR" },
  { value: "it", label: "IT" },
  { value: "finance", label: "Finance" },
  { value: "legal", label: "Legal" },
];

const statusOptions: { value: WorkItemStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_ngo", label: "Waiting on NGO" },
  { value: "waiting_on_hpg", label: "Waiting on HPG" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "complete", label: "Complete" },
  { value: "canceled", label: "Canceled" },
];

interface QueueFiltersProps {
  statuses: WorkItemStatus[];
  module: ModuleType | "all";
  ngoId: string | "all";
  departmentId: string | "all";
  startDate: string;
  endDate: string;
  ngos?: NGO[];
  orgUnits?: OrgUnit[];
  onStatusesChange: (statuses: WorkItemStatus[]) => void;
  onModuleChange: (module: ModuleType | "all") => void;
  onNgoChange: (ngoId: string | "all") => void;
  onDepartmentChange: (departmentId: string | "all") => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClear: () => void;
}

const getDepartmentLabel = (orgUnit: OrgUnit) =>
  orgUnit.sub_department_name
    ? `${orgUnit.department_name} / ${orgUnit.sub_department_name}`
    : orgUnit.department_name;

export function QueueFilters({
  statuses,
  module,
  ngoId,
  departmentId,
  startDate,
  endDate,
  ngos,
  orgUnits,
  onStatusesChange,
  onModuleChange,
  onNgoChange,
  onDepartmentChange,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: QueueFiltersProps) {
  const statusLabel =
    statuses.length === 0 ? "All Statuses" : `Status (${statuses.length})`;

  return (
    <div className="flex flex-col lg:flex-row gap-4 mb-6">
      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-40 justify-between">
              {statusLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {statusOptions.map((status) => (
              <DropdownMenuCheckboxItem
                key={status.value}
                checked={statuses.includes(status.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onStatusesChange([...statuses, status.value]);
                    return;
                  }
                  onStatusesChange(statuses.filter((item) => item !== status.value));
                }}
              >
                {status.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={module} onValueChange={(value) => onModuleChange(value as ModuleType | "all")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {moduleOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ngoId} onValueChange={(value) => onNgoChange(value)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All NGOs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All NGOs</SelectItem>
            {(ngos || []).map((ngo) => (
              <SelectItem key={ngo.id} value={ngo.id}>
                {ngo.common_name || ngo.legal_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={departmentId} onValueChange={(value) => onDepartmentChange(value)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {(orgUnits || []).map((orgUnit) => (
              <SelectItem key={orgUnit.id} value={orgUnit.id}>
                {getDepartmentLabel(orgUnit)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="w-40"
          />
        </div>

        <Button variant="outline" size="icon" onClick={onClear}>
          <Filter className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
