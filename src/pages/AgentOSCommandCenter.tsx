import { MainLayout } from "@/components/layout/MainLayout";
import { Phase6ExecutiveCommandPanel } from "@/components/agent-os/Phase6ExecutiveCommandPanel";

export default function AgentOSCommandCenter() {
  return (
    <MainLayout
      title="Agent OS Executive Command"
      subtitle="Workspace-native agent operations, department intelligence, and the human-governed CEO decision queue"
    >
      <Phase6ExecutiveCommandPanel />
    </MainLayout>
  );
}
