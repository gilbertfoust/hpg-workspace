import { useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useNgoControllerDetail } from "@/hooks/useNgoControllerDetail";
import { NgoRiskSummary } from "../components/NgoRiskSummary";
import { NgoControllerTabs } from "../components/NgoControllerTabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NgoControllerDetail() {
  const { ngoId } = useParams<{ ngoId: string }>();
  const navigate = useNavigate();
  const {
    isLoading, ngo, grants, purchaseOrders, vendorInvoices,
    staff, assets, inventory, compliance,
  } = useNgoControllerDetail(ngoId!);

  const ngoName = ngo?.common_name || ngo?.legal_name || "NGO";

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/controller")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{ngoName}</h1>
            <p className="text-muted-foreground">Controller overview — {ngo?.country ?? ""} {ngo?.region ? `· ${ngo.region}` : ""}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading…</p>
        ) : (
          <>
            <NgoRiskSummary ngoId={ngoId!} ngoName={ngoName} />
            <NgoControllerTabs
              ngoId={ngoId!}
              grants={grants}
              purchaseOrders={purchaseOrders}
              vendorInvoices={vendorInvoices}
              staff={staff}
              assets={assets}
              inventory={inventory}
              compliance={compliance}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
}
