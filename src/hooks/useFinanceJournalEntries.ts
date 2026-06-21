import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { mapPostingError } from "@/lib/financePostingErrors";
import type {
  FinanceAuditEvent,
  FinanceJournalEntry,
  FinanceJournalEntryInput,
  FinanceJournalEntryWithLines,
  FinanceJournalLine,
  FinanceJournalLineInput,
} from "@/types/financeAccounting";
import { computeJournalTotals } from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

const mapEntryWithTotals = (
  entry: FinanceJournalEntry,
  lines: FinanceJournalLine[],
  profileMap: Map<string, string>
): FinanceJournalEntryWithLines => {
  const { totalDebit, totalCredit } = computeJournalTotals(lines);
  return {
    ...entry,
    lines,
    total_debit: totalDebit,
    total_credit: totalCredit,
    created_by_name: entry.created_by_user_id ? profileMap.get(entry.created_by_user_id) ?? null : null,
  };
};

export const useFinanceJournalEntries = () => {
  return useQuery({
    queryKey: ["finance-journal-entries"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceJournalEntryWithLines[]> => {
      ensureSupabase();

      const { data: entries, error: entryError } = await supabase
        .from("finance_journal_entries" as never)
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (entryError) throw entryError;
      if (!entries?.length) return [];

      const entryIds = entries.map((e: FinanceJournalEntry) => e.id);
      const creatorIds = [...new Set(entries.map((e: FinanceJournalEntry) => e.created_by_user_id).filter(Boolean))] as string[];

      const [{ data: lines, error: lineError }, { data: profiles, error: profileError }] = await Promise.all([
        supabase
          .from("finance_journal_lines" as never)
          .select("*")
          .in("journal_entry_id" as never, entryIds as never)
          .order("line_number", { ascending: true }),
        creatorIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", creatorIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (lineError) throw lineError;
      if (profileError) throw profileError;

      const profileMap = new Map<string, string>();
      (profiles || []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
        profileMap.set(p.id, p.full_name || p.email || p.id);
      });

      const linesByEntry = new Map<string, FinanceJournalLine[]>();
      (lines || []).forEach((line: FinanceJournalLine) => {
        const bucket = linesByEntry.get(line.journal_entry_id) || [];
        bucket.push(line);
        linesByEntry.set(line.journal_entry_id, bucket);
      });

      return (entries as FinanceJournalEntry[]).map((entry) =>
        mapEntryWithTotals(entry, linesByEntry.get(entry.id) || [], profileMap)
      );
    },
  });
};

export const useFinanceJournalEntry = (entryId: string | null) => {
  return useQuery({
    queryKey: ["finance-journal-entry", entryId],
    enabled: !!supabase && !!entryId,
    queryFn: async (): Promise<FinanceJournalEntryWithLines | null> => {
      ensureSupabase();
      if (!entryId) return null;

      const { data: entry, error: entryError } = await supabase
        .from("finance_journal_entries" as never)
        .select("*")
        .eq("id" as never, entryId as never)
        .maybeSingle();

      if (entryError) throw entryError;
      if (!entry) return null;

      const { data: lines, error: lineError } = await supabase
        .from("finance_journal_lines" as never)
        .select("*")
        .eq("journal_entry_id" as never, entryId as never)
        .order("line_number", { ascending: true });

      if (lineError) throw lineError;

      let createdByName: string | null = null;
      if ((entry as FinanceJournalEntry).created_by_user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", (entry as FinanceJournalEntry).created_by_user_id!)
          .maybeSingle();
        createdByName = profile?.full_name || profile?.email || null;
      }

      const mapped = mapEntryWithTotals(entry as FinanceJournalEntry, (lines || []) as FinanceJournalLine[], new Map());
      return { ...mapped, created_by_name: createdByName };
    },
  });
};

export const useFinanceJournalAuditEvents = (entryId: string | null) => {
  return useQuery({
    queryKey: ["finance-journal-audit", entryId],
    enabled: !!supabase && !!entryId,
    queryFn: async (): Promise<FinanceAuditEvent[]> => {
      ensureSupabase();
      if (!entryId) return [];

      const { data: events, error } = await supabase
        .from("finance_audit_events" as never)
        .select("*")
        .eq("entity_type" as never, "finance_journal_entry" as never)
        .eq("entity_id" as never, entryId as never)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!events?.length) return [];

      const actorIds = [...new Set(events.map((e: FinanceAuditEvent) => e.actor_user_id).filter(Boolean))] as string[];
      const { data: profiles } = actorIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
        : { data: [] };

      const profileMap = new Map<string, string>();
      (profiles || []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
        profileMap.set(p.id, p.full_name || p.email || p.id);
      });

      return (events as FinanceAuditEvent[]).map((event) => ({
        ...event,
        metadata_json: (event.metadata_json || {}) as Record<string, unknown>,
        actor_name: event.actor_user_id ? profileMap.get(event.actor_user_id) ?? null : null,
      }));
    },
  });
};

