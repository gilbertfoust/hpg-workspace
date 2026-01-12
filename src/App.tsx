import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Pages
import Dashboard from "./pages/Dashboard";
import NGOs from "./pages/NGOs";
import WorkItems from "./pages/WorkItems";
import Forms from "./pages/Forms";
import Documents from "./pages/Documents";
import CalendarPage from "./pages/CalendarPage";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

// Module pages
import {
  NGOCoordinationModule,
  AdministrationModule,
  OperationsModule,
  ProgramModule,
  CurriculumModule,
  DevelopmentModule,
  PartnershipsModule,
  MarketingModule,
  CommunicationsModule,
  HRModule,
  ITModule,
  FinanceModule,
  LegalModule,
} from "./pages/modules/ModulePlaceholder";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Main pages */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ngos" element={<NGOs />} />
          <Route path="/work-items" element={<WorkItems />} />
          <Route path="/forms" element={<Forms />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin" element={<Admin />} />
          
          {/* Module pages */}
          <Route path="/modules/ngo-coordination" element={<NGOCoordinationModule />} />
          <Route path="/modules/administration" element={<AdministrationModule />} />
          <Route path="/modules/operations" element={<OperationsModule />} />
          <Route path="/modules/program" element={<ProgramModule />} />
          <Route path="/modules/curriculum" element={<CurriculumModule />} />
          <Route path="/modules/development" element={<DevelopmentModule />} />
          <Route path="/modules/partnerships" element={<PartnershipsModule />} />
          <Route path="/modules/marketing" element={<MarketingModule />} />
          <Route path="/modules/communications" element={<CommunicationsModule />} />
          <Route path="/modules/hr" element={<HRModule />} />
          <Route path="/modules/it" element={<ITModule />} />
          <Route path="/modules/finance" element={<FinanceModule />} />
          <Route path="/modules/legal" element={<LegalModule />} />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
