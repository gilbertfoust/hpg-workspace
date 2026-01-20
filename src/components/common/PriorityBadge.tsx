import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

type PriorityType = "Low" | "Med" | "High";

interface PriorityBadgeProps {
  priority: PriorityType;
  showIcon?: boolean;
  className?: string;
}

const priorityLabels: Record<PriorityType, string> = {
  Low: "Low",
  Med: "Med",
  High: "High",
};

const priorityClasses: Record<PriorityType, string> = {
  Low: "priority-low",
  Med: "priority-medium",
  High: "priority-high",
};

const PriorityIcon: Record<PriorityType, React.ReactNode> = {
  Low: <ArrowDown className="w-3 h-3" />,
  Med: <ArrowRight className="w-3 h-3" />,
  High: <ArrowUp className="w-3 h-3" />,
};

export function PriorityBadge({ priority, showIcon = true, className }: PriorityBadgeProps) {
  return (
    <span className={cn("status-chip inline-flex items-center gap-1", priorityClasses[priority], className)}>
      {showIcon && PriorityIcon[priority]}
      {priorityLabels[priority]}
    </span>
  );
}
