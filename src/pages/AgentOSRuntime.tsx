import { MainLayout } from "@/components/layout/MainLayout";
import { AgentOSQueuePanel } from "@/components/ngo/AgentOSQueuePanel";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";
import { useAgentOSCases, isSupabaseNotConfiguredError } from "@/hooks/useAgentOSCases";

export default function AgentOSRuntime() {
  const { data, isLoading, error } = useAgentOSCases({ limit: 100 });

  return (
    <MainLayout
      title="Agent OS Runtime"
      subtitle="Permanent cases, agent activity, approval gates, unmatched intake, risks, and cross-system routing"
    >
      {isSupabaseNotConfiguredError(error) ? (
        <SupabaseNotConfiguredNotice />
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
          Agent OS cases could not be loaded. Technology should review the database connection and runtime migration status.
        </div>
      ) : (
        <AgentOSQueuePanel data={data} isLoading={isLoading} />
      )}
    </MainLayout>
  );
}
