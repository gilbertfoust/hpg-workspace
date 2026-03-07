import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm990Data } from "./Form990DataExtractor";
import { Loader2 } from "lucide-react";

interface Props {
  ngoId: string;
  fiscalYear: number;
}

export function Form990Sections({ ngoId, fiscalYear }: Props) {
  const { data, isLoading } = useForm990Data(ngoId, fiscalYear);

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground p-4">No data available.</p>;

  return (
    <div className="space-y-4">
      {/* Part I: Revenue */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Part VIII — Revenue</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.revenue.map((r, i) => (
                <TableRow key={i}><TableCell>{r.label}</TableCell><TableCell className="text-right font-mono">{r.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}</TableCell></TableRow>
              ))}
              <TableRow className="font-bold border-t-2"><TableCell>Total Revenue</TableCell><TableCell className="text-right font-mono">{data.totalRevenue.toLocaleString("en-US", { style: "currency", currency: "USD" })}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Part IX: Functional Expenses */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Part IX — Functional Expenses</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Expense</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.expenses.map((e, i) => (
                <TableRow key={i}><TableCell>{e.label}</TableCell><TableCell className="text-right font-mono">{e.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}</TableCell></TableRow>
              ))}
              <TableRow className="font-bold border-t-2"><TableCell>Total Expenses</TableCell><TableCell className="text-right font-mono">{data.totalExpenses.toLocaleString("en-US", { style: "currency", currency: "USD" })}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Governance */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Part VII — Governance</CardTitle></CardHeader>
        <CardContent>
          {data.governance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts found for this NGO.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Title</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.governance.map((g, i) => (
                  <TableRow key={i}><TableCell>{g.name}</TableCell><TableCell>{g.title}</TableCell><TableCell>{g.email}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Foreign Activity */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Schedule F — Foreign Activity</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Badge variant="outline">Country: {data.foreignActivity.country}</Badge>
            <Badge variant="outline">Region: {data.foreignActivity.region}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Net Assets: {data.netAssets.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
        </CardContent>
      </Card>
    </div>
  );
}
