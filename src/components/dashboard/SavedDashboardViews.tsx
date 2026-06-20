import { useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardFilters } from "@/hooks/useDashboardData";
import { useSavedDashboardViews, type SavedDashboardView } from "@/hooks/useSavedDashboardViews";
import type { DashboardSectionId } from "@/hooks/useDashboardUrlState";

type SavedDashboardViewsProps = {
  filters: DashboardFilters;
  section: DashboardSectionId | null;
  onApply: (view: SavedDashboardView) => void;
  onReset: () => void;
};

export const SavedDashboardViews = ({ filters, section, onApply, onReset }: SavedDashboardViewsProps) => {
  const { views, saveView, deleteView } = useSavedDashboardViews();
  const [name, setName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const handleSave = () => {
    if (saveView(name, filters, section)) {
      setName("");
      setShowSave(false);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Bookmark className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">Saved views</span>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowSave((v) => !v)}>
          Save current
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onReset}>
          Reset to default
        </Button>
      </div>

      {showSave && (
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-8 max-w-xs text-sm"
            placeholder="View name (e.g. Kenya Finance)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button size="sm" className="h-8" onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      )}

      {views.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {views.map((view) => (
            <div key={view.id} className="flex items-center gap-1 rounded-md border bg-background px-2 py-1">
              <button
                type="button"
                className="text-xs font-medium hover:text-primary"
                onClick={() => onApply(view)}
              >
                {view.name}
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${view.name}`}
                onClick={() => deleteView(view.id)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No saved views yet. Save the current filter combination for quick access.</p>
      )}
    </div>
  );
};