const normalizeLines = (lines: FinanceJournalLineInput[]): FinanceJournalLineInput[] =>
  lines
    .filter((line) => line.account_id && (line.debit > 0 || line.credit > 0))
    .map((line, index) => ({
      ...line,
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
      line_number: index + 1,
    }));

export const useSaveFinanceJournalEntry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: FinanceJournalEntryInput }) => {
      ensureSupabase();
      const lines = normalizeLines(input.lines);

      const { data: entry, error } = await supabase.rpc("save_finance_journal_entry" as never, {
        _entry_id: id ?? null,
        _entry_date: input.entry_date,
        _memo: input.memo?.trim() || null,
        _source_type: null,
        _source_id: null,
        _fiscal_period_id: input.fiscal_period_id ?? null,
        _lines: lines.map((line) => ({
          account_id: line.account_id,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo?.trim() || null,
          fund_id: line.fund_id || null,
          ngo_id: line.ngo_id || null,
          department_id: line.department_id || null,
          dimension_id: line.dimension_id || null,
          document_id: line.document_id || null,
          grant_application_id: line.grant_application_id || null,
          work_item_id: line.work_item_id || null,
          line_number: line.line_number,
        })),
      } as never);

      if (error) throw error;
      return entry as FinanceJournalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entry"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-audit"] });
      toast({ title: "Journal entry saved" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not save journal entry", description: mapPostingError(error) });
    },
  });
};

export const useDeleteFinanceJournalEntry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      ensureSupabase();

      const { data: existing, error: fetchError } = await supabase
        .from("finance_journal_entries" as never)
        .select("status")
        .eq("id" as never, id as never)
        .single();

      if (fetchError) throw fetchError;
      if ((existing as { status: string }).status !== "draft") {
        throw new Error("Only draft journal entries can be deleted.");
      }

      const { error } = await supabase.from("finance_journal_entries" as never).delete().eq("id" as never, id as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      toast({ title: "Draft journal entry deleted" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not delete journal entry", description: error.message });
    },
  });
};

export const usePostFinanceJournalEntry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (entryId: string) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("post_finance_journal_entry" as never, {
        _entry_id: entryId,
      } as never);
      if (error) throw error;
      return data as FinanceJournalEntry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entry"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-audit"] });
      queryClient.invalidateQueries({ queryKey: ["finance-account-usage"] });
      toast({ title: "Journal entry posted", description: entry.entry_number });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not post journal entry", description: mapPostingError(error) });
    },
  });
};

export const useVoidFinanceJournalEntry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: string; reason?: string }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("void_finance_journal_entry" as never, {
        _entry_id: entryId,
        _reason: reason ?? null,
      } as never);
      if (error) throw error;
      return data as FinanceJournalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entry"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-audit"] });
      toast({ title: "Journal entry voided" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not void journal entry", description: error.message });
    },
  });
};

export const useReverseFinanceJournalEntry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      entryId,
      reversalDate,
      memo,
    }: {
      entryId: string;
      reversalDate: string;
      memo?: string;
    }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("reverse_finance_journal_entry" as never, {
        _entry_id: entryId,
        _reversal_date: reversalDate,
        _memo: memo ?? null,
      } as never);
      if (error) throw error;
      return data as FinanceJournalEntry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-entry"] });
      queryClient.invalidateQueries({ queryKey: ["finance-journal-audit"] });
      queryClient.invalidateQueries({ queryKey: ["finance-account-usage"] });
      toast({ title: "Reversal posted", description: entry.entry_number });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Could not reverse journal entry", description: error.message });
    },
  });
};

export const useFinanceJournalReferenceData = () => {
  return useQuery({
    queryKey: ["finance-journal-reference-data"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();

      const [
        { data: ngos, error: ngoError },
        { data: departments, error: deptError },
        { data: grants, error: grantError },
        { data: workItems, error: workError },
        { data: documents, error: docError },
      ] = await Promise.all([
        supabase.from("ngos").select("id, legal_name, common_name").order("legal_name", { ascending: true }).limit(200),
        supabase.from("org_units").select("id, department_name").order("department_name", { ascending: true }),
        supabase
          .from("grant_applications")
          .select("id, title, stage")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("work_items")
          .select("id, title, status")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("documents")
          .select("id, file_name")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (ngoError) throw ngoError;
      if (deptError) throw deptError;
      if (grantError) throw grantError;
      if (workError) throw workError;
      if (docError) throw docError;

      return {
        ngos: ngos || [],
        departments: departments || [],
        grants: grants || [],
        workItems: workItems || [],
        documents: documents || [],
      };
    },
  });
};
