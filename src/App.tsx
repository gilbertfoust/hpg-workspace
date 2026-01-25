import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

// Pages
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import NGOs from "./pages/NGOs";
import NGODetail from "./pages/NGODetail";
import WorkItems from "./pages/WorkItems";
import Forms from "./pages/Forms";
import Documents from "./pages/Documents";
import CalendarPage from "./pages/CalendarPage";
import ReportsDashboard from "./pages/ReportsDashboard";
import Admin from "./pages/Admin";
import AdminConfigHome from "./pages/AdminConfig/AdminConfigHome";
import NotFound from "./pages/NotFound";

// Feature pages
import MyQueue from "./pages/MyQueue";
import DeptQueue from "./pages/DeptQueue";
import HRDashboard from "./pages/HRDashboard";
import DevelopmentDashboard from "./pages/DevelopmentDashboard";
import PartnershipsDashboard from "./pages/PartnershipsDashboard";
import ITDashboard from "./pages/ITDashboard";
import NGOCoordination from "./pages/NGOCoordination";

// Module pages (placeholders you can flesh out later)
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

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ErrorBoundary>
            {/* IMPORTANT for GitHub Pages */}
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <Routes>
                {/* Auth */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />

                {/* Root redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* Core */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Queues */}
                <Route
                  path="/my-queue"
                  element={
                    <ProtectedRoute>
                      <MyQueue />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dept-queue"
                  element={
                    <ProtectedRoute>
                      <DeptQueue />
                    </ProtectedRoute>
                  }
                />

                {/* Records */}
                <Route
                  path="/ngos"
                  element={
                    <ProtectedRoute>
                      <NGOs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ngos/:id"
                  element={
                    <ProtectedRoute>
                      <NGODetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/work-items"
                  element={
                    <ProtectedRoute>
                      <WorkItems />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/forms"
                  element={
                    <ProtectedRoute>
                      <Forms />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/documents"
                  element={
                    <ProtectedRoute>
                      <Documents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <CalendarPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <ReportsDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Admin */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <Admin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/config"
                  element={
                    <ProtectedRoute>
                      <AdminConfigHome />
                    </ProtectedRoute>
                  }
                />

                {/* Department dashboards */}
                <Route
                  path="/hr"
                  element={
                    <ProtectedRoute>
                      <HRDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/development"
                  element={
                    <ProtectedRoute>
                      <DevelopmentDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/partnerships"
                  element={
                    <ProtectedRoute>
                      <PartnershipsDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/it"
                  element={
                    <ProtectedRoute>
                      <ITDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ngo-coordination"
                  element={
                    <ProtectedRoute>
                      <NGOCoordination />
                    </ProtectedRoute>
                  }
                />

                {/* Module placeholder routes (keep for later) */}
                <Route
                  path="/modules/ngo-coordination"
                  element={
                    <ProtectedRoute>
                      <NGOCoordinationModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/administration"
                  element={
                    <ProtectedRoute>
                      <AdministrationModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/operations"
                  element={
                    <ProtectedRoute>
                      <OperationsModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/program"
                  element={
                    <ProtectedRoute>
                      <ProgramModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/curriculum"
                  element={
                    <ProtectedRoute>
                      <CurriculumModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/development"
                  element={
                    <ProtectedRoute>
                      <DevelopmentModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/partnerships"
                  element={
                    <ProtectedRoute>
                      <PartnershipsModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/marketing"
                  element={
                    <ProtectedRoute>
                      <MarketingModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/communications"
                  element={
                    <ProtectedRoute>
                      <CommunicationsModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/hr"
                  element={
                    <ProtectedRoute>
                      <HRModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/it"
                  element={
                    <ProtectedRoute>
                      <ITModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/finance"
                  element={
                    <ProtectedRoute>
                      <FinanceModule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/modules/legal"
                  element={
                    <ProtectedRoute>
                      <LegalModule />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
