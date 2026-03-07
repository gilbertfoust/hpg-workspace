import { KPICard } from "@/components/common/KPICard";
import { Building2, AlertTriangle, DollarSign, ShoppingCart, FileText, Users, Package, Bell } from "lucide-react";

interface KPIs {
  ngoCount: number;
  highRiskCount: number;
  totalGrantsAwarded: number;
  openPOs: number;
  openPOValue: number;
  unpaidInvoices: number;
  unpaidInvoiceValue: number;
  pendingCompliance: number;
  totalAssetValue: number;
  openAlerts: number;
  criticalAlerts: number;
  totalStaff: number;
}

export function ControllerDashboardCards({ kpis }: { kpis: KPIs }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard title="NGOs Managed" value={kpis.ngoCount} icon={<Building2 className="h-4 w-4" />} />
      <KPICard title="High-Risk NGOs" value={kpis.highRiskCount} icon={<AlertTriangle className="h-4 w-4" />} />
      <KPICard title="Grants Awarded YTD" value={`$${kpis.totalGrantsAwarded.toLocaleString()}`} icon={<DollarSign className="h-4 w-4" />} />
      <KPICard title="Open Alerts" value={`${kpis.openAlerts} (${kpis.criticalAlerts} critical)`} icon={<Bell className="h-4 w-4" />} />
      <KPICard title="Open POs" value={`${kpis.openPOs} ($${kpis.openPOValue.toLocaleString()})`} icon={<ShoppingCart className="h-4 w-4" />} />
      <KPICard title="Unpaid Invoices" value={`${kpis.unpaidInvoices} ($${kpis.unpaidInvoiceValue.toLocaleString()})`} icon={<FileText className="h-4 w-4" />} />
      <KPICard title="Total Staff" value={kpis.totalStaff} icon={<Users className="h-4 w-4" />} />
      <KPICard title="Pending Compliance" value={kpis.pendingCompliance} icon={<Package className="h-4 w-4" />} />
    </div>
  );
}
