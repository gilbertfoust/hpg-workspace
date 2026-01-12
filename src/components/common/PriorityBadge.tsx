import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

type PriorityType = "low" | "medium" | "high";

interface PriorityBadgeProps {
  priority: PriorityType;
  showIcon?: boolean;
  className?: string;
}

const priorityLabels: Record<PriorityType, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const priorityClasses: Record<PriorityType, string> = {
  low: "priority-low",
  medium: "priority-medium",
  high: "priority-high",
};

const PriorityIcon: Record<PriorityType, React.ReactNode> = {
  low: <ArrowDown className="w-3 h-3" />,
  medium: <ArrowRight className="w-3 h-3" />,
  high: <ArrowUp className="w-3 h-3" />,
};

export function PriorityBadge({ priority, showIcon = true, className }: PriorityBadgeProps) {
  return (
    <span className={cn("status-chip inline-flex items-center gap-1", priorityClasses[priority], className)}>
      {showIcon && PriorityIcon[priority]}
      {priorityLabels[priority]}
    </span>
  );
}
