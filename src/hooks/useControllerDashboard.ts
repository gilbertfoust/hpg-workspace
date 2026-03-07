import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useControllerDashboard() {
  const ngos = useQuery({
    queryKey: ["controller_ngos"],
    queryFn: async () => {
      const { data, error } = await supabase!.from("ngos")
        .select("id, legal_name, common_name, status, country, region")
        .order("common_name");
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const riskProfiles = useQuery({
    queryKey: ["ngo_risk_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase!.from("ngo_risk_profiles")
        .select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const alerts = useQuery({
    queryKey: ["controller_alerts_summary"],
    queryFn: async () => {
      const { data, error } = await supabase!.from("controller_alerts")
        .select("id, severity, status, ngo_id")
        .eq("status", "open");
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const grants = useQuery({
    queryKey: ["controller_grants"],
    queryFn: async () => {
      const { data, error } = await supabase!.from("grant_applications")
        .select("id, ngo_id, stage, amount_awarded, amount_requested");
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const purchaseOrders = useQuery({
    queryKey: ["controller_pos"],
    queryFn: async () => {
      const { data, error } = await supabase!.from("purchase_orders")
        .select("id, ngo_id, status, total_amount")
        .not("status", "in", '("closed","canceled")');
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const vendorInvoices = useQuery({
    queryKey: ["controller_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase!.from("vendor_invoices")
        .select("id, ngo_id, status, total_amount")
        .in("status", ["received", "pending_approval", "approved"]);
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const staffProfiles = useQuery({
    queryKey: ["controller_staff"],
    queryFn: async () => {
      const { data, error } = await supabase!.from("staff_profiles")
        .select("id, ngo_id, status");
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const assets = useQuery({
    queryKey: ["controller_assets"],
    queryFn: async () => {
      const { data, error } = await supabase!.from("assets")
        .select("id, ngo_id, status, acquisition_cost");
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const compliancePackages = useQuery({
    queryKey: ["controller_compliance"],
    queryFn: async () => {
      const { data, error } = await supabase!.from("compliance_packages")
        .select("id, ngo_id, status, package_type, fiscal_year");
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const isLoading = ngos.isLoading || riskProfiles.isLoading || alerts.isLoading;

  // Build NGO health rows
  const ngoHealthRows = (ngos.data ?? []).map(ngo => {
    const risk = (riskProfiles.data ?? []).find(r => r.ngo_id === ngo.id);
    const ngoAlerts = (alerts.data ?? []).filter(a => a.ngo_id === ngo.id);
    const ngoGrants = (grants.data ?? []).filter(g => g.ngo_id === ngo.id);
    const ngoStaff = (staffProfiles.data ?? []).filter(s => s.ngo_id === ngo.id && s.status === "active");
    const ngoAssets = (assets.data ?? []).filter(a => a.ngo_id === ngo.id);
    const ngoCompliance = (compliancePackages.data ?? []).filter(c => c.ngo_id === ngo.id);
    const pendingCompliance = ngoCompliance.filter(c => c.status !== "approved");

    return {
      ...ngo,
      risk_level: risk?.risk_level ?? "medium",
      overall_risk_score: risk?.overall_risk_score ?? 50,
      alert_count: ngoAlerts.length,
      critical_alerts: ngoAlerts.filter(a => a.severity === "critical").length,
      grants_awarded: ngoGrants.filter(g => g.stage === "awarded").reduce((s, g) => s + (g.amount_awarded ?? 0), 0),
      grants_pipeline: ngoGrants.filter(g => !["awarded", "declined", "closed"].includes(g.stage)).length,
      staff_count: ngoStaff.length,
      asset_value: ngoAssets.reduce((s, a) => s + (a.acquisition_cost ?? 0), 0),
      pending_compliance: pendingCompliance.length,
    };
  });

  // Global KPIs
  const highRiskCount = (riskProfiles.data ?? []).filter(r => r.risk_level === "high").length;
  const totalGrantsAwarded = (grants.data ?? []).filter(g => g.stage === "awarded").reduce((s, g) => s + (g.amount_awarded ?? 0), 0);
  const openPOs = purchaseOrders.data?.length ?? 0;
  const openPOValue = (purchaseOrders.data ?? []).reduce((s, p) => s + (p.total_amount ?? 0), 0);
  const unpaidInvoices = vendorInvoices.data?.length ?? 0;
  const unpaidInvoiceValue = (vendorInvoices.data ?? []).reduce((s, v) => s + (v.total_amount ?? 0), 0);
  const pendingCompliance = (compliancePackages.data ?? []).filter(c => c.status !== "approved").length;
  const totalAssetValue = (assets.data ?? []).reduce((s, a) => s + (a.acquisition_cost ?? 0), 0);
  const openAlerts = alerts.data?.length ?? 0;
  const criticalAlerts = (alerts.data ?? []).filter(a => a.severity === "critical").length;

  return {
    isLoading,
    ngoHealthRows,
    kpis: {
      ngoCount: ngos.data?.length ?? 0,
      highRiskCount,
      totalGrantsAwarded,
      openPOs,
      openPOValue,
      unpaidInvoices,
      unpaidInvoiceValue,
      pendingCompliance,
      totalAssetValue,
      openAlerts,
      criticalAlerts,
      totalStaff: staffProfiles.data?.length ?? 0,
    },
  };
}
