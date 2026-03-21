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
import NGOMissingItems from "./pages/NGOMissingItems";
import WorkItems from "./pages/WorkItems";
import Forms from "./pages/Forms";
import Documents from "./pages/Documents";
import CalendarPage from "./pages/CalendarPage";
import ReportsDashboard from "./pages/ReportsDashboard";
import Admin from "./pages/Admin";
import AdminConfigHome from "./pages/AdminConfig/AdminConfigHome";
import NotFound from "./pages/NotFound";
import ProgramDashboard from "./pages/ProgramDashboard";
import CurriculumDashboard from "./pages/CurriculumDashboard";
import Portal from "./pages/Portal";
import NGOCoordination from "./pages/NGOCoordination";
import ITDashboard from "./pages/ITDashboard";
import SignDocument from "./pages/SignDocument";
import FinancialHub from "./pages/FinancialHub";
import NGOFinancialOverview from "./pages/NGOFinancialOverview";
import PeriodDetail from "./pages/PeriodDetail";
import AccountsPage from "./pages/AccountsPage";
import TransactionsPage from "./pages/TransactionsPage";
import NewTransactionPage from "./pages/NewTransactionPage";
import GeneralLedgerPage from "./pages/GeneralLedgerPage";
import TrialBalancePage from "./pages/TrialBalancePage";
import ComplianceDashboard from "./pages/ComplianceDashboard";
import StatementsPage from "./pages/StatementsPage";
import PackagesPage from "./pages/PackagesPage";
import CloseYearPage from "./pages/CloseYearPage";
import IntakeDashboard from "./pages/IntakeDashboard";
import IntakeReviewPage from "./pages/IntakeReviewPage";
import CostCentersPage from "./pages/CostCentersPage";
import UsageEntriesPage from "./pages/UsageEntriesPage";
import AllocationsPage from "./pages/AllocationsPage";
import ChargebacksPage from "./pages/ChargebacksPage";
import UsageReportsPage from "./pages/UsageReportsPage";
import DepartmentForms from "./pages/DepartmentForms";
import AutomationsDashboard from "./pages/AutomationsDashboard";
import JournalEntryWorkspace from "./pages/JournalEntryWorkspace";
import GeneralLedgerOverview from "./pages/GeneralLedgerOverview";
import AccountLedgerDetail from "./pages/AccountLedgerDetail";
import TrialBalanceWorksheet from "./pages/TrialBalanceWorksheet";
import ProfitAndLoss from "./pages/ProfitAndLoss";
import BalanceSheetPage from "./pages/BalanceSheetPage";
import CashFlowStatement from "./pages/CashFlowStatement";
import CashFlowForecastPage from "./pages/CashFlowForecastPage";
import BankReconciliationPage from "./pages/BankReconciliationPage";
import PeriodComparisonPage from "./pages/PeriodComparisonPage";
import InvoicesPage from "./pages/InvoicesPage";
import AgedReceivablesPage from "./pages/AgedReceivablesPage";
import BillsPage from "./pages/BillsPage";
import AgedPayablesPage from "./pages/AgedPayablesPage";
import RecurringTransactionsPage from "./pages/RecurringTransactionsPage";
import TaxLiabilityPage from "./pages/TaxLiabilityPage";
import MyQueue from "./pages/MyQueue";
import DeptQueue from "./pages/DeptQueue";
import HRDashboard from "./pages/HRDashboard";
import DevelopmentDashboard from "./pages/DevelopmentDashboard";
import PartnershipsDashboard from "./pages/PartnershipsDashboard";

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

// ERP Module pages
import CRMDashboard from "./modules/crm/pages/CRMDashboard";
import CRMContacts from "./modules/crm/pages/CRMContacts";
import CRMOrganizations from "./modules/crm/pages/CRMOrganizations";
import CRMInteractions from "./modules/crm/pages/CRMInteractions";
import CRMPipeline from "./modules/crm/pages/CRMPipeline";

import ProcurementDashboard from "./modules/procurement/pages/ProcurementDashboard";
import PurchaseRequests from "./modules/procurement/pages/PurchaseRequests";
import PurchaseOrders from "./modules/procurement/pages/PurchaseOrders";
import VendorInvoices from "./modules/procurement/pages/VendorInvoices";
import GoodsReceived from "./modules/procurement/pages/GoodsReceived";

