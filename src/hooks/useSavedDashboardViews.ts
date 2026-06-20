import { useCallback, useState } from "react";
import type { DashboardFilters } from "@/hooks/useDashboardData";
import type { DashboardSectionId } from "@/hooks/useDashboardUrlState";

const STORAGE_KEY = "hpg-dashboard-saved-views";

export type SavedDashboardView = {
  id: string;
  name: string;
  bundle?: string;
  country?: string;
  state?: string;
  module?: string;
  section?: DashboardSectionId;
  savedAt: string;
};

const readViews = (): SavedDashboardView[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeViews = (views: SavedDashboardView[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
};

export const useSavedDashboardViews = () => {
  const [views, setViews] = useState<SavedDashboardView[]>(() => readViews());

  const refresh = useCallback(() => {
    setViews(readViews());
  }, []);

  const saveView = useCallback(
    (name: string, filters: DashboardFilters, section: DashboardSectionId | null) => {
      const trimmed = name.trim();
      if (!trimmed) return false;

      const nextView: SavedDashboardView = {
        id: crypto.randomUUID(),
        name: trimmed,
        bundle: filters.bundle,
        country: filters.country,
        state: filters.state,
        module: filters.module,
        section: section ?? undefined,
        savedAt: new Date().toISOString(),
      };

      const updated = [...readViews(), nextView];
      writeViews(updated);
      setViews(updated);
      return true;
    },
    [],
  );

  const deleteView = useCallback((id: string) => {
    const updated = readViews().filter((view) => view.id !== id);
    writeViews(updated);
    setViews(updated);
  }, []);

  const toFilters = (view: SavedDashboardView): DashboardFilters => ({
    bundle: view.bundle,
    country: view.country,
    state: view.state,
    module: view.module as DashboardFilters["module"],
  });

  return { views, saveView, deleteView, toFilters, refresh };
};
