import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useNgoControllerDetail(ngoId: string) {
  const ngo = useQuery({
    queryKey: ["controller_ngo_detail", ngoId],
    queryFn: async () => {
      const { data, error } = await supabase!.from("ngos")
        .select("*").eq("id", ngoId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!ngoId,
  });

  const riskProfile = useQuery({
    queryKey: ["ngo_risk_profiles", ngoId],
    queryFn: async () => {
      const { data, error } = await supabase!.from("ngo_risk_profiles")
        .select("*").eq("ngo_id", ngoId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!ngoId,
  });

  const alerts = useQuery({
    queryKey: ["controller_alerts", { ngo_id: ngoId }],
    queryFn: async () => {
      const { data, error } = await supabase!.from("controller_alerts")
        .select("*").eq("ngo_id", ngoId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!ngoId,
  });

  const grants = useQuery({
    queryKey: ["controller_ngo_grants", ngoId],
    queryFn: async () => {
      const { data, error } = await supabase!.from("grant_applications")
        .select("id, title, stage, amount_requested, amount_awarded")
        .eq("ngo_id", ngoId).order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!ngoId,
  });

  const purchaseOrders = useQuery({
    queryKey: ["controller_ngo_pos", ngoId],
    queryFn: async () => {
      const { data, error } = await supabase!.from("purchase_orders")
        .select("id, po_number, status, total_amount, order_date")
        .eq("ngo_id", ngoId).order("order_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!ngoId,
  });

  const vendorInvoices = useQuery({
    queryKey: ["controller_ngo_invoices", ngoId],
    queryFn: async () => {
      const { data, error } = await supabase!.from("vendor_invoices")
        .select("id, invoice_number, status, total_amount")
        .eq("ngo_id", ngoId);
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!ngoId,
  });

  const staff = useQuery({
    queryKey: ["controller_ngo_staff", ngoId],
    queryFn: async () => {
      const { data, error } = await supabase!.from("staff_profiles")
        .select("id, first_name, last_name, status, employment_type, job_title")
        .eq("ngo_id", ngoId);
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!ngoId,
  });

  const assets_q = useQuery({
    queryKey: ["controller_ngo_assets", ngoId],
    queryFn: async () => {
      const { data, error } = await supabase!.from("assets")
        .select("id, name, status, category, acquisition_cost")
        .eq("ngo_id", ngoId);
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!ngoId,
  });

  const inventory = useQuery({
    queryKey: ["controller_ngo_inventory", ngoId],
    queryFn: async () => {
      const { data, error } = await supabase!.from("inventory_items")
        .select("id, name, quantity_on_hand, reorder_point, unit_cost, is_active")
        .eq("ngo_id", ngoId);
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!ngoId,
  });

  const compliance = useQuery({
    queryKey: ["controller_ngo_compliance", ngoId],
    queryFn: async () => {
      const { data, error } = await supabase!.from("compliance_packages")
        .select("id, package_type, fiscal_year, status")
        .eq("ngo_id", ngoId).order("fiscal_year", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supabase && !!ngoId,
  });

  const isLoading = ngo.isLoading || riskProfile.isLoading;

  return {
    isLoading,
    ngo: ngo.data,
    riskProfile: riskProfile.data,
    alerts: alerts.data ?? [],
    grants: grants.data ?? [],
    purchaseOrders: purchaseOrders.data ?? [],
    vendorInvoices: vendorInvoices.data ?? [],
    staff: staff.data ?? [],
    assets: assets_q.data ?? [],
    inventory: inventory.data ?? [],
    compliance: compliance.data ?? [],
  };
}