import GrantsDashboard from "./modules/grants/pages/GrantsDashboard";
import GrantSearch from "./modules/grants/pages/GrantSearch";
import GrantPipeline from "./modules/grants/pages/GrantPipeline";
import GrantProfile from "./modules/grants/pages/GrantProfile";

import HRModuleDashboard from "./modules/hr/pages/HRModuleDashboard";
import StaffProfiles from "./modules/hr/pages/StaffProfiles";
import Timesheets from "./modules/hr/pages/Timesheets";
import PTOManagement from "./modules/hr/pages/PTOManagement";
import PayrollExport from "./modules/hr/pages/PayrollExport";

import AssetsDashboard from "./modules/assets/pages/AssetsDashboard";
import AssetRegistry from "./modules/assets/pages/AssetRegistry";
import DepreciationPage from "./modules/assets/pages/Depreciation";
import MaintenancePage from "./modules/assets/pages/Maintenance";

import InventoryDashboard from "./modules/inventory/pages/InventoryDashboard";
import InventoryItems from "./modules/inventory/pages/InventoryItems";
import StockMovements from "./modules/inventory/pages/StockMovements";
import SupplyRequests from "./modules/inventory/pages/SupplyRequests";

import RevenueDashboard from "./modules/revenue/pages/RevenueDashboard";
import DonationTypes from "./modules/revenue/pages/DonationTypes";
import RecurringRevenue from "./modules/revenue/pages/RecurringRevenue";
import RevenueRecognition from "./modules/revenue/pages/RevenueRecognition";

import GovernanceDashboard from "./modules/governance/pages/GovernanceDashboard";
import FXRates from "./modules/governance/pages/FXRates";
import CountryCompliance from "./modules/governance/pages/CountryCompliance";
import LocalizedCOA from "./modules/governance/pages/LocalizedCOA";

import AuditDashboard from "./modules/audit/pages/AuditDashboard";
import AuditTrail from "./modules/audit/pages/AuditTrail";
import PermissionChanges from "./modules/audit/pages/PermissionChanges";

