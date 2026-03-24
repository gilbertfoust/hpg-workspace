import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  ListChecks,
  ClipboardList,
  FileText,
  FolderOpen,
  Calendar,
  AlertTriangle,
  Layers,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Users,
  Briefcase,
  DollarSign,
  Scale,
  Megaphone,
  ShieldCheck,
  MessageSquare,
  GraduationCap,
  Wrench,
  Monitor,
  Handshake,
  UserPlus,
  Menu,
  X,
  LogOut,
  Contact,
  ShoppingCart,
  Award,
  Package,
  Warehouse,
  TrendingUp,
  Globe,
  Eye,
  Building,
  Combine,
  Activity,
  ArrowLeftRight,
  PieChart,
  FolderKanban,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

const NavItem = ({ to, icon, label, badge }: NavItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <NavLink
      to={to}
      className={cn(
        "nav-item group",
        isActive && "active"
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-sidebar-primary text-sidebar-primary-foreground text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
};

interface ModuleSection {
  title: string;
  items: { to: string; icon: React.ReactNode; label: string }[];
}

const modulesSections: ModuleSection[] = [
  {
    title: "Core Operations",
    items: [
      { to: "/ngo-coordination", icon: <Users className="w-4 h-4" />, label: "NGO Coordination" },
      { to: "/modules/administration", icon: <Briefcase className="w-4 h-4" />, label: "Administration" },
      { to: "/modules/operations", icon: <Wrench className="w-4 h-4" />, label: "Operations" },
    ],
  },
  {
    title: "Programs",
    items: [
      { to: "/program", icon: <GraduationCap className="w-4 h-4" />, label: "Program" },
      { to: "/curriculum", icon: <FileText className="w-4 h-4" />, label: "Curriculum" },
    ],
  },
  {
    title: "Development",
    items: [
      { to: "/development", icon: <DollarSign className="w-4 h-4" />, label: "Development" },
      { to: "/partnerships", icon: <Handshake className="w-4 h-4" />, label: "Partnerships" },
      { to: "/modules/marketing", icon: <Megaphone className="w-4 h-4" />, label: "Marketing" },
      { to: "/modules/communications", icon: <MessageSquare className="w-4 h-4" />, label: "Communications" },
    ],
  },
  {
    title: "Support",
    items: [
      { to: "/modules/hr", icon: <UserPlus className="w-4 h-4" />, label: "HR" },
      { to: "/it", icon: <Monitor className="w-4 h-4" />, label: "IT" },
      { to: "/modules/finance", icon: <DollarSign className="w-4 h-4" />, label: "Finance" },
      { to: "/modules/legal", icon: <Scale className="w-4 h-4" />, label: "Legal" },
    ],
  },
];

const erpModules = [
  { to: "/crm", icon: <Contact className="w-4 h-4" />, label: "CRM" },
  { to: "/procurement", icon: <ShoppingCart className="w-4 h-4" />, label: "Procurement" },
  { to: "/grants", icon: <Award className="w-4 h-4" />, label: "Grants" },
  { to: "/erp/hr", icon: <Users className="w-4 h-4" />, label: "HR & Workforce", subItems: [
    { to: "/erp/hr/staff", label: "Staff Profiles" },
    { to: "/erp/hr/timesheets", label: "Timesheets" },
    { to: "/erp/hr/pto", label: "PTO" },
    { to: "/erp/hr/onboarding", label: "Onboarding" },
    { to: "/erp/hr/reviews", label: "Reviews" },
    { to: "/erp/hr/payroll/runs", label: "Pay Runs" },
    { to: "/erp/hr/directory", label: "Directory" },
    { to: "/erp/hr/analytics", label: "Analytics" },
    { to: "/erp/hr/recruiting", label: "Recruiting (ATS)" },
  ]},
  { to: "/assets", icon: <Package className="w-4 h-4" />, label: "Assets" },
  { to: "/inventory", icon: <Warehouse className="w-4 h-4" />, label: "Inventory" },
  { to: "/revenue", icon: <TrendingUp className="w-4 h-4" />, label: "Revenue" },
  { to: "/governance", icon: <Globe className="w-4 h-4" />, label: "Governance" },
  { to: "/audit", icon: <Eye className="w-4 h-4" />, label: "Audit" },
  { to: "/controller", icon: <Building className="w-4 h-4" />, label: "Controller Hub" },
];

export function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const [expandedModules, setExpandedModules] = useState(false);
  const [expandedERP, setExpandedERP] = useState(false);
  const { user, signOut } = useAuth();
  const { data: userRole } = useUserRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const canAccessAdminConfig = userRole?.role === 'super_admin' || userRole?.role === 'admin_pm';

  const userInitials = user?.user_metadata?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user?.email?.slice(0, 2).toUpperCase() || 'U';

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const roleLabel = userRole?.role?.replace('_', ' ') || 'Staff';

  const handleSignOut = async () => {
    const { error } = await signOut();
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: error.message || "Unable to sign out. Please try again.",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      const base = import.meta.env.BASE_URL || "/";
      navigate(`${base}auth`, { replace: true });
    }
  };

  // Auto-expand ERP section if on an ERP route
  const isOnERPRoute = erpModules.some(m => location.pathname.startsWith(m.to));

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300",
          isCollapsed ? "-translate-x-full lg:translate-x-0 lg:w-16" : "w-64",
          "lg:relative lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo / Header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-auto max-w-full object-contain cursor-pointer hover:opacity-80 transition-opacity",
                    isCollapsed ? "h-8" : "h-10 max-w-[180px]"
                  )}
                >
                  <img
                    src="https://img1.wsimg.com/isteam/ip/8d5502d6-d937-4d80-bd56-8074053e4d77/Humanity%20Pathways%20Global.jpg/:/rs=h:175,m"
                    alt="Humanity Pathways Global"
                    className={cn(
                      "w-auto max-w-full object-contain",
                      isCollapsed ? "h-8" : "h-10 max-w-[180px]"
                    )}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-white hover:bg-sidebar-accent"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="px-2 space-y-1">
              {/* Main Navigation */}
              <NavItem to="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label={isCollapsed ? "" : "Dashboard"} />
              <NavItem to="/my-queue" icon={<ListChecks className="w-4 h-4" />} label={isCollapsed ? "" : "My Queue"} />
              <NavItem to="/dept-queue" icon={<Users className="w-4 h-4" />} label={isCollapsed ? "" : "Dept Queue"} />
              <NavItem to="/ngos" icon={<Building2 className="w-4 h-4" />} label={isCollapsed ? "" : "NGOs"} />
              <NavItem to="/ngo-missing-items" icon={<AlertTriangle className="w-4 h-4" />} label={isCollapsed ? "" : "NGO Missing Items"} />
              <NavItem to="/work-items" icon={<ClipboardList className="w-4 h-4" />} label={isCollapsed ? "" : "Work Items"} badge={12} />
              <NavItem to="/forms" icon={<FileText className="w-4 h-4" />} label={isCollapsed ? "" : "Forms"} />
              <NavItem to="/department-forms" icon={<FolderKanban className="w-4 h-4" />} label={isCollapsed ? "" : "Department Forms"} />
              <NavItem to="/documents" icon={<FolderOpen className="w-4 h-4" />} label={isCollapsed ? "" : "Documents"} />
              <NavItem to="/calendar" icon={<Calendar className="w-4 h-4" />} label={isCollapsed ? "" : "Calendar"} />
              
              <NavItem to="/financial-hub" icon={<DollarSign className="w-4 h-4" />} label={isCollapsed ? "" : "Financial Hub"} />
              {!isCollapsed && location.pathname.startsWith("/financial-hub") && (
                <div className="ml-6 space-y-0.5">
                  <NavItem to="/financial-hub/journal" icon={<ClipboardList className="w-3.5 h-3.5" />} label="Journal" />
                  <NavItem to="/financial-hub/general-ledger" icon={<FileText className="w-3.5 h-3.5" />} label="General Ledger" />
                  <NavItem to="/financial-hub/accounts" icon={<Layers className="w-3.5 h-3.5" />} label="Chart of Accounts" />
                  <NavItem to="/financial-hub/transactions" icon={<ClipboardList className="w-3.5 h-3.5" />} label="Transactions" />
                  <NavItem to="/financial-hub/trial-balance-worksheet" icon={<BarChart3 className="w-3.5 h-3.5" />} label="Trial Balance" />
                  <NavItem to="/financial-hub/opening-balances" icon={<Layers className="w-3.5 h-3.5" />} label="Opening Balances" />
                  <NavItem to="/financial-hub/reports/profit-and-loss" icon={<TrendingUp className="w-3.5 h-3.5" />} label="Profit & Loss" />
                  <NavItem to="/financial-hub/reports/balance-sheet" icon={<Layers className="w-3.5 h-3.5" />} label="Balance Sheet" />
                  <NavItem to="/financial-hub/reports/cash-flow-statement" icon={<Activity className="w-3.5 h-3.5" />} label="Cash Flow Statement" />
                  <NavItem to="/financial-hub/cash-flow-forecast" icon={<PieChart className="w-3.5 h-3.5" />} label="Cash Flow Forecast" />
                  <NavItem to="/financial-hub/reconciliation" icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Reconciliation" />
                  <NavItem to="/financial-hub/reports/period-comparison" icon={<ArrowLeftRight className="w-3.5 h-3.5" />} label="Period Comparison" />
                  <NavItem to="/financial-hub/invoices" icon={<FileText className="w-3.5 h-3.5" />} label="Invoices (AR)" />
                  <NavItem to="/financial-hub/bills" icon={<ClipboardList className="w-3.5 h-3.5" />} label="Bills (AP)" />
                  <NavItem to="/financial-hub/recurring-transactions" icon={<Zap className="w-3.5 h-3.5" />} label="Recurring" />
                  <NavItem to="/financial-hub/reports/aged-receivables" icon={<BarChart3 className="w-3.5 h-3.5" />} label="Aged Receivables" />
                  <NavItem to="/financial-hub/reports/aged-payables" icon={<BarChart3 className="w-3.5 h-3.5" />} label="Aged Payables" />
                  <NavItem to="/financial-hub/reports/tax-liability" icon={<DollarSign className="w-3.5 h-3.5" />} label="Tax Liability" />
                  <NavItem to="/financial-hub/intake" icon={<FileText className="w-3.5 h-3.5" />} label="Intake" />
                  <NavItem to="/financial-hub/compliance" icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Compliance" />
                  <NavItem to="/financial-hub/cost-centers" icon={<Combine className="w-3.5 h-3.5" />} label="Cost Centers" />
                  <NavItem to="/financial-hub/usage" icon={<Activity className="w-3.5 h-3.5" />} label="Usage Tracking" />
                  <NavItem to="/financial-hub/allocations" icon={<PieChart className="w-3.5 h-3.5" />} label="Allocations" />
                  <NavItem to="/financial-hub/chargebacks" icon={<ArrowLeftRight className="w-3.5 h-3.5" />} label="Chargebacks" />
                </div>
              )}

              {!isCollapsed && (
                <div className="pt-4">
                  <p className="nav-section-title">Executive</p>
                  <div className="space-y-1">
                    <NavItem to="/reports" icon={<BarChart3 className="w-4 h-4" />} label="Reports" />
                  </div>
                </div>
              )}

              {/* Modules Section */}
              {!isCollapsed && (
                <div className="pt-4">
                  <button
                    onClick={() => setExpandedModules(!expandedModules)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/70 hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Modules
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", expandedModules && "rotate-180")} />
                  </button>

                  {expandedModules && (
                    <div className="mt-2 space-y-4 animate-fade-in">
                      {modulesSections.map((section) => (
                        <div key={section.title}>
                          <p className="nav-section-title">{section.title}</p>
                          <div className="space-y-1">
                            {section.items.map((item) => (
                              <NavItem key={item.to} {...item} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ERP Modules Section */}
              {!isCollapsed && (
                <div className="pt-4">
                  <button
                    onClick={() => setExpandedERP(!expandedERP)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/70 hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      ERP Modules
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", (expandedERP || isOnERPRoute) && "rotate-180")} />
                  </button>

                  {(expandedERP || isOnERPRoute) && (
                    <div className="mt-2 space-y-1 animate-fade-in">
                      {erpModules.map((item) => (
                        <div key={item.to}>
                          <NavItem to={item.to} icon={item.icon} label={item.label} />
                          {(item as any).subItems && location.pathname.startsWith(item.to) && (
                            <div className="ml-6 space-y-0.5">
                              {(item as any).subItems.map((sub: { to: string; label: string }) => (
                                <NavItem key={sub.to} to={sub.to} icon={<ChevronRight className="w-3 h-3" />} label={sub.label} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer Navigation */}
              <div className="pt-4 mt-4 border-t border-sidebar-border">
                {isCollapsed && (
                  <NavItem to="/reports" icon={<BarChart3 className="w-4 h-4" />} label="" />
                )}
                <NavItem to="/automations" icon={<Zap className="w-4 h-4" />} label={isCollapsed ? "" : "Automations"} />
                <NavItem to="/admin" icon={<Settings className="w-4 h-4" />} label={isCollapsed ? "" : "Admin"} />
                {canAccessAdminConfig && (
                  <NavItem
                    to="/admin/config"
                    icon={<Settings className="w-4 h-4" />}
                    label={isCollapsed ? "" : "Admin / Config"}
                  />
                )}
              </div>
            </nav>
          </ScrollArea>

          {/* User section */}
          {!isCollapsed && (
            <div className="p-4 border-t border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <span className="text-xs font-medium text-sidebar-foreground">{userInitials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
                  <p className="text-xs text-sidebar-muted truncate capitalize">{roleLabel}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={handleSignOut}
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
