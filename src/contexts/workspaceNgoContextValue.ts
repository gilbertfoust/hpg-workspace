import { createContext } from "react";
import type { NGO } from "@/hooks/useNGOs";

export interface WorkspaceNgoContextValue {
  ngos: NGO[];
  selectedNgo: NGO | null;
  selectedNgoId: string | null;
  isAllHpg: boolean;
  isLoading: boolean;
  error: Error | null;
  selectNgo: (ngoId: string | null) => void;
}

export const WorkspaceNgoContext = createContext<WorkspaceNgoContextValue | undefined>(undefined);
