import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { Search, Mail, Phone, MapPin } from "lucide-react";

export default function StaffDirectory() {
  const navigate = useNavigate();
  const { data: staff } = useStaffProfiles({ status: "active" });
  const [search, setSearch] = useState("");

  const filtered = staff?.filter(s =>
    `${s.first_name} ${s.last_name} ${s.email || ""} ${s.job_title || ""} ${(s as any).org_units?.department_name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Staff Directory</h1>
          <p className="text-muted-foreground">Searchable company directory</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, title, department..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered?.map(s => (
            <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/erp/hr/staff/${s.id}`)}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                      {s.first_name[0]}{s.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{s.first_name} {s.last_name}</p>
                    <p className="text-sm text-muted-foreground">{s.job_title || s.employment_type.replace(/_/g, " ")}</p>
                  </div>
                  {(s as any).org_units?.department_name && (
                    <Badge variant="outline" className="text-xs">{(s as any).org_units.department_name}</Badge>
                  )}
                  <div className="w-full pt-2 border-t space-y-1">
                    {s.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                        <Mail className="h-3 w-3" />{s.email}
                      </p>
                    )}
                    {s.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                        <Phone className="h-3 w-3" />{s.phone}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                      <MapPin className="h-3 w-3" />{(s as any).ngos?.common_name || (s as any).ngos?.legal_name || "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!filtered?.length && (
          <p className="text-center py-8 text-muted-foreground">No staff members found</p>
        )}
      </div>
    </MainLayout>
  );
}
