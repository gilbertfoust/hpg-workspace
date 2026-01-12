import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  FileText,
  Link2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Mock data
const mockWorkItems = [
  {
    id: "WI-001",
    title: "Submit Q4 Financial Report",
    ngo: "Detroit Community Foundation",
    module: "Finance",
    department: "Finance",
    status: "waiting-ngo" as const,
    priority: "high" as const,
    dueDate: "2026-01-15",
    owner: "Jane Smith",
    evidenceRequired: true,
    evidenceStatus: "missing",
    approvalRequired: true,
    hasDependencies: false,
  },
  {
    id: "WI-002",
    title: "Complete Onboarding Documentation",
    ngo: "Chicago Youth Initiative",
    module: "NGO Coordination",
    department: "Administration",
    status: "in-progress" as const,
    priority: "medium" as const,
    dueDate: "2026-01-18",
    owner: "John Doe",
    evidenceRequired: true,
    evidenceStatus: "uploaded",
    approvalRequired: false,
    hasDependencies: true,
  },
  {
    id: "WI-003",
    title: "Review Grant Application - Ford Foundation",
    ngo: "Mexican Education Alliance",
    module: "Development",
    department: "Development",
    status: "under-review" as const,
    priority: "high" as const,
    dueDate: "2026-01-14",
    owner: "Maria Garcia",
    evidenceRequired: false,
    evidenceStatus: null,
    approvalRequired: true,
    hasDependencies: false,
  },
  {
    id: "WI-004",
    title: "IT Access Provisioning - New Staff",
    ngo: null,
    module: "IT",
    department: "IT",
    status: "not-started" as const,
    priority: "low" as const,
    dueDate: "2026-01-20",
    owner: "David Kim",
    evidenceRequired: true,
    evidenceStatus: "missing",
    approvalRequired: false,
    hasDependencies: false,
  },
  {
    id: "WI-005",
    title: "Annual Compliance Filing",
    ngo: "African Youth Network",
    module: "Legal",
    department: "Legal",
    status: "submitted" as const,
    priority: "high" as const,
    dueDate: "2026-01-31",
    owner: "Sarah Johnson",
    evidenceRequired: true,
    evidenceStatus: "approved",
    approvalRequired: true,
    hasDependencies: false,
  },
];

const modules = ["All Modules", "NGO Coordination", "Administration", "Finance", "Legal", "Development", "IT", "HR", "Marketing"];
const departments = ["All Departments", "Administration", "Finance", "Legal", "Development", "IT", "HR", "Marketing", "Program"];
const statusOptions = ["All Statuses", "Draft", "Not Started", "In Progress", "Waiting on NGO", "Submitted", "Under Review", "Complete"];

export default function WorkItems() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("All Modules");
  const [selectedDepartment, setSelectedDepartment] = useState("All Departments");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === mockWorkItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(mockWorkItems.map((item) => item.id));
    }
  };

  return (
    <MainLayout
      title="Work Items"
      subtitle="Manage and track all assignments across departments"
      actions={
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Bulk Actions ({selectedItems.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Reassign Owner</DropdownMenuItem>
                <DropdownMenuItem>Change Due Date</DropdownMenuItem>
                <DropdownMenuItem>Update Status</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Sync to Trello</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Work Item
          </Button>
        </div>
      }
    >
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search work items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modules.map((module) => (
                <SelectItem key={module} value={module}>
                  {module}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Work Items Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="data-table overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-10">
                  <Checkbox
                    checked={selectedItems.length === mockWorkItems.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th>ID</th>
                <th>Title</th>
                <th>NGO</th>
                <th>Module</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Owner</th>
                <th>Evidence</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {mockWorkItems.map((item) => (
                <tr key={item.id} className="group cursor-pointer">
                  <td onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={() => toggleSelectItem(item.id)}
                    />
                  </td>
                  <td className="text-muted-foreground font-mono text-xs">{item.id}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      {item.hasDependencies && (
                        <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      {item.approvalRequired && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-info" />
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground">{item.ngo || "—"}</td>
                  <td>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {item.module}
                    </Badge>
                  </td>
                  <td>
                    <StatusChip status={item.status} />
                  </td>
                  <td>
                    <PriorityBadge priority={item.priority} />
                  </td>
                  <td className="text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {item.dueDate}
                    </div>
                  </td>
                  <td className="text-muted-foreground">{item.owner}</td>
                  <td>
                    {item.evidenceRequired ? (
                      <span
                        className={`status-chip ${
                          item.evidenceStatus === "missing"
                            ? "evidence-missing"
                            : item.evidenceStatus === "uploaded"
                            ? "evidence-uploaded"
                            : item.evidenceStatus === "approved"
                            ? "evidence-approved"
                            : "evidence-under-review"
                        }`}
                      >
                        {item.evidenceStatus === "missing" && <AlertCircle className="w-3 h-3 mr-1" />}
                        {item.evidenceStatus || "Required"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Reassign</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Sync to Trello</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination placeholder */}
      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>Showing {mockWorkItems.length} of {mockWorkItems.length} items</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
