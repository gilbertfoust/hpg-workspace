import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import type { Priority } from "@/hooks/useWorkItems";

type PriorityType = "Low" | "Med" | "High";

interface PriorityBadgeProps {
  priority: PriorityType | Priority | null | undefined;
  showIcon?: boolean;
  className?: string;
}

const normalize = (p: PriorityType | Priority | null | undefined): PriorityType => {
  if (!p) return "Med";
  const map: Record<string, PriorityType> = {
    low: "Low", Low: "Low",
    medium: "Med", Med: "Med",
    high: "High", High: "High",
    urgent: "High",
  };
  return map[p] ?? "Med";
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
  const normalized = normalize(priority);
  return (
    <span className={cn("status-chip inline-flex items-center gap-1", priorityClasses[normalized], className)}>
      {showIcon && PriorityIcon[normalized]}
      {normalized}
    </span>
  );
}
