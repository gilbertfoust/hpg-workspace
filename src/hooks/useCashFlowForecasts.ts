import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CashFlowForecast {
  id: string;
  ngo_id: string;
  name: string;
  start_month: string;
  month_count: number;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface CashFlowForecastLine {
  id: string;
  forecast_id: string;
  line_type: "receipt" | "payment";
  category_label: string;
  month_index: number;
  amount: number;
  created_at: string;
}

export function useCashFlowForecasts(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["cash_flow_forecasts", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cash_flow_forecasts")
        .select("*")
        .eq("ngo_id", ngoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CashFlowForecast[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Omit<CashFlowForecast, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any)
        .from("cash_flow_forecasts")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as CashFlowForecast;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cash_flow_forecasts"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CashFlowForecast> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("cash_flow_forecasts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as CashFlowForecast;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cash_flow_forecasts"] }),
  });

  return { ...query, create, update };
}

export function useCashFlowForecastLines(forecastId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["cash_flow_forecast_lines", forecastId],
    enabled: !!forecastId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cash_flow_forecast_lines")
        .select("*")
        .eq("forecast_id", forecastId!)
        .order("month_index");
      if (error) throw error;
      return (data || []) as CashFlowForecastLine[];
    },
  });

  const upsertLines = useMutation({
    mutationFn: async (lines: Omit<CashFlowForecastLine, "id" | "created_at">[]) => {
      const { data, error } = await (supabase as any)
        .from("cash_flow_forecast_lines")
        .upsert(lines)
        .select();
      if (error) throw error;
      return (data || []) as CashFlowForecastLine[];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cash_flow_forecast_lines"] }),
  });

  const removeLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("cash_flow_forecast_lines")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cash_flow_forecast_lines"] }),
  });

  return { ...query, upsertLines, removeLine };
}
