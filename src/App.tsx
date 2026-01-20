import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NGOs from "./pages/NGOs";
import NGODetail from "./pages/NGODetail";
import WorkItems from "./pages/WorkItems";
import Forms from "./pages/Forms";
import Documents from "./pages/Documents";
import CalendarPage from "./pages/CalendarPage";
import ReportsDashboard from "./pages/ReportsDashboard";
import Admin from "./pages/Admin";
import AdminRoles from "./pages/admin/AdminRoles";
import AdminDepartments from "./pages/admin/AdminDepartments";
import AdminConfigHome from "./pages/AdminConfig/AdminConfigHome";
import NotFound from "./pages/NotFound";
import Portal from "./pages/Portal";
import NGOCoordination from "./pages/NGOCoordination";
import ITDashboard from "./pages/ITDashboard";
import HRDashboard from "./pages/HRDashboard";

// Module pages
import {
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
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth page */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Protected main pages */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/ngos" element={<ProtectedRoute><NGOs /></ProtectedRoute>} />
            <Route path="/ngos/:id" element={<ProtectedRoute><NGODetail /></ProtectedRoute>} />
            <Route path="/work-items" element={<ProtectedRoute><WorkItems /></ProtectedRoute>} />
            <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/it" element={<ProtectedRoute><ITDashboard /></ProtectedRoute>} />
            <Route path="/hr" element={<ProtectedRoute><HRDashboard /></ProtectedRoute>} />
            
            {/* Protected module pages */}
            <Route path="/modules/ngo-coordination" element={<ProtectedRoute><NGOCoordinationModule /></ProtectedRoute>} />
            <Route path="/modules/administration" element={<ProtectedRoute><AdministrationModule /></ProtectedRoute>} />
            <Route path="/modules/operations" element={<ProtectedRoute><OperationsModule /></ProtectedRoute>} />
            <Route path="/modules/program" element={<ProtectedRoute><ProgramModule /></ProtectedRoute>} />
            <Route path="/modules/curriculum" element={<ProtectedRoute><CurriculumModule /></ProtectedRoute>} />
            <Route path="/modules/development" element={<ProtectedRoute><DevelopmentModule /></ProtectedRoute>} />
            <Route path="/modules/partnerships" element={<ProtectedRoute><PartnershipsModule /></ProtectedRoute>} />
            <Route path="/modules/marketing" element={<ProtectedRoute><MarketingModule /></ProtectedRoute>} />
            <Route path="/modules/communications" element={<ProtectedRoute><CommunicationsModule /></ProtectedRoute>} />
            <Route path="/modules/hr" element={<ProtectedRoute><HRModule /></ProtectedRoute>} />
            <Route path="/modules/it" element={<ProtectedRoute><ITModule /></ProtectedRoute>} />
            <Route path="/modules/finance" element={<ProtectedRoute><FinanceModule /></ProtectedRoute>} />
            <Route path="/modules/legal" element={<ProtectedRoute><LegalModule /></ProtectedRoute>} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <ErrorBoundary>
          <HashRouter>
            <Routes>
              {/* Auth page */}
              <Route path="/auth" element={<Auth />} />
              
              {/* Redirect root to dashboard */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              
              {/* Protected main pages */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/ngos" element={<ProtectedRoute><NGOs /></ProtectedRoute>} />
              <Route path="/ngos/:id" element={<ProtectedRoute><NGODetail /></ProtectedRoute>} />
              <Route path="/work-items" element={<ProtectedRoute><WorkItems /></ProtectedRoute>} />
              <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><ReportsDashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/roles" element={<ProtectedRoute><AdminRoles /></ProtectedRoute>} />
              <Route path="/admin/departments" element={<ProtectedRoute><AdminDepartments /></ProtectedRoute>} />

              {/* External NGO portal */}
              <Route path="/portal" element={<ProtectedRoute><Portal /></ProtectedRoute>} />
              <Route path="/ngo-coordination" element={<ProtectedRoute><NGOCoordination /></ProtectedRoute>} />
              <Route path="/admin/config" element={<ProtectedRoute><AdminConfigHome /></ProtectedRoute>} />
              
              {/* Protected module pages */}
              <Route path="/modules/ngo-coordination" element={<Navigate to="/ngo-coordination" replace />} />
              <Route path="/modules/administration" element={<ProtectedRoute><AdministrationModule /></ProtectedRoute>} />
              <Route path="/modules/operations" element={<ProtectedRoute><OperationsModule /></ProtectedRoute>} />
              <Route path="/modules/program" element={<ProtectedRoute><ProgramModule /></ProtectedRoute>} />
              <Route path="/modules/curriculum" element={<ProtectedRoute><CurriculumModule /></ProtectedRoute>} />
              <Route path="/modules/development" element={<ProtectedRoute><DevelopmentModule /></ProtectedRoute>} />
              <Route path="/modules/partnerships" element={<ProtectedRoute><PartnershipsModule /></ProtectedRoute>} />
              <Route path="/modules/marketing" element={<ProtectedRoute><MarketingModule /></ProtectedRoute>} />
              <Route path="/modules/communications" element={<ProtectedRoute><CommunicationsModule /></ProtectedRoute>} />
              <Route path="/modules/hr" element={<ProtectedRoute><HRModule /></ProtectedRoute>} />
              <Route path="/modules/it" element={<ProtectedRoute><ITModule /></ProtectedRoute>} />
              <Route path="/modules/finance" element={<ProtectedRoute><FinanceModule /></ProtectedRoute>} />
              <Route path="/modules/legal" element={<ProtectedRoute><LegalModule /></ProtectedRoute>} />
              
              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
