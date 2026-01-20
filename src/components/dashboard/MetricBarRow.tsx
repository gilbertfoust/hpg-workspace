import { cn } from "@/lib/utils";

interface MetricBarRowProps {
  label: string;
  value: number;
  percentage: number;
  hint?: string;
  barClassName?: string;
}

export function MetricBarRow({
  label,
  value,
  percentage,
  hint,
  barClassName,
}: MetricBarRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div>
          <p className="font-medium text-foreground">{label}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full bg-primary", barClassName)}
          style={{ width: `${Math.max(4, Math.min(percentage, 100))}%` }}
        />
      </div>
    </div>
  );
}
