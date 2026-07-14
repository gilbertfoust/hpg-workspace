import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  WorkspaceNgoContext,
  type WorkspaceNgoContextValue,
} from "@/contexts/workspaceNgoContextValue";
import { useNGOs, type NGO } from "@/hooks/useNGOs";
import { supabase } from "@/integrations/supabase/client";

const WORKSPACE_NGO_STORAGE_KEY = "hpg.workspace.selectedNgoId";

const getStoredNgoId = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WORKSPACE_NGO_STORAGE_KEY);
};

export function WorkspaceNgoProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedNgoId, setSelectedNgoId] = useState<string | null>(getStoredNgoId);
  const {
    data: ngoData = [],
    isLoading,
    isSuccess,
    error,
  } = useNGOs({ enabled: !authLoading && Boolean(user) });

  const ngos = useMemo(
    () =>
      [...ngoData].sort((left, right) =>
        (left.common_name || left.legal_name).localeCompare(right.common_name || right.legal_name),
      ),
    [ngoData],
  );

  const selectNgo = useCallback((ngoId: string | null) => {
    setSelectedNgoId(ngoId);

    if (typeof window === "undefined") return;
    if (ngoId) {
      window.localStorage.setItem(WORKSPACE_NGO_STORAGE_KEY, ngoId);
    } else {
      window.localStorage.removeItem(WORKSPACE_NGO_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!isSuccess || !selectedNgoId) return;

    const selectionStillExists = ngos.some((ngo) => ngo.id === selectedNgoId);
    if (!selectionStillExists) selectNgo(null);
  }, [isSuccess, ngos, selectNgo, selectedNgoId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === WORKSPACE_NGO_STORAGE_KEY) {
        setSelectedNgoId(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel("workspace-ngo-directory")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ngos" },
        () => queryClient.invalidateQueries({ queryKey: ["ngos"] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  const selectedNgo = useMemo(
    () => ngos.find((ngo) => ngo.id === selectedNgoId) ?? null,
    [ngos, selectedNgoId],
  );

  const value = useMemo<WorkspaceNgoContextValue>(
    () => ({
      ngos,
      selectedNgo,
      selectedNgoId,
      isAllHpg: selectedNgoId === null,
      isLoading: authLoading || isLoading,
      error: error instanceof Error ? error : null,
      selectNgo,
    }),
    [authLoading, error, isLoading, ngos, selectNgo, selectedNgo, selectedNgoId],
  );

  return <WorkspaceNgoContext.Provider value={value}>{children}</WorkspaceNgoContext.Provider>;
}
