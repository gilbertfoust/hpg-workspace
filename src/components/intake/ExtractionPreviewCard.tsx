import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface Props {
  extracted: Record<string, unknown>;
  confidence?: number | null;
}

export function ExtractionPreviewCard({ extracted, confidence }: Props) {
  const fields = [
    { key: "date", label: "Date" },
    { key: "amount", label: "Amount" },
    { key: "vendor_or_donor", label: "Vendor / Donor" },
    { key: "description", label: "Description" },
    { key: "category_guess", label: "Category" },
    { key: "transaction_type_guess", label: "Type" },
  ];

  const confPct = confidence != null ? Math.round(confidence * 100) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Extracted Data
          </CardTitle>
          {confPct != null && (
            <Badge variant={confPct >= 70 ? "default" : confPct >= 40 ? "secondary" : "destructive"}>
              {confPct}% confidence
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">
                {extracted[key] != null ? String(extracted[key]) : "—"}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
