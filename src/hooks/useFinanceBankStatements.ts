import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type {
  FinanceBankReconciliation,
  FinanceBankStatementImport,
  FinanceBankStatementTransaction,
} from "@/types/financeAccounting";

const BUCKET = "ngo-documents";
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const parseMoney = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith("-");
  const parsed = Number(raw.replace(/[$,()\s]/g, "").replace(/^\+/, ""));
  if (!Number.isFinite(parsed)) return null;
  return Math.round((negative ? -Math.abs(parsed) : parsed) * 100) / 100;
};

const parseDate = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return null;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const month = Number(match[1]);
  const day = Number(match[2]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

const fingerprintFile = async (file: File) => {
  if (!globalThis.crypto?.subtle) throw new Error("This browser cannot securely fingerprint statement files.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

interface NormalizedStatementRow {
  transaction_date: string;
  posted_date: string | null;
  description: string;
  amount: number;
  currency: string;
  source_transaction_id: string | null;
  reference_number: string | null;
  raw: Record<string, string>;
}

const parseStatementCsv = (file: File) => new Promise<NormalizedStatementRow[]>((resolve, reject) => {
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
      const find = (...names: string[]) => names.map(normalizeHeader).map((name) => byNormalized.get(name)).find(Boolean);
      const transactionDateKey = find("transaction date", "date", "trans date", "activity date");
      const postedDateKey = find("posted date", "posting date", "post date");
      const descriptionKey = find("description", "memo", "name", "payee", "details", "transaction description");
      const amountKey = find("amount", "transaction amount");
      const debitKey = find("debit", "withdrawal", "withdrawals", "charge", "charges");
      const creditKey = find("credit", "deposit", "deposits", "payment", "payments");
      const idKey = find("transaction id", "id", "fitid");
      const referenceKey = find("reference", "reference number", "check number", "check no");
      const currencyKey = find("currency", "currency code");

      if (!transactionDateKey || !descriptionKey || (!amountKey && !debitKey && !creditKey)) {
        reject(new Error("CSV needs a date column, description column, and either amount or debit/credit columns."));
        return;
      }

      const normalized: NormalizedStatementRow[] = [];
      for (let index = 0; index < data.length; index += 1) {
        const row = data[index];
        const transactionDate = parseDate(row[transactionDateKey]);
        const description = String(row[descriptionKey] ?? "").trim();
        let amount = amountKey ? parseMoney(row[amountKey]) : null;
        if (amount === null) {
          const debit = debitKey ? parseMoney(row[debitKey]) : null;
          const credit = creditKey ? parseMoney(row[creditKey]) : null;
          amount = credit !== null && credit !== 0 ? Math.abs(credit) : debit !== null ? -Math.abs(debit) : null;
        }
        if (!transactionDate || !description || amount === null || amount === 0) {
          reject(new Error(`CSV row ${index + 2} needs a valid date, description, and non-zero amount.`));
          return;
        }
        normalized.push({
          transaction_date: transactionDate,
          posted_date: postedDateKey ? parseDate(row[postedDateKey]) : null,
          description,
          amount,
          currency: currencyKey ? String(row[currencyKey] || "USD").trim().toUpperCase().slice(0, 3) : "USD",
          source_transaction_id: idKey ? String(row[idKey] || "").trim() || null : null,
          reference_number: referenceKey ? String(row[referenceKey] || "").trim() || null : null,
          raw: row,
        });
      }
      if (!normalized.length) reject(new Error("Statement CSV has no transaction rows."));
      else resolve(normalized);
    },
    error: (error) => reject(error),
  });
});

const numericImport = (statementImport: FinanceBankStatementImport): FinanceBankStatementImport => ({
  ...statementImport,
  beginning_balance: Number(statementImport.beginning_balance),
  ending_balance: Number(statementImport.ending_balance),
  transaction_total: Number(statementImport.transaction_total),
  statement_variance: Number(statementImport.statement_variance),
  row_count: Number(statementImport.row_count),
});

export const useFinanceBankStatementImports = (ngoId?: string | null) => useQuery({
  queryKey: ["finance-bank-statement-imports", ngoId ?? "none"],
  enabled: !!supabase && !!ngoId,
  queryFn: async (): Promise<FinanceBankStatementImport[]> => {
    const client = ensureSupabase();
    const { data, error } = await client
      .from("finance_bank_statement_imports" as never)
      .select("*")
      .eq("ngo_id" as never, ngoId as never)
      .order("statement_end_date", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as FinanceBankStatementImport[]).map(numericImport);
  },
});

export const useFinanceBankStatementTransactions = (importId?: string | null) => useQuery({
  queryKey: ["finance-bank-statement-transactions", importId ?? "none"],
  enabled: !!supabase && !!importId,
  queryFn: async (): Promise<FinanceBankStatementTransaction[]> => {
    const client = ensureSupabase();
    const { data, error } = await client
      .from("finance_bank_statement_transactions" as never)
      .select("*")
      .eq("import_id" as never, importId as never)
      .order("transaction_date")
      .order("row_number");
    if (error) throw error;
    return ((data ?? []) as unknown as FinanceBankStatementTransaction[]).map((transaction) => ({
      ...transaction,
      amount: Number(transaction.amount),
      match_confidence: transaction.match_confidence === null ? null : Number(transaction.match_confidence),
    }));
  },
});