import ControllerDashboard from "./modules/controller/pages/ControllerDashboard";
import NgoControllerDetail from "./modules/controller/pages/NgoControllerDetail";
import Consolidation from "./modules/controller/pages/Consolidation";
import RiskScoring from "./modules/controller/pages/RiskScoring";
import InterNGOTransfers from "./modules/controller/pages/InterNGOTransfers";
import Treasury from "./modules/controller/pages/Treasury";

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

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

                {/* Public signing page (no auth required) */}
                <Route path="/sign/:token" element={<SignDocument />} />

                {/* Root redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* Core */}
                <Route path="/dashboard" element={<P><Dashboard /></P>} />

                {/* Queues */}
                <Route path="/my-queue" element={<P><MyQueue /></P>} />
                <Route path="/dept-queue" element={<P><DeptQueue /></P>} />

                {/* Records */}
                <Route path="/ngos" element={<P><NGOs /></P>} />
                <Route path="/ngos/:id" element={<P><NGODetail /></P>} />
                <Route path="/work-items" element={<P><WorkItems /></P>} />
                <Route path="/forms" element={<P><Forms /></P>} />
                <Route path="/documents" element={<P><Documents /></P>} />
                <Route path="/calendar" element={<P><CalendarPage /></P>} />
                <Route path="/reports" element={<P><ReportsDashboard /></P>} />

                {/* Admin */}
                <Route path="/admin" element={<P><Admin /></P>} />
                <Route path="/admin/config" element={<P><AdminConfigHome /></P>} />

                {/* Department dashboards */}
                <Route path="/hr" element={<P><HRDashboard /></P>} />
                <Route path="/development" element={<P><DevelopmentDashboard /></P>} />
                <Route path="/partnerships" element={<P><PartnershipsDashboard /></P>} />
                <Route path="/it" element={<P><ITDashboard /></P>} />
                <Route path="/ngo-coordination" element={<P><NGOCoordination /></P>} />

                {/* Financial Hub */}
                <Route path="/financial-hub" element={<P><FinancialHub /></P>} />
                <Route path="/financial-hub/ngo/:ngoId" element={<P><NGOFinancialOverview /></P>} />
                <Route path="/financial-hub/ngo/:ngoId/period/:periodId" element={<P><PeriodDetail /></P>} />
                <Route path="/financial-hub/accounts" element={<P><AccountsPage /></P>} />
                <Route path="/financial-hub/transactions" element={<P><TransactionsPage /></P>} />
                <Route path="/financial-hub/transactions/new" element={<P><NewTransactionPage /></P>} />
                <Route path="/financial-hub/ledger" element={<P><GeneralLedgerPage /></P>} />
                <Route path="/financial-hub/trial-balance" element={<P><TrialBalancePage /></P>} />
                <Route path="/financial-hub/intake" element={<P><IntakeDashboard /></P>} />
                <Route path="/financial-hub/intake/review/:intakeId" element={<P><IntakeReviewPage /></P>} />
                <Route path="/financial-hub/compliance" element={<P><ComplianceDashboard /></P>} />
                <Route path="/financial-hub/compliance/statements" element={<P><StatementsPage /></P>} />
                <Route path="/financial-hub/compliance/packages" element={<P><PackagesPage /></P>} />
                <Route path="/financial-hub/compliance/close-year" element={<P><CloseYearPage /></P>} />
                <Route path="/financial-hub/cost-centers" element={<P><CostCentersPage /></P>} />
                <Route path="/financial-hub/usage" element={<P><UsageEntriesPage /></P>} />
                <Route path="/financial-hub/allocations" element={<P><AllocationsPage /></P>} />
                <Route path="/financial-hub/chargebacks" element={<P><ChargebacksPage /></P>} />
                <Route path="/financial-hub/usage/reports" element={<P><UsageReportsPage /></P>} />
                <Route path="/financial-hub/journal" element={<P><JournalEntryWorkspace /></P>} />
                <Route path="/financial-hub/general-ledger" element={<P><GeneralLedgerOverview /></P>} />
                <Route path="/financial-hub/general-ledger/account/:accountId" element={<P><AccountLedgerDetail /></P>} />
                <Route path="/financial-hub/trial-balance-worksheet" element={<P><TrialBalanceWorksheet /></P>} />
                <Route path="/financial-hub/reports/profit-and-loss" element={<P><ProfitAndLoss /></P>} />
                <Route path="/financial-hub/reports/balance-sheet" element={<P><BalanceSheetPage /></P>} />
                <Route path="/financial-hub/reports/cash-flow-statement" element={<P><CashFlowStatement /></P>} />
                <Route path="/financial-hub/cash-flow-forecast" element={<P><CashFlowForecastPage /></P>} />
                <Route path="/financial-hub/cash-flow-forecast/:forecastId" element={<P><CashFlowForecastPage /></P>} />
                <Route path="/financial-hub/reconciliation" element={<P><BankReconciliationPage /></P>} />
                <Route path="/financial-hub/reports/period-comparison" element={<P><PeriodComparisonPage /></P>} />

                {/* Department Forms */}
                <Route path="/department-forms" element={<P><DepartmentForms /></P>} />

                {/* Automations */}
                <Route path="/automations" element={<P><AutomationsDashboard /></P>} />

                {/* Module placeholder routes */}
                <Route path="/modules/ngo-coordination" element={<P><NGOCoordinationModule /></P>} />
                <Route path="/modules/administration" element={<P><AdministrationModule /></P>} />
                <Route path="/modules/operations" element={<P><OperationsModule /></P>} />
                <Route path="/modules/program" element={<P><ProgramModule /></P>} />
                <Route path="/modules/curriculum" element={<P><CurriculumModule /></P>} />
                <Route path="/modules/development" element={<P><DevelopmentModule /></P>} />
                <Route path="/modules/partnerships" element={<P><PartnershipsModule /></P>} />
                <Route path="/modules/marketing" element={<P><MarketingModule /></P>} />
                <Route path="/modules/communications" element={<P><CommunicationsModule /></P>} />
                <Route path="/modules/hr" element={<P><HRModule /></P>} />
                <Route path="/modules/it" element={<P><ITModule /></P>} />
                <Route path="/modules/finance" element={<P><FinanceModule /></P>} />
                <Route path="/modules/legal" element={<P><LegalModule /></P>} />

                {/* === ERP Modules === */}

                {/* CRM */}
                <Route path="/crm" element={<P><CRMDashboard /></P>} />
                <Route path="/crm/contacts" element={<P><CRMContacts /></P>} />
                <Route path="/crm/organizations" element={<P><CRMOrganizations /></P>} />
                <Route path="/crm/interactions" element={<P><CRMInteractions /></P>} />
                <Route path="/crm/pipeline" element={<P><CRMPipeline /></P>} />

                {/* Procurement */}
                <Route path="/procurement" element={<P><ProcurementDashboard /></P>} />
                <Route path="/procurement/requests" element={<P><PurchaseRequests /></P>} />
                <Route path="/procurement/orders" element={<P><PurchaseOrders /></P>} />
                <Route path="/procurement/invoices" element={<P><VendorInvoices /></P>} />
                <Route path="/procurement/received" element={<P><GoodsReceived /></P>} />

                {/* Grants */}
                <Route path="/grants" element={<P><GrantsDashboard /></P>} />
                <Route path="/grants/search" element={<P><GrantSearch /></P>} />
                <Route path="/grants/pipeline" element={<P><GrantPipeline /></P>} />
                <Route path="/grants/profile/:id" element={<P><GrantProfile /></P>} />

                {/* HR & Workforce (ERP) */}
                <Route path="/erp/hr" element={<P><HRModuleDashboard /></P>} />
                <Route path="/erp/hr/staff" element={<P><StaffProfiles /></P>} />
                <Route path="/erp/hr/timesheets" element={<P><Timesheets /></P>} />
                <Route path="/erp/hr/pto" element={<P><PTOManagement /></P>} />
                <Route path="/erp/hr/payroll" element={<P><PayrollExport /></P>} />

                {/* Assets */}
                <Route path="/assets" element={<P><AssetsDashboard /></P>} />
                <Route path="/assets/registry" element={<P><AssetRegistry /></P>} />
                <Route path="/assets/depreciation" element={<P><DepreciationPage /></P>} />
                <Route path="/assets/maintenance" element={<P><MaintenancePage /></P>} />

                {/* Inventory */}
                <Route path="/inventory" element={<P><InventoryDashboard /></P>} />
                <Route path="/inventory/items" element={<P><InventoryItems /></P>} />
                <Route path="/inventory/movements" element={<P><StockMovements /></P>} />
                <Route path="/inventory/requests" element={<P><SupplyRequests /></P>} />

                {/* Revenue */}
                <Route path="/revenue" element={<P><RevenueDashboard /></P>} />
                <Route path="/revenue/donations" element={<P><DonationTypes /></P>} />
                <Route path="/revenue/recurring" element={<P><RecurringRevenue /></P>} />
                <Route path="/revenue/recognition" element={<P><RevenueRecognition /></P>} />

                {/* Governance */}
                <Route path="/governance" element={<P><GovernanceDashboard /></P>} />
                <Route path="/governance/fx" element={<P><FXRates /></P>} />
                <Route path="/governance/compliance" element={<P><CountryCompliance /></P>} />
                <Route path="/governance/coa" element={<P><LocalizedCOA /></P>} />

                {/* Audit */}
                <Route path="/audit" element={<P><AuditDashboard /></P>} />
                <Route path="/audit/trail" element={<P><AuditTrail /></P>} />
                <Route path="/audit/permissions" element={<P><PermissionChanges /></P>} />

                {/* Controller */}
                <Route path="/controller" element={<P><ControllerDashboard /></P>} />
                <Route path="/controller/ngo/:ngoId" element={<P><NgoControllerDetail /></P>} />
                <Route path="/controller/consolidation" element={<P><Consolidation /></P>} />
                <Route path="/controller/risk" element={<P><RiskScoring /></P>} />
                <Route path="/controller/transfers" element={<P><InterNGOTransfers /></P>} />
                <Route path="/controller/treasury" element={<P><Treasury /></P>} />

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
