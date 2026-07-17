import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Banknote, Building2, CheckSquare, Coins, TrendingUp } from "lucide-react";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function FinanceAdvancedAccountingPage() {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const queryClient = useQueryClient();
  const [rate, setRate] = useState({ date: new Date().toISOString().slice(0,10), base: "USD", quote: "EUR", value: "" });
  const data = useQuery({ queryKey: ["advanced-accounting", selectedNgoId], enabled: Boolean(selectedNgoId), queryFn: async () => {
    const [rates, depreciation, taxYears, checks, investments] = await Promise.all([
      (supabase as any).from("finance_exchange_rates").select("*").order("rate_date",{ascending:false}).limit(20),
      (supabase as any).from("asset_depreciation").select("*").eq("ngo_id",selectedNgoId).order("period_date",{ascending:false}).limit(20),
      (supabase as any).from("finance_vendor_tax_years").select("*, finance_vendors(name)").eq("ngo_id",selectedNgoId).order("tax_year",{ascending:false}),
      (supabase as any).from("finance_checks").select("*").eq("ngo_id",selectedNgoId).order("check_date",{ascending:false}).limit(20),
      (supabase as any).from("finance_investment_accounts").select("*, finance_investment_holdings(*)").eq("ngo_id",selectedNgoId),
    ]);
    for(const result of [rates,depreciation,taxYears,checks,investments]) if(result.error) throw result.error;
    return { rates:rates.data??[],depreciation:depreciation.data??[],taxYears:taxYears.data??[],checks:checks.data??[],investments:investments.data??[] };
  }});
  const addRate=useMutation({mutationFn:async()=>{const{error}=await(supabase as any).from("finance_exchange_rates").insert({rate_date:rate.date,base_currency:rate.base.toUpperCase(),quote_currency:rate.quote.toUpperCase(),rate:Number(rate.value),source:"HPG Finance",created_by_user_id:(await supabase.auth.getUser()).data.user?.id});if(error)throw error;},onSuccess:()=>{queryClient.invalidateQueries({queryKey:["advanced-accounting"]});toast.success("Exchange rate saved");},onError:(e:Error)=>toast.error(e.message)});
  if(!selectedNgoId)return <MainLayout title="Advanced Accounting"><Card><CardContent className="p-8 text-sm text-muted-foreground">Select an NGO to open advanced accounting controls.</CardContent></Card></MainLayout>;
  const d=data.data;
  return <MainLayout title="Advanced Accounting" subtitle={`${selectedNgo?.common_name||selectedNgo?.legal_name}: depreciation, FX, vendor tax, checks, and investments connected to the general ledger.`}><div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-5">{[[Building2,"Depreciation",d?.depreciation.length||0],[Coins,"FX rates",d?.rates.length||0],[Banknote,"Vendor tax years",d?.taxYears.length||0],[CheckSquare,"Checks",d?.checks.length||0],[TrendingUp,"Investment accounts",d?.investments.length||0]].map(([Icon,label,value]:any)=><Card key={label}><CardContent className="p-4"><Icon className="h-5 w-5 text-primary"/><p className="mt-2 text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Multi-currency rate book</CardTitle><CardDescription>Rates are dated and locked to support base-currency journal values and international payout reconciliation.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><div className="space-y-2"><Label>Date</Label><Input type="date" value={rate.date} onChange={e=>setRate({...rate,date:e.target.value})}/></div><div className="space-y-2"><Label>Base</Label><Input value={rate.base} onChange={e=>setRate({...rate,base:e.target.value})}/></div><div className="space-y-2"><Label>Quote</Label><Input value={rate.quote} onChange={e=>setRate({...rate,quote:e.target.value})}/></div><div className="space-y-2"><Label>Rate</Label><Input type="number" step="0.00000001" value={rate.value} onChange={e=>setRate({...rate,value:e.target.value})}/></div></div><Button disabled={!rate.value||addRate.isPending} onClick={()=>addRate.mutate()}>Save rate</Button><div className="flex flex-wrap gap-2">{(d?.rates||[]).map((item:any)=><Badge key={item.id} variant="outline">{item.rate_date} · {item.base_currency}/{item.quote_currency} {item.rate}</Badge>)}</div></CardContent></Card>
    <div className="grid gap-5 md:grid-cols-2"><Feature title="Fixed assets & depreciation" description="Asset schedules post depreciation expense and accumulated depreciation as balanced entries." href="/assets/depreciation" rows={(d?.depreciation||[]).map((x:any)=>`${x.period_label}: $${Number(x.depreciation_amount).toLocaleString()}`)}/><Feature title="Vendor tax reporting" description="W-9/W-8 status, 1099 eligibility, and annual paid totals are reserved without storing full tax IDs." href="/financial-hub/accounting/accounts-payable" rows={(d?.taxYears||[]).map((x:any)=>`${x.finance_vendors?.name||"Vendor"}: ${x.tax_year} · $${Number(x.reportable_amount).toLocaleString()} · ${x.status}`)}/><Feature title="Controlled checks" description="Check stock numbers cannot be reused; issued checks link to posted payments and archived print documents." href="/financial-hub/accounting/payments" rows={(d?.checks||[]).map((x:any)=>`#${x.check_number} · ${x.payee_name} · ${x.status}`)}/><Feature title="Investment accounting" description="Holdings, cost basis, fair value, and unrealized gains/losses post to mapped ledger accounts." href="/controller/treasury" rows={(d?.investments||[]).map((x:any)=>`${x.name}: ${(x.finance_investment_holdings||[]).length} holdings`)}/></div>
  </div></MainLayout>;
}
function Feature({title,description,href,rows}:{title:string;description:string;href:string;rows:string[]}){return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="space-y-2">{rows.length?rows.slice(0,5).map(row=><div key={row} className="rounded border p-2 text-sm">{row}</div>):<p className="text-sm text-muted-foreground">No records yet.</p>}</div><Button asChild variant="outline"><Link to={href}>Open workspace <ArrowRight className="ml-2 h-4 w-4"/></Link></Button></CardContent></Card>}
