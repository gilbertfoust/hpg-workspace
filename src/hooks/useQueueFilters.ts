import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ModuleType, WorkItemStatus } from "@/hooks/useWorkItems";

const parseStatuses = (value: string | null): WorkItemStatus[] =>
  value
    ? value
        .split(",")
        .map((status) => status.trim())
        .filter(Boolean) as WorkItemStatus[]
    : [];

export const useQueueFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const statuses = parseStatuses(searchParams.get("status"));
    const module = (searchParams.get("module") || "all") as ModuleType | "all";
    const ngoId = searchParams.get("ngo") || "all";
    const departmentId = searchParams.get("department") || "all";
    const startDate = searchParams.get("start") || "";
    const endDate = searchParams.get("end") || "";

    return {
      statuses,
      module,
      ngoId,
      departmentId,
      startDate,
      endDate,
    };
  }, [searchParams]);

  const setParam = (key: string, value: string | string[] | undefined) => {
    const next = new URLSearchParams(searchParams);
    const resolvedValue = Array.isArray(value) ? value.join(",") : value;

    if (!resolvedValue || resolvedValue === "all") {
      next.delete(key);
    } else {
      next.set(key, resolvedValue);
    }

    setSearchParams(next, { replace: true });
  };

  return {
    filters,
    setStatuses: (statuses: WorkItemStatus[]) => setParam("status", statuses),
    setModule: (module: ModuleType | "all") => setParam("module", module),
    setNgoId: (ngoId: string | "all") => setParam("ngo", ngoId),
    setDepartmentId: (departmentId: string | "all") => setParam("department", departmentId),
    setStartDate: (value: string) => setParam("start", value),
    setEndDate: (value: string) => setParam("end", value),
    clearFilters: () => setSearchParams(new URLSearchParams(), { replace: true }),
  };
};
