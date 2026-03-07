import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExtractionLog {
  id: string;
  intake_id: string;
  raw_text: string | null;
  extracted_data_json: Record<string, unknown>;
  confidence_score: number | null;
  created_at: string;
}

export function useDocumentExtractionLogs(intakeId?: string) {
  return useQuery({
    queryKey: ["document_extraction_logs", intakeId],
    enabled: !!intakeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_extraction_logs" as any)
        .select("*")
        .eq("intake_id", intakeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ExtractionLog[];
    },
  });
}
