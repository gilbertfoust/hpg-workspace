import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTrialBalance } from "@/hooks/useTrialBalance";
import { Save } from "lucide-react";

interface Props {
  ngoId: string;
  fiscalYear: number;
  allocations: Record<string, { program: number; management: number; fundraising: number }>;
  onSave: (allocations: Record<string, { program: number; management: number; fundraising: number }>) => void;
}

export function FunctionalExpenseEditor({ ngoId, fiscalYear, allocations: initialAllocations, onSave }: Props) {
  const { data: trialBalance } = useTrialBalance(ngoId);
  const expenses = (trialBalance || []).filter((r) => r.account_type === "expense");
  const [allocations, setAllocations] = useState(initialAllocations);

  useEffect(() => {
    setAllocations(initialAllocations);
  }, [initialAllocations]);

  const updateAlloc = (accountId: string, field: "program" | "management" | "fundraising", value: number) => {
    setAllocations((prev) => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || { program: 100, management: 0, fundraising: 0 }), [field]: value },
    }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Functional Expense Allocations</CardTitle>
        <Button size="sm" onClick={() => onSave(allocations)}>
          <Save className="h-4 w-4 mr-1" /> Save Allocations
        </Button>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expense accounts found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right w-24">Program %</TableHead>
                <TableHead className="text-right w-24">Mgmt %</TableHead>
                <TableHead className="text-right w-24">Fund %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((exp) => {
                const total = exp.total_debit - exp.total_credit;
                const alloc = allocations[exp.account_id] || { program: 100, management: 0, fundraising: 0 };
                return (
                  <TableRow key={exp.account_id}>
                    <TableCell className="text-sm">{exp.account_code} — {exp.account_name}</TableCell>
                    <TableCell className="text-right font-mono">{total.toLocaleString("en-US", { style: "currency", currency: "USD" })}</TableCell>
                    <TableCell><Input type="number" min={0} max={100} value={alloc.program} onChange={(e) => updateAlloc(exp.account_id, "program", Number(e.target.value))} className="text-right h-8" /></TableCell>
                    <TableCell><Input type="number" min={0} max={100} value={alloc.management} onChange={(e) => updateAlloc(exp.account_id, "management", Number(e.target.value))} className="text-right h-8" /></TableCell>
                    <TableCell><Input type="number" min={0} max={100} value={alloc.fundraising} onChange={(e) => updateAlloc(exp.account_id, "fundraising", Number(e.target.value))} className="text-right h-8" /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
