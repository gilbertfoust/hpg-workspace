import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type {
  FinanceDocumentLink,
  FinanceDocumentLinkEntityType,
  FinanceJournalEntryWithLines,
  FinanceJournalLine,
  FinanceReceiptStatus,
} from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinanceDocumentLinks = (entityType: FinanceDocumentLinkEntityType, entityId: string | null) => {
  return useQuery({
    queryKey: ["finance-document-links", entityType, entityId],
    enabled: !!supabase && !!entityId,
    queryFn: async (): Promise<FinanceDocumentLink[]> => {
      ensureSupabase();
      if (!entityId) return [];

      const { data: links, error } = await supabase
        .from("finance_document_links" as never)
        .select("*")
        .eq("entity_type" as never, entityType as never)
        .eq("entity_id" as never, entityId as never)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!links?.length) return [];

      const docIds = [...new Set(links.map((l: FinanceDocumentLink) => l.document_id))];
      const { data: documents, error: docError } = await supabase
        .from("documents")
        .select("id, file_name")
        .in("id", docIds);

      if (docError) throw docError;

      const docMap = new Map<string, { id: string; file_name: string }>();
      (documents || []).forEach((d: { id: string; file_name: string }) => docMap.set(d.id, d));

      return (links as FinanceDocumentLink[]).map((link) => ({
        ...link,
        document: docMap.get(link.document_id) ?? null,
      }));
    },
  });
};

export const useLinkFinanceDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      documentId,
      entityType,
      entityId,
      linkNotes,
    }: {
      documentId: string;
      entityType: FinanceDocumentLinkEntityType;
      entityId: string;
      linkNotes?: string;
    }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_document_links" as never)
        .insert({
          document_id: documentId,
          entity_type: entityType,
          entity_id: entityId,
          link_notes: linkNotes?.trim() || null,
          created_by_user_id: user?.id ?? null,
        } as never)
        .select()
        .single();

      if (error) throw error;

      await supabase.rpc("finance_log_audit_event" as never, {
        _entity_type: "finance_document_link",
        _entity_id: (data as FinanceDocumentLink).id,
        _action: "linked",
        _metadata: { document_id: documentId, entity_type: entityType, entity_id: entityId },
      } as never);

      return data as FinanceDocumentLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-document-links"] });
      queryClient.invalidateQueries({ queryKey: ["finance-receipt-coverage"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      toast({ title: "Receipt linked" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not link document", description: error.message });
    },
  });
};

export const useUnlinkFinanceDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (linkId: string) => {
      ensureSupabase();
      const { error } = await supabase.from("finance_document_links" as never).delete().eq("id" as never, linkId as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-document-links"] });
      queryClient.invalidateQueries({ queryKey: ["finance-receipt-coverage"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      toast({ title: "Receipt link removed" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not remove link", description: error.message });
    },
  });
};

const deriveReceiptStatus = (
  entry: FinanceJournalEntryWithLines,
  hasReceiptRpc: boolean,
  linkedDocCount: number,
  lineDocCount: number
): FinanceReceiptStatus => {
  if (hasReceiptRpc || linkedDocCount > 0 || lineDocCount > 0) {
    if (lineDocCount > 0 && lineDocCount < entry.lines.length && linkedDocCount === 0) {
      return "partial";
    }
    return "attached";
  }
  return "missing";
};

export const useFinanceReceiptCoverage = () => {
  return useQuery({
    queryKey: ["finance-receipt-coverage"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();

      const { data: entries, error: entryError } = await supabase
        .from("finance_journal_entries" as never)
        .select("*")
        .in("status" as never, ["posted", "draft", "pending_approval"] as never)
        .order("entry_date", { ascending: false });

      if (entryError) throw entryError;
      if (!entries?.length) return { entries: [], missingCount: 0, attachedCount: 0 };

      const entryIds = entries.map((e: { id: string }) => e.id);

      const [{ data: lines, error: lineError }, { data: links, error: linkError }] = await Promise.all([
        supabase.from("finance_journal_lines" as never).select("*").in("journal_entry_id" as never, entryIds as never),
        supabase.from("finance_document_links" as never).select("*").in("entity_type" as never, ["journal_entry", "journal_line"] as never),
      ]);

      if (lineError) throw lineError;
      if (linkError) throw linkError;

      const linesByEntry = new Map<string, FinanceJournalLine[]>();
      (lines || []).forEach((line: FinanceJournalLine) => {
        const bucket = linesByEntry.get(line.journal_entry_id) || [];
        bucket.push(line);
        linesByEntry.set(line.journal_entry_id, bucket);
      });

      const receiptChecks = await Promise.all(
        entryIds.map(async (id: string) => {
          const { data, error } = await supabase.rpc("finance_journal_entry_has_receipt" as never, {
            _entry_id: id,
          } as never);
          if (error) throw error;
          return { id, hasReceipt: Boolean(data) };
        })
      );

      const receiptMap = new Map(receiptChecks.map((r) => [r.id, r.hasReceipt]));

      const enriched = (entries as FinanceJournalEntryWithLines[]).map((entry) => {
        const entryLines = linesByEntry.get(entry.id) || [];
        const lineDocCount = entryLines.filter((l) => l.document_id).length;
        const linkedDocCount = (links || []).filter(
          (l: { entity_type: string; entity_id: string }) =>
            (l.entity_type === "journal_entry" && l.entity_id === entry.id) ||
            (l.entity_type === "journal_line" && entryLines.some((line) => line.id === l.entity_id))
        ).length;

        const receiptStatus = deriveReceiptStatus(
          { ...entry, lines: entryLines as FinanceJournalEntryWithLines["lines"] },
          receiptMap.get(entry.id) ?? false,
          linkedDocCount,
          lineDocCount
        );

        return {
          ...entry,
          lines: entryLines,
          receipt_status: receiptStatus,
          linked_document_count: linkedDocCount + lineDocCount,
        };
      });

      const missingCount = enriched.filter((e) => e.receipt_status === "missing").length;
      const attachedCount = enriched.filter((e) => e.receipt_status === "attached").length;

      return { entries: enriched, missingCount, attachedCount };
    },
  });
};

export const useFinanceDocumentsPicker = () => {
  return useQuery({
    queryKey: ["finance-documents-picker"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, category, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });
};
