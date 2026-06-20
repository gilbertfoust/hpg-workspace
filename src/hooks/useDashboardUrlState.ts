import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { DashboardFilters } from "@/hooks/useDashboardData";
import type { ModuleType } from "@/hooks/useWorkItems";

export const DASHBOARD_SECTION_IDS = [
  "filters",
  "drilldowns",
  "executive-brief",
  "kpis",
  "action-center",
  "module-snapshots",
  "recent-activity",
  "data-health",
  "charts",
  "workload",
  "risk-evidence",
] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTION_IDS)[number];

const FILTER_PARAM_KEYS = ["bundle", "country", "state", "module"] as const;

const parseFilters = (searchParams: URLSearchParams): DashboardFilters => {
  const module = searchParams.get("module");
  return {
    bundle: searchParams.get("bundle") || undefined,
    country: searchParams.get("country") || undefined,
    state: searchParams.get("state") || undefined,
    module: module ? (module as ModuleType) : undefined,
  };
};

const isDashboardSection = (value: string | null): value is DashboardSectionId =>
  Boolean(value && DASHBOARD_SECTION_IDS.includes(value as DashboardSectionId));

export const useDashboardUrlState = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const sectionParam = searchParams.get("section");
  const section = isDashboardSection(sectionParam) ? sectionParam : null;

  const setFilters = (next: DashboardFilters) => {
    const params = new URLSearchParams(searchParams);

    FILTER_PARAM_KEYS.forEach((key) => {
      const value = next[key];
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    setSearchParams(params, { replace: true });
  };

  return { filters, section, setFilters };
};

export const useDashboardSectionScroll = (section: DashboardSectionId | null) => {
  useEffect(() => {
    if (!section) return;

    const scrollToSection = () => {
      const element = document.getElementById(section);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const frame = window.requestAnimationFrame(scrollToSection);
    const timer = window.setTimeout(scrollToSection, 150);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [section]);
};
