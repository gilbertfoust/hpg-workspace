import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Link2,
  MoreHorizontal,
} from "lucide-react";
import { WorkItem } from "@/hooks/useWorkItems";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { InlineStatusSelect } from "@/components/work-items/InlineStatusSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface WorkItemsTableProps {
  items: WorkItem[];
  isLoading?: boolean;
  error?: Error | null;
  ngoMap?: Map<string, string>;
  emptyMessage?: string;
  onRowClick?: (id: string) => void;
  selectedItems?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  showSelection?: boolean;
  showActions?: boolean;
}

const formatModuleName = (module: string) =>
  module.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

export function WorkItemsTable({
  items,
  isLoading = false,
  error,
  ngoMap = new Map(),
  emptyMessage = "No work items found.",
  onRowClick,
  selectedItems = [],
  onToggleSelect,
  onToggleSelectAll,
  showSelection = false,
  showActions = true,
}: WorkItemsTableProps) {
  const hasSelection = showSelection && onToggleSelect && onToggleSelectAll;
  const columnCount = 7 + (hasSelection ? 1 : 0) + (showActions ? 1 : 0);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="data-table overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {hasSelection && (
                <th className="w-10">
                  <Checkbox
                    checked={items.length > 0 && selectedItems.length === items.length}
                    onCheckedChange={onToggleSelectAll}
                  />
                </th>
              )}
              <th>Title</th>
              <th>NGO</th>
              <th>Module</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Due Date</th>
              <th>Evidence</th>
              {showActions && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {hasSelection && (
                    <td>
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  <td><Skeleton className="h-4 w-48" /></td>
                  <td><Skeleton className="h-4 w-32" /></td>
                  <td><Skeleton className="h-4 w-24" /></td>
                  <td><Skeleton className="h-6 w-24" /></td>
                  <td><Skeleton className="h-5 w-16" /></td>
                  <td><Skeleton className="h-4 w-24" /></td>
                  <td><Skeleton className="h-5 w-16" /></td>
                  {showActions && <td><Skeleton className="h-8 w-8" /></td>}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columnCount} className="text-center py-8 text-muted-foreground">
                  Error loading work items: {error.message}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="text-center py-8 text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className={cn("group", onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick?.(item.id)}
                >
                  {hasSelection && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => onToggleSelect?.(item.id)}
                      />
                    </td>
                  )}
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      {item.dependencies && item.dependencies.length > 0 && (
                        <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      {item.approval_required && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-info" />
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground">
                    {item.ngo_id ? ngoMap.get(item.ngo_id) || "Unknown" : "—"}
                  </td>
                  <td>
                    <Badge variant="secondary" className="text-xs font-normal capitalize">
                      {formatModuleName(item.module)}
                    </Badge>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <InlineStatusSelect
                      workItemId={item.id}
                      currentStatus={item.status}
                    />
                  </td>
                  <td>
                    <PriorityBadge priority={item.priority} />
                  </td>
                  <td className="text-muted-foreground whitespace-nowrap">
                    {item.due_date ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(item.due_date), "MMM d, yyyy")}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {item.evidence_required ? (
                      <span
                        className={`status-chip ${
                          item.evidence_status === "missing"
                            ? "evidence-missing"
                            : item.evidence_status === "uploaded"
                            ? "evidence-uploaded"
                            : item.evidence_status === "approved"
                            ? "evidence-approved"
                            : "evidence-under-review"
                        }`}
                      >
                        {item.evidence_status === "missing" && (
                          <AlertCircle className="w-3 h-3 mr-1" />
                        )}
                        {item.evidence_status || "Required"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  {showActions && (
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
                          <DropdownMenuItem onClick={() => onRowClick?.(item.id)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Reassign</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Sync to Trello</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
