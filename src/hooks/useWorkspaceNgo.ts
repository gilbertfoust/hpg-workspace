import { useContext } from "react";
import { WorkspaceNgoContext } from "@/contexts/workspaceNgoContextValue";

export function useWorkspaceNgo() {
  const context = useContext(WorkspaceNgoContext);
  if (!context) {
    throw new Error("useWorkspaceNgo must be used within a WorkspaceNgoProvider");
  }
  return context;
}
