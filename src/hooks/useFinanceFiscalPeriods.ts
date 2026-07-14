import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type {
  FinanceFiscalPeriod,
  FinanceJournalEntry,
  FinanceOpeningBalance,
  FinancePeriodCloseReadiness,
} from "@/types/financeAccounting";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

export const useFinanceFiscalPeriods = (ngoId?: string | null) =>
  useQuery({
    queryKey: ["finance-fiscal-periods", ngoId ?? "hpg"],
    enabled: !!supabase,
    queryFn: async (): Promise<FinanceFiscalPeriod[]> => {
      ensureSupabase();
      let query = supabase
        .from("finance_fiscal_periods" as never)
        .select("*")
        .order("fiscal_year", { ascending: false })
        .order("start_date", { ascending: true });
      query = ngoId
        ? query.eq("ngo_id" as never, ngoId as never)
        : query.is("ngo_id" as never, null);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FinanceFiscalPeriod[];
    },
  });

export const useFinanceOpeningBalances = (periodId?: string) =>
  useQuery({
    queryKey: ["finance-opening-balances", periodId],
    enabled: !!supabase && !!periodId,
    queryFn: async (): Promise<FinanceOpeningBalance[]> => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("finance_opening_balances" as never)
        .select("*")
        .eq("fiscal_period_id" as never, periodId as never);
      if (error) throw error;
      return (data || []) as FinanceOpeningBalance[];
    },
  });

export const useFinancePeriodCloseReadiness = (periodId?: string | null) =>
  useQuery({
    queryKey: ["finance-period-close-readiness", periodId ?? "none"],
    enabled: !!supabase && !!periodId,
    queryFn: async (): Promise<FinancePeriodCloseReadiness> => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("finance_period_close_readiness" as never, {
        _period_id: periodId,
      } as never);
      if (error) throw error;
      return data as unknown as FinancePeriodCloseReadiness;
    },
  });

