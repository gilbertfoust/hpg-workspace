import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useUpdateWorkItem } from "@/hooks/useWorkItems";
import { useToast } from "@/hooks/use-toast";

interface ChecklistItem {
  label: string;
  checked: boolean;
}

interface WorkItemChecklistProps {
  workItemId: string;
  checklist: unknown;
}

export function WorkItemChecklist({ workItemId, checklist }: WorkItemChecklistProps) {
  const updateWorkItem = useUpdateWorkItem();
  const { toast } = useToast();
  const parsed = Array.isArray(checklist) ? (checklist as ChecklistItem[]) : [];
  const [items, setItems] = useState<ChecklistItem[]>(parsed);

  const completedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggle = async (index: number) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    setItems(updated);

    try {
      await updateWorkItem.mutateAsync({
        id: workItemId,
        checklist_json: updated,
      } as any);
    } catch (error) {
      // Revert on error
      setItems(items);
      toast({
        variant: "destructive",
        title: "Error updating checklist",
        description: error instanceof Error ? error.message : "Failed to save checklist",
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium">Checklist</h4>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{totalCount} complete
        </span>
      </div>
      <Progress value={progress} className="h-2 mb-3" />
      <div className="space-y-2">
        {items.map((item, index) => (
          <label
            key={index}
            className="flex items-start gap-2 cursor-pointer group"
          >
            <Checkbox
              checked={item.checked}
              onCheckedChange={() => handleToggle(index)}
              className="mt-0.5"
            />
            <span
              className={`text-sm leading-tight ${
                item.checked
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