export interface ImportFinanceBankStatementInput {
  ngo_id: string;
  bank_account_id: string;
  statement_start_date: string;
  statement_end_date: string;
  beginning_balance: number;
  ending_balance: number;
  file: File;
}

export const useImportFinanceBankStatement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: ImportFinanceBankStatementInput) => {
      const client = ensureSupabase();
      if (input.file.size <= 0 || input.file.size > MAX_FILE_BYTES) throw new Error("Statement CSV must be smaller than 15 MB.");
      if (!input.file.name.toLowerCase().endsWith(".csv")) throw new Error("Statement import must be a CSV file.");
      const [rows, contentSha256] = await Promise.all([parseStatementCsv(input.file), fingerprintFile(input.file)]);
      const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const filePath = `internal/finance/bank-statements/${input.ngo_id}/${input.bank_account_id}/${uniqueId}-${sanitizeFileName(input.file.name)}`;
      const { error: uploadError } = await client.storage.from(BUCKET).upload(filePath, input.file, {
        upsert: false,
        contentType: "text/csv",
        cacheControl: "3600",
      });
      if (uploadError) throw uploadError;

      let result: { import: FinanceBankStatementImport; is_duplicate: boolean };
      try {
        const { data, error } = await client.rpc("import_finance_bank_statement" as never, {
          _ngo_id: input.ngo_id,
          _bank_account_id: input.bank_account_id,
          _statement_start_date: input.statement_start_date,
          _statement_end_date: input.statement_end_date,
          _beginning_balance: input.beginning_balance,
          _ending_balance: input.ending_balance,
          _file_path: filePath,
          _file_name: input.file.name,
          _file_type: "text/csv",
          _file_size: input.file.size,
          _content_sha256: contentSha256,
          _rows: rows,
        } as never);
        if (error) throw error;
        result = data as unknown as { import: FinanceBankStatementImport; is_duplicate: boolean };
      } catch (error) {
        await client.storage.from(BUCKET).remove([filePath]);
        throw error;
      }
      if (result.is_duplicate) await client.storage.from(BUCKET).remove([filePath]);
      else await client.rpc("suggest_finance_bank_statement_matches" as never, { _import_id: result.import.id } as never);
      return { ...result, import: numericImport(result.import) };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["finance-bank-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["finance-bank-statement-transactions"] });
      toast(result.is_duplicate ? {
        title: "Duplicate statement found",
        description: "This exact CSV is already in the selected account.",
      } : {
        title: "Statement imported",
        description: `${result.import.row_count} bank transactions were staged and checked for ledger matches.`,
      });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Statement import failed", description: error.message }),
  });
};

const useStatementAction = (
  action: (client: ReturnType<typeof ensureSupabase>, input: { transactionId: string; extra?: string }) => Promise<unknown>,
  successTitle: string,
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (input: { transactionId: string; extra?: string }) => action(ensureSupabase(), input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-bank-statement-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-recon-items"] });
      toast({ title: successTitle });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Statement update failed", description: error.message }),
  });
};

export const useConfirmFinanceBankStatementMatch = () => useStatementAction(async (client, { transactionId }) => {
  const { data, error } = await client.rpc("confirm_finance_bank_statement_match" as never, {
    _statement_transaction_id: transactionId,
    _journal_line_id: null,
  } as never);
  if (error) throw error;
  return data;
}, "Bank transaction matched");

export const useUnmatchFinanceBankStatementTransaction = () => useStatementAction(async (client, { transactionId }) => {
  const { data, error } = await client.rpc("unmatch_finance_bank_statement_transaction" as never, {
    _statement_transaction_id: transactionId,
  } as never);
  if (error) throw error;
  return data;
}, "Bank transaction unmatched");

export const useIgnoreFinanceBankStatementTransaction = () => useStatementAction(async (client, { transactionId, extra }) => {
  const { data, error } = await client.rpc("ignore_finance_bank_statement_transaction" as never, {
    _statement_transaction_id: transactionId,
    _reason: extra,
  } as never);
  if (error) throw error;
  return data;
}, "Bank transaction documented as ignored");

export const useSuggestFinanceBankStatementMatches = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (importId: string) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("suggest_finance_bank_statement_matches" as never, { _import_id: importId } as never);
      if (error) throw error;
      return Number(data) || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["finance-bank-statement-transactions"] });
      toast({ title: "Ledger matches refreshed", description: `${count} transaction${count === 1 ? "" : "s"} received a suggested match.` });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not suggest matches", description: error.message }),
  });
};

export const useStartFinanceBankReconciliationFromStatement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (statementImport: FinanceBankStatementImport): Promise<FinanceBankReconciliation> => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("start_finance_bank_reconciliation" as never, {
        _ngo_id: statementImport.ngo_id,
        _bank_account_id: statementImport.bank_account_id,
        _statement_start_date: statementImport.statement_start_date,
        _statement_end_date: statementImport.statement_end_date,
        _beginning_balance: statementImport.beginning_balance,
        _ending_balance: statementImport.ending_balance,
        _statement_import_id: statementImport.id,
      } as never);
      if (error) throw error;
      return data as FinanceBankReconciliation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-bank-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["finance-reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["finance-recon-items"] });
      toast({ title: "Reconciliation started", description: "Confirmed statement matches are already marked cleared." });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Could not start reconciliation", description: error.message }),
  });
};
