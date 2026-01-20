import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layout/MainLayout";
import { HRRequisitionsSection } from "@/components/hr/HRRequisitionsSection";
import { HRApplicantsSection } from "@/components/hr/HRApplicantsSection";
import { HRInterviewsSection } from "@/components/hr/HRInterviewsSection";

export default function HRDashboard() {
  return (
    <MainLayout
      title="HR"
      subtitle="Lean ATS for requisitions, applicants, and interview scorecards."
    >
      <Tabs defaultValue="requisitions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="requisitions">Job Requisitions</TabsTrigger>
          <TabsTrigger value="applicants">Applicants</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
        </TabsList>
        <TabsContent value="requisitions">
          <HRRequisitionsSection />
        </TabsContent>
        <TabsContent value="applicants">
          <HRApplicantsSection />
        </TabsContent>
        <TabsContent value="interviews">
          <HRInterviewsSection />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