export const useCreateFinanceFiscalPeriod = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<FinanceFiscalPeriod, "id" | "created_at" | "updated_at" | "closed_at" | "locked_at" | "reopen_reason">) => {
      ensureSupabase();
      const { data, error } = await supabase.from("finance_fiscal_periods" as never).insert(input as never).select().single();
      if (error) throw error;
      return data as FinanceFiscalPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      toast({ title: "Fiscal period created" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useCloseFinanceFiscalPeriod = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (periodId: string) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("close_finance_fiscal_period" as never, { _period_id: periodId } as never);
      if (error) throw error;
      return data as FinanceFiscalPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      qc.invalidateQueries({ queryKey: ["finance-period-close-readiness"] });
      toast({ title: "Period closed" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useLockFinanceFiscalPeriod = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (periodId: string) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("lock_finance_fiscal_period" as never, { _period_id: periodId } as never);
      if (error) throw error;
      return data as FinanceFiscalPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      qc.invalidateQueries({ queryKey: ["finance-period-close-readiness"] });
      toast({ title: "Period locked" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

export const useReopenFinanceFiscalPeriod = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ periodId, reason }: { periodId: string; reason: string }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("reopen_finance_fiscal_period" as never, {
        _period_id: periodId,
        _reason: reason,
      } as never);
      if (error) throw error;
      return data as FinanceFiscalPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      qc.invalidateQueries({ queryKey: ["finance-period-close-readiness"] });
      toast({ title: "Period reopened" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const parseOpeningAmount = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const parsed = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
};

const fingerprintFile = async (file: File) => {
  if (!globalThis.crypto?.subtle) throw new Error("This browser cannot securely fingerprint import files.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

interface OpeningBalanceImportRow {
  account_code: string;
  debit: string;
  credit: string;
  memo: string;
}

const parseOpeningBalanceCsv = (file: File) => new Promise<OpeningBalanceImportRow[]>((resolve, reject) => {
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
    complete: ({ data, errors, meta }) => {
      if (errors.some((error) => error.type === "Delimiter" || error.type === "Quotes")) {
        reject(new Error(`CSV could not be read: ${errors[0].message}`));
        return;
      }
      const fields = meta.fields ?? [];
      const byNormalized = new Map(fields.map((field) => [normalizeHeader(field), field]));
      const accountCodeKey = byNormalized.get("accountcode") ?? byNormalized.get("account") ?? byNormalized.get("code");
      const debitKey = byNormalized.get("debit");
      const creditKey = byNormalized.get("credit");
      const memoKey = byNormalized.get("memo") ?? byNormalized.get("description");
      if (!accountCodeKey || !debitKey || !creditKey) {
        reject(new Error("CSV needs Account Code, Debit, and Credit columns."));
        return;
      }

      const rows: OpeningBalanceImportRow[] = [];
      for (let index = 0; index < data.length; index += 1) {
        const row = data[index];
        const accountCode = String(row[accountCodeKey] ?? "").trim();
        const debit = parseOpeningAmount(row[debitKey]);
        const credit = parseOpeningAmount(row[creditKey]);
        if (!accountCode || debit === null || credit === null || debit < 0 || credit < 0 || (debit > 0) === (credit > 0)) {
          reject(new Error(`CSV row ${index + 2} needs an account code and one positive debit or credit.`));
          return;
        }
        rows.push({
          account_code: accountCode,
          debit: debit ? debit.toFixed(2) : "",
          credit: credit ? credit.toFixed(2) : "",
          memo: memoKey ? String(row[memoKey] ?? "").trim() : "",
        });
      }
      if (!rows.length) reject(new Error("Opening balance CSV has no rows."));
      else resolve(rows);
    },
    error: (error) => reject(error),
  });
});

export const useImportFinanceOpeningBalances = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { fiscalPeriodId: string; ngoId: string | null; file: File }) => {
      ensureSupabase();
      if (!input.file.name.toLowerCase().endsWith(".csv")) throw new Error("Opening balances must be imported from a CSV file.");
      if (input.file.size <= 0 || input.file.size > 15 * 1024 * 1024) throw new Error("Opening balance CSV must be smaller than 15 MB.");
      const [rows, contentSha256] = await Promise.all([parseOpeningBalanceCsv(input.file), fingerprintFile(input.file)]);
      const scope = input.ngoId ?? "hpg";
      const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const filePath = `internal/finance/opening-balances/${scope}/${input.fiscalPeriodId}/${uniqueId}-${sanitizeFileName(input.file.name)}`;
      const { error: uploadError } = await supabase.storage.from("ngo-documents").upload(filePath, input.file, {
        upsert: false,
        contentType: "text/csv",
        cacheControl: "3600",
      });
      if (uploadError) throw uploadError;

      try {
        const { data, error } = await supabase.rpc("import_finance_opening_balances_with_source" as never, {
          _fiscal_period_id: input.fiscalPeriodId,
          _ngo_id: input.ngoId,
          _rows: rows,
          _file_path: filePath,
          _file_name: input.file.name,
          _file_size: input.file.size,
          _content_sha256: contentSha256,
        } as never);
        if (error) throw error;
        return data as unknown as {
          row_count: number;
          total_debit: number;
          total_credit: number;
          is_balanced: boolean;
          document_id: string;
        };
      } catch (error) {
        await supabase.storage.from("ngo-documents").remove([filePath]);
        throw error;
      }
    },
    onSuccess: (result, input) => {
      qc.invalidateQueries({ queryKey: ["finance-opening-balances", input.fiscalPeriodId] });
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      qc.invalidateQueries({ queryKey: ["finance-period-close-readiness", input.fiscalPeriodId] });
      toast({
        title: "Opening balances imported",
        description: `${result.row_count} balanced lines are staged with the source CSV attached.`,
      });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Opening balance import failed", description: e.message }),
  });
};

export const usePostFinanceOpeningBalances = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (fiscalPeriodId: string): Promise<FinanceJournalEntry> => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("post_finance_opening_balances" as never, {
        _fiscal_period_id: fiscalPeriodId,
      } as never);
      if (error) throw error;
      return data as unknown as FinanceJournalEntry;
    },
    onSuccess: (entry, fiscalPeriodId) => {
      qc.invalidateQueries({ queryKey: ["finance-opening-balances", fiscalPeriodId] });
      qc.invalidateQueries({ queryKey: ["finance-fiscal-periods"] });
      qc.invalidateQueries({ queryKey: ["finance-journal-entries"] });
      qc.invalidateQueries({ queryKey: ["finance-period-close-readiness", fiscalPeriodId] });
      toast({ title: "Opening balances posted", description: `${entry.entry_number} is now part of the live ledger.` });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Opening balances not posted", description: e.message }),
  });
};

export const useDeleteFinanceOpeningBalance = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id }: { id: string; fiscalPeriodId: string }) => {
      ensureSupabase();
      const { error } = await supabase.rpc("delete_finance_opening_balance" as never, {
        _opening_balance_id: id,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ["finance-opening-balances", input.fiscalPeriodId] });
      qc.invalidateQueries({ queryKey: ["finance-period-close-readiness", input.fiscalPeriodId] });
      toast({ title: "Opening balance removed" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not remove balance", description: e.message }),
  });
};

export const useUpsertFinanceOpeningBalance = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      fiscal_period_id: string;
      account_id: string;
      debit?: number;
      credit?: number;
      fund_id?: string | null;
      ngo_id?: string | null;
      memo?: string | null;
    }) => {
      ensureSupabase();
      const { data, error } = await supabase.rpc("upsert_finance_opening_balance" as never, {
        _fiscal_period_id: input.fiscal_period_id,
        _account_id: input.account_id,
        _debit: input.debit ?? 0,
        _credit: input.credit ?? 0,
        _fund_id: input.fund_id ?? null,
        _ngo_id: input.ngo_id ?? null,
        _memo: input.memo ?? null,
      } as never);
      if (error) throw error;
      return data as FinanceOpeningBalance;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["finance-opening-balances", vars.fiscal_period_id] });
      toast({ title: "Opening balance saved" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });
};
