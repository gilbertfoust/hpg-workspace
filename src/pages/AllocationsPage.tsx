import { MainLayout } from "@/components/layout/MainLayout";
import { AllocationRuleBuilder } from "@/components/usage-accounting/AllocationRuleBuilder";
import { AllocationRunPreview } from "@/components/usage-accounting/AllocationRunPreview";
import { Separator } from "@/components/ui/separator";

const AllocationsPage = () => (
  <MainLayout>
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cost Allocations</h1>
        <p className="text-muted-foreground">Define allocation rules and run periodic cost distribution across NGOs and programs.</p>
      </div>
      <AllocationRuleBuilder />
      <Separator />
      <AllocationRunPreview />
    </div>
  </MainLayout>
);

export default AllocationsPage;
