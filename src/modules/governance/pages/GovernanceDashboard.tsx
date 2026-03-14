import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFXRates } from "@/hooks/useFXRates";
import { useCountryCompliance } from "@/hooks/useCountryCompliance";
import { useLocalizedCOA } from "@/hooks/useLocalizedCOA";
import { ArrowRightLeft, Globe, BookOpen, ArrowRight } from "lucide-react";

export default function GovernanceDashboard() {
  const { data: rates } = useFXRates();
  const { data: profiles } = useCountryCompliance();
  const { data: mappings } = useLocalizedCOA();

  const modules = [
    { title: "FX Rates", desc: "Manage exchange rates", path: "/governance/fx", icon: ArrowRightLeft, count: rates?.length ?? 0, label: "rates" },
    { title: "Country Compliance", desc: "Jurisdiction requirements", path: "/governance/compliance", icon: Globe, count: profiles?.length ?? 0, label: "profiles" },
    { title: "Localized COA", desc: "Account mapping by country", path: "/governance/coa", icon: BookOpen, count: mappings?.length ?? 0, label: "mappings" },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Governance</h1>
          <p className="text-muted-foreground">Multi-currency, multi-country compliance and COA governance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map(m => (
            <Link key={m.path} to={m.path}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <m.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{m.title}</CardTitle>
                      <CardDescription>{m.desc}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold">{m.count}</p>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      {m.label} <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
