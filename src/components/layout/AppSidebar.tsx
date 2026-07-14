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
  Rocket,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentProfile } from "@/hooks/useProfiles";
import { UserAvatar, getUserDisplayName, getUserInitials } from "@/components/common/UserAvatar";
import { canAccessArea, canAccessAdmin, getRoleLabel } from "@/lib/accessControl";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useWorkItems } from "@/hooks/useWorkItems";
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

interface HubConfig {
  title: string;
  icon: React.ReactNode;
  basePaths: string[];
  items: { to: string; icon: React.ReactNode; label: string; subItems?: { to: string; label: string }[] }[];
}

const hubsSections: HubConfig[] = [
  {
    title: "Financial Hub",
    icon: <DollarSign className="w-4 h-4" />,
    basePaths: ["/financial-hub", "/procurement", "/assets", "/inventory", "/revenue", "/controller", "/governance"],
    items: [
      { to: "/financial-hub", icon: <DollarSign className="w-4 h-4" />, label: "Finance Dashboard" },
      { to: "/procurement", icon: <ShoppingCart className="w-4 h-4" />, label: "Procurement" },
      { to: "/assets", icon: <Package className="w-4 h-4" />, label: "Assets" },
      { to: "/inventory", icon: <Warehouse className="w-4 h-4" />, label: "Inventory" },
      { to: "/revenue", icon: <TrendingUp className="w-4 h-4" />, label: "Revenue" },
      { to: "/controller", icon: <Building className="w-4 h-4" />, label: "Controller Hub" },
      { to: "/governance", icon: <Globe className="w-4 h-4" />, label: "Governance" },
    ],
  },
  {
    title: "HR Hub",
    icon: <Users className="w-4 h-4" />,
    basePaths: ["/erp/hr"],
    items: [
      { to: "/erp/hr", icon: <Users className="w-4 h-4" />, label: "HR Dashboard", subItems: [
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
    ],
  },
  {
    title: "Development Hub",
    icon: <Megaphone className="w-4 h-4" />,
    basePaths: ["/development", "/partnerships", "/crm", "/grants"],
    items: [
      { to: "/development", icon: <DollarSign className="w-4 h-4" />, label: "Development" },
      { to: "/development/potential-sponsees", icon: <Handshake className="w-4 h-4" />, label: "Potential Sponsees" },
      { to: "/partnerships", icon: <Handshake className="w-4 h-4" />, label: "Partnerships" },
      { to: "/crm", icon: <Contact className="w-4 h-4" />, label: "CRM" },
      { to: "/grants", icon: <Award className="w-4 h-4" />, label: "Grants" },
    ],
  },
  {
    title: "Program Hub",
    icon: <GraduationCap className="w-4 h-4" />,
    basePaths: ["/program", "/curriculum"],
    items: [
      { to: "/program", icon: <GraduationCap className="w-4 h-4" />, label: "Program" },
      { to: "/curriculum", icon: <FileText className="w-4 h-4" />, label: "Curriculum" },
    ],
  },
  {
    title: "Compliance Hub",
    icon: <ShieldCheck className="w-4 h-4" />,
    basePaths: ["/audit", "/financial-hub/compliance"],
    items: [
      { to: "/audit", icon: <Eye className="w-4 h-4" />, label: "Audit" },
      { to: "/financial-hub/compliance", icon: <ShieldCheck className="w-4 h-4" />, label: "Compliance" },
      { to: "/financial-hub/compliance/policies", icon: <ClipboardList className="w-4 h-4" />, label: "Policy Registry" },
    ],
  },
];

export function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const [expandedHubs, setExpandedHubs] = useState<Record<string, boolean>>({});
  const { user, signOut } = useAuth();
  const { data: userRole } = useUserRole();
  const { data: profile } = useCurrentProfile();
  const { data: activeWorkItems } = useWorkItems();
  const activeWorkItemCount = activeWorkItems?.length ?? 0;
  const { toast } = useToast();
  const navigate = useNavigate();
  const canAccessAdminConfig = canAccessAdmin(userRole?.role);
  const role = userRole?.role;

  const visibleHubs = hubsSections.filter((hub) => {
    if (hub.title === "Financial Hub") return canAccessArea(role, "finance");
    if (hub.title === "HR Hub") return canAccessArea(role, "hr");
    if (hub.title === "Development Hub") return canAccessArea(role, "development");
    if (hub.title === "Program Hub") return canAccessArea(role, "grants") || canAccessArea(role, "work_items");
    if (hub.title === "Compliance Hub") return canAccessArea(role, "finance") || canAccessArea(role, "documents");
    return true;
  });

  const displayName = getUserDisplayName(profile?.full_name ?? user?.user_metadata?.full_name, profile?.email ?? user?.email);
  const userInitials = getUserInitials(profile?.full_name ?? user?.user_metadata?.full_name, profile?.email ?? user?.email);
  const roleLabel = getRoleLabel(role);

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
      navigate("/auth", { replace: true });
    }
  };

  const toggleHub = (title: string) => {
    setExpandedHubs(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const isHubActive = (hub: HubConfig) =>
    hub.basePaths.some(p => location.pathname.startsWith(p));


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
              <NavItem to="/modules/ngo-coordination" icon={<Bot className="w-4 h-4" />} label={isCollapsed ? "" : "HPG Assistant"} />
              <NavItem to="/my-queue" icon={<ListChecks className="w-4 h-4" />} label={isCollapsed ? "" : "My Queue"} />
              <NavItem to="/dept-queue" icon={<Users className="w-4 h-4" />} label={isCollapsed ? "" : "Dept Queue"} />
              <NavItem to="/ngos" icon={<Building2 className="w-4 h-4" />} label={isCollapsed ? "" : "NGOs"} />
              <NavItem to="/ngo-coordination/onboarding" icon={<Rocket className="w-4 h-4" />} label={isCollapsed ? "" : "NGO Onboarding"} />
              <NavItem to="/ngo-missing-items" icon={<AlertTriangle className="w-4 h-4" />} label={isCollapsed ? "" : "NGO Missing Items"} />
              <NavItem to="/work-items" icon={<ClipboardList className="w-4 h-4" />} label={isCollapsed ? "" : "Work Items"} badge={activeWorkItemCount} />
              <NavItem to="/forms" icon={<FileText className="w-4 h-4" />} label={isCollapsed ? "" : "Forms"} />
              <NavItem to="/department-forms" icon={<FolderKanban className="w-4 h-4" />} label={isCollapsed ? "" : "Department Forms"} />
              <NavItem to="/documents" icon={<FolderOpen className="w-4 h-4" />} label={isCollapsed ? "" : "Documents"} />
              <NavItem to="/calendar" icon={<Calendar className="w-4 h-4" />} label={isCollapsed ? "" : "Calendar"} />

              {!isCollapsed && (
                <div className="pt-4">
                  <p className="nav-section-title">Executive</p>
                  <div className="space-y-1">
                    <NavItem to="/reports" icon={<BarChart3 className="w-4 h-4" />} label="Reports" />
                  </div>
                </div>
              )}

              {/* Hubs Section */}
              {!isCollapsed && (
                <div className="pt-4">
                  <p className="nav-section-title">Hubs</p>
                  <div className="space-y-1">
                    {visibleHubs.map((hub) => {
                      const isOpen = expandedHubs[hub.title] || isHubActive(hub);
                      return (
                        <div key={hub.title}>
                          <button
                            onClick={() => toggleHub(hub.title)}
                            className={cn(
                              "nav-item group w-full flex items-center justify-between",
                              isHubActive(hub) && "active"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              {hub.icon}
                              <span>{hub.title}</span>
                            </span>
                            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
                          </button>
                          {isOpen && (
                            <div className="ml-4 space-y-0.5 animate-fade-in">
                              {hub.items.map((item) => (
                                <div key={item.to}>
                                  <NavItem to={item.to} icon={item.icon} label={item.label} />
                                  {item.subItems && location.pathname.startsWith(item.to) && (
                                    <div className="ml-5 space-y-0.5">
                                      {item.subItems.map((sub) => (
                                        <NavItem key={sub.to} to={sub.to} icon={<ChevronRight className="w-3 h-3" />} label={sub.label} />
                                      ))}
                                    </div>
                                  )}
                                  {/* Financial Hub sub-pages */}
                                  {item.to === "/financial-hub" && location.pathname.startsWith("/financial-hub") && (
                                    <div className="ml-5 space-y-0.5">
                                      <NavItem to="/financial-hub/operations" icon={<ClipboardList className="w-3.5 h-3.5" />} label="Operations" />
                                      <NavItem to="/financial-hub/accounting/chart-of-accounts" icon={<Layers className="w-3.5 h-3.5" />} label="Chart of Accounts" />
                                      <NavItem to="/financial-hub/accounting/journal-entries" icon={<FileText className="w-3.5 h-3.5" />} label="Journal Entries" />
                                      <NavItem to="/financial-hub/accounting/transactions" icon={<ClipboardList className="w-3.5 h-3.5" />} label="Transactions" />
                                      <NavItem to="/financial-hub/accounting/bank-accounts" icon={<DollarSign className="w-3.5 h-3.5" />} label="Bank Accounts" />
                                      <NavItem to="/financial-hub/accounting/receipts" icon={<FileText className="w-3.5 h-3.5" />} label="Receipts" />
                                      <NavItem to="/financial-hub/accounting/accounts-payable" icon={<ClipboardList className="w-3.5 h-3.5" />} label="Accounts Payable" />
                                      <NavItem to="/financial-hub/accounting/payments" icon={<DollarSign className="w-3.5 h-3.5" />} label="Disbursements" />
                                      <NavItem to="/financial-hub/accounting/deposits" icon={<TrendingUp className="w-3.5 h-3.5" />} label="Deposits" />
                                      <NavItem to="/financial-hub/accounting/reconciliation" icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Reconciliation" />
                                      <NavItem to="/financial-hub/accounting/budgets" icon={<PieChart className="w-3.5 h-3.5" />} label="Budgets" />
                                      <NavItem to="/financial-hub/accounting/accounts-receivable" icon={<FileText className="w-3.5 h-3.5" />} label="Accounts Receivable" />
                                      <NavItem to="/financial-hub/accounting/reports" icon={<BarChart3 className="w-3.5 h-3.5" />} label="Financial Reports" />
                                      <NavItem to="/financial-hub/accounting/fiscal-periods" icon={<Activity className="w-3.5 h-3.5" />} label="Fiscal Periods" />
                                      <NavItem to="/financial-hub/accounting/compliance" icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Compliance" />
                                      <NavItem to="/financial-hub/accounting/opening-balances" icon={<Layers className="w-3.5 h-3.5" />} label="Opening Balances" />
                                      <NavItem to="/financial-hub/intake" icon={<FileText className="w-3.5 h-3.5" />} label="Intake" />
                                      <NavItem to="/financial-hub/cost-centers" icon={<Combine className="w-3.5 h-3.5" />} label="Cost Centers" />
                                      <NavItem to="/financial-hub/usage" icon={<Activity className="w-3.5 h-3.5" />} label="Usage Tracking" />
                                      <NavItem to="/financial-hub/allocations" icon={<PieChart className="w-3.5 h-3.5" />} label="Allocations" />
                                      <NavItem to="/financial-hub/chargebacks" icon={<ArrowLeftRight className="w-3.5 h-3.5" />} label="Chargebacks" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer Navigation */}
              <div className="pt-4 mt-4 border-t border-sidebar-border">
                {isCollapsed && (
                  <NavItem to="/reports" icon={<BarChart3 className="w-4 h-4" />} label="" />
                )}
                <NavItem to="/automations" icon={<Zap className="w-4 h-4" />} label={isCollapsed ? "" : "Automations"} />
                <NavItem to={canAccessAdminConfig ? "/admin/config" : "/admin"} icon={<Settings className="w-4 h-4" />} label={isCollapsed ? "" : "Admin"} />
              </div>
            </nav>
          </ScrollArea>

          {/* User section */}
          {!isCollapsed && (
            <div className="p-4 border-t border-sidebar-border">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={profile?.full_name ?? user?.user_metadata?.full_name}
                  email={profile?.email ?? user?.email}
                  avatarUrl={profile?.avatar_url}
                />
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
