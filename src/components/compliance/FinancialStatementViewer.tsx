import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Props {
  statementType: string;
  dataJson: any;
  fiscalYear: number;
}

const typeLabels: Record<string, string> = {
  balance_sheet: "Statement of Financial Position",
  income_statement: "Statement of Activities",
  cash_flows: "Statement of Cash Flows",
  functional_expenses: "Statement of Functional Expenses",
};

export function FinancialStatementViewer({ statementType, dataJson, fiscalYear }: Props) {
  const label = typeLabels[statementType] || statementType;
  const sections = dataJson?.sections || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{label}</CardTitle>
        <Badge variant="outline">FY {fiscalYear}</Badge>
      </CardHeader>
      <CardContent>
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data generated yet.</p>
        ) : (
          <div className="space-y-4">
            {sections.map((section: any, idx: number) => (
              <div key={idx}>
                <h4 className="font-semibold text-sm mb-2">{section.title}</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(section.rows || []).map((row: any, rIdx: number) => (
                      <TableRow key={rIdx} className={row.isTotal ? "font-bold border-t-2" : ""}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(row.amount).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
