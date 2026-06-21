import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useApproveFinancePassThroughRequest,
  useCreateFinancePassThroughRequest,
  useCreateRestrictedFundRelease,
  useFinancePassThroughRequests,
  useFinanceRestrictedFundReleases,
  useNgoSubledgerBalance,
} from "@/hooks/useFinancePassThrough";
import { useFinanceFunds } from "@/hooks/useFinanceFunds";
import { useNGOs } from "@/hooks/useNGOs";
import { hasFinancePermission } from "@/lib/financePermissions";
import { useUserRole } from "@/hooks/useUserRole";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinanceFiscalSponsorshipPage = () => {
  const { role } = useUserRole();
  const canManage = hasFinancePermission(role, "manage_ledger");
  const { data: ngos = [] } = useNGOs();
  const { data: funds = [] } = useFinanceFunds();
  const { data: requests = [] } = useFinancePassThroughRequests();
  const { data: releases = [] } = useFinanceRestrictedFundReleases();
  const createRequest = useCreateFinancePassThroughRequest();
  const approveRequest = useApproveFinancePassThroughRequest();
  const createRelease = useCreateRestrictedFundRelease();

  const [selectedNgoId, setSelectedNgoId] = useState("");
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState("");
  const [releaseFundId, setReleaseFundId] = useState("none");
  const [releaseAmount, setReleaseAmount] = useState(0);

  const { data: subledger } = useNgoSubledgerBalance(selectedNgoId || undefined);

  return (
    <MainLayout title="Fiscal Sponsorship" subtitle="Pass-through disbursements, NGO subledgers, and restricted fund releases">
      <Tabs defaultValue="subledger">
        <TabsList>
          <TabsTrigger value="subledger">NGO Subledger</TabsTrigger>
          <TabsTrigger value="pass-through">Pass-Through Requests</TabsTrigger>
          <TabsTrigger value="releases">Fund Releases</TabsTrigger>
        </TabsList>

        <TabsContent value="subledger" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6 flex gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label>Sponsored NGO</Label>
                <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                  <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                  <SelectContent>
                    {ngos.map((n) => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          {subledger && (
            <div className="grid md:grid-cols-4 gap-4">
              {[
                ["Unrestricted", subledger.unrestricted_balance],
                ["Restricted", subledger.restricted_balance],
                ["Pass-through", subledger.pass_through_balance],
                ["Total", subledger.total_balance],
              ].map(([label, val]) => (
                <Card key={String(label)}><CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-xl font-semibold">{fmt(Number(val))}</p>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pass-through" className="mt-4 space-y-4">
          {canManage && (
            <Card>
              <CardHeader><CardTitle className="text-base">New pass-through request</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-4 gap-3">
                <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                  <SelectTrigger><SelectValue placeholder="NGO" /></SelectTrigger>
                  <SelectContent>{ngos.map((n) => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" placeholder="Amount" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
                <Input placeholder="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
                <Button
                  disabled={!selectedNgoId || amount <= 0}
                  onClick={() => createRequest.mutate({ ngo_id: selectedNgoId, requested_amount: amount, memo }, {
                    onSuccess: () => { setAmount(0); setMemo(""); },
                  })}
                >
                  Submit request
                </Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Admin fee</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.request_number}</TableCell>
                      <TableCell>{fmt(r.requested_amount)}</TableCell>
                      <TableCell>{fmt(r.admin_fee_amount)}</TableCell>
                      <TableCell>{fmt(r.net_disbursement_amount)}</TableCell>
                      <TableCell><Badge>{r.status}</Badge></TableCell>
                      <TableCell>
                        {canManage && r.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => approveRequest.mutate({ requestId: r.id })}>Approve</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="releases" className="mt-4 space-y-4">
          {canManage && (
            <Card>
              <CardHeader><CardTitle className="text-base">Record restricted fund release</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-4 gap-3">
                <Select value={releaseFundId} onValueChange={setReleaseFundId}>
                  <SelectTrigger><SelectValue placeholder="Fund" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select fund</SelectItem>
                    {funds.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Amount" value={releaseAmount || ""} onChange={(e) => setReleaseAmount(Number(e.target.value))} />
                <Button
                  disabled={releaseFundId === "none" || releaseAmount <= 0}
                  onClick={() => createRelease.mutate({
                    fund_id: releaseFundId,
                    amount: releaseAmount,
                    release_date: new Date().toISOString().slice(0, 10),
                    from_restriction_class: "with_donor_restrictions",
                  }, { onSuccess: () => setReleaseAmount(0) })}
                >
                  Record release
                </Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-6">
              <ul className="space-y-2 text-sm">
                {releases.map((r: { id: string; release_number: string; amount: number; release_date: string }) => (
                  <li key={r.id} className="flex justify-between border-b pb-2">
                    <span>{r.release_number} — {r.release_date}</span>
                    <span>{fmt(Number(r.amount))}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default FinanceFiscalSponsorshipPage;
