import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useNGOs } from "@/hooks/useNGOs";
import { useExtendedAccounts, getAccountBalance, defaultNormalBalance } from "@/hooks/useExtendedAccounts";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { Eye } from "lucide-react";

export default function GeneralLedgerOverview() {
  const navigate = useNavigate();
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState<string>("");
  const { data: accounts } = useExtendedAccounts(selectedNgoId || undefined);
  const { data: periods } = useFiscalPeriods(selectedNgoId || undefined);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!accounts) return [];
    if (!search) return accounts;
    const lower = search.toLowerCase();
    return accounts.filter(
      (a) => a.code.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower)
    );
  }, [accounts, search]);

  return (
    <MainLayout title="General Ledger" subtitle="Account-level ledger with running balances">
      <div className="space-y-6 max-w-6xl mx-auto">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>NGO</Label>
                <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                  <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                  <SelectContent>
                    {ngos?.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fiscal Period</Label>
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger><SelectValue placeholder="All Periods" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    {periods?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Search</Label>
                <Input placeholder="Search by code or name" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chart of Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Normal Bal.</TableHead>
                    <TableHead>Statement</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((account) => (
                    <TableRow key={account.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{account.code}</TableCell>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{account.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-xs">
                          {account.normal_balance || defaultNormalBalance(account.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground capitalize">
                          {(account.financial_statement_type || "balance_sheet").replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            navigate(
                              `/financial-hub/general-ledger/account/${account.id}?ngoId=${selectedNgoId}&periodId=${selectedPeriodId}`
                            )
                          }
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {selectedNgoId ? "No accounts found" : "Select an NGO to view accounts"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
