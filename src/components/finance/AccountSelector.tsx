import { useMemo } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Account } from "@/hooks/useAccounts";

interface AccountSelectorProps {
  accounts: Account[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  excludeId?: string;
}

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"] as const;
const TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

export function AccountSelector({ accounts, value, onValueChange, placeholder = "Select account", excludeId }: AccountSelectorProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const t of TYPE_ORDER) map.set(t, []);
    for (const a of accounts) {
      if (a.id === excludeId) continue;
      map.get(a.type)?.push(a);
    }
    return map;
  }, [accounts, excludeId]);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {TYPE_ORDER.map((type) => {
          const items = grouped.get(type) || [];
          if (items.length === 0) return null;
          return (
            <SelectGroup key={type}>
              <SelectLabel className="text-xs uppercase tracking-wider text-muted-foreground">{TYPE_LABELS[type]}</SelectLabel>
              {items.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
