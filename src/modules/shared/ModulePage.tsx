import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface SubPage {
  label: string;
  path: string;
}

interface ModulePageProps {
  title: string;
  subtitle: string;
  features?: string[];
  subPages?: SubPage[];
}

export function ModulePage({ title, subtitle, features = [], subPages = [] }: ModulePageProps) {
  const navigate = useNavigate();

  return (
    <MainLayout title={title} subtitle={subtitle}>
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Construction className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Module Coming Soon</CardTitle>
            <CardDescription>
              This module is part of the HPG ERP roadmap and will be available soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {features.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Planned Features:</h4>
                <div className="flex flex-wrap gap-2">
                  {features.map((f) => (
                    <Badge key={f} variant="secondary">{f}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {subPages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subPages.map((sp) => (
              <Card
                key={sp.path}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(sp.path)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="font-medium text-sm">{sp.label}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
