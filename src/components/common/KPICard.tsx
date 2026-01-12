import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  variant?: "default" | "warning" | "danger" | "success";
  onClick?: () => void;
}

const variantClasses = {
  default: "border-border",
  warning: "border-warning/30 bg-warning/5",
  danger: "border-destructive/30 bg-destructive/5",
  success: "border-success/30 bg-success/5",
};

const trendIcons = {
  up: <TrendingUp className="w-4 h-4 text-success" />,
  down: <TrendingDown className="w-4 h-4 text-destructive" />,
  neutral: <Minus className="w-4 h-4 text-muted-foreground" />,
};

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  variant = "default",
  onClick,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "kpi-card",
        variantClasses[variant],
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="kpi-label">{title}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <p className="kpi-value">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        
        {trend && (
          <div className="flex items-center gap-1 text-xs">
            {trendIcons[trend]}
            {trendValue && <span className="text-muted-foreground">{trendValue}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
