import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

interface NGO {
  id: string;
  legal_name: string;
  common_name: string | null;
}

// Trello grant data mapped to our system
const TRELLO_GRANTS: Array<{
  title: string;
  ngoMatch: string; // partial match on NGO name
  stage: string;
  focus?: string;
}> = [
  // MegaBridge (Kenya)
  { title: "Rotary Foundation – Global Grants", ngoMatch: "MegaBridge", stage: "writing" },
  // SMVM grants
  { title: "African Impact Fund", ngoMatch: "SMVM", stage: "writing" },
  { title: "Ecobank Foundation", ngoMatch: "SMVM", stage: "researching" },
  { title: "Charities Aid Foundation", ngoMatch: "SMVM", stage: "researching" },
  { title: "Addax & Oryx Foundation", ngoMatch: "SMVM", stage: "researching", focus: "WASH" },
  { title: "Coca-Cola & PepsiCo Foundations (WASH co-funding)", ngoMatch: "SMVM", stage: "researching", focus: "WASH" },
  { title: "Veolia Foundation", ngoMatch: "SMVM", stage: "researching", focus: "WASH" },
  { title: "AmplifyChange – SRHR/GBV", ngoMatch: "SMVM", stage: "researching", focus: "Sexual Health" },
  { title: "AWDF – African Women's Development Fund", ngoMatch: "SMVM", stage: "researching", focus: "Sexual Health" },
  { title: "EON - Spatial AI Skills-Jobs-Income Grant Program", ngoMatch: "SMVM", stage: "writing", focus: "AI Counter Funding" },
  { title: "Rockefeller Foundation - Global Health Initiatives", ngoMatch: "SMVM", stage: "researching" },
  // CUBA (Congo)
  { title: "Rockefeller Foundation", ngoMatch: "CUBA", stage: "researching" },
  // RainRoot
  { title: "AVINA Foundation", ngoMatch: "RainRoot", stage: "researching" },
  { title: "Rockefeller Foundation Grants", ngoMatch: "RainRoot", stage: "researching" },
  { title: "Rockefeller Brothers Fund", ngoMatch: "RainRoot", stage: "researching" },
  { title: "Cisco Global Impact Cash Grants", ngoMatch: "RainRoot", stage: "researching" },
  { title: "MacArthur Foundation Grants", ngoMatch: "RainRoot", stage: "researching" },
  // Living Word of Faith (Philippines)
  { title: "Ford Foundation - International Human Rights Grants", ngoMatch: "Living Word", stage: "researching" },
  // Project Wings (Chicago)
  { title: "Global Fund for Women", ngoMatch: "Project Wings", stage: "writing" },
  { title: "W.K. Kellogg Foundation Grants", ngoMatch: "Project Wings", stage: "researching" },
  // Humble Pathways
  { title: "EON - Spatial AI Skills-Jobs-Income Grant Program", ngoMatch: "Humble Pathways", stage: "writing" },
  // Seishin Plus
  { title: "City of Detroit", ngoMatch: "Seishin", stage: "writing" },
  { title: "Walmart Foundation Community Grants", ngoMatch: "Seishin", stage: "writing" },
  { title: "Chick-fil-A Foundation", ngoMatch: "Seishin", stage: "writing" },
  { title: "Bank of America Charitable Foundation Grants", ngoMatch: "Seishin", stage: "researching" },
  // GYLFH
  { title: "Global Fund for Children", ngoMatch: "GYLFH", stage: "writing" },
  { title: "City of Detroit", ngoMatch: "GYLFH", stage: "writing" },
  { title: "Walmart Foundation Community Grants", ngoMatch: "GYLFH", stage: "writing" },
  { title: "Black Tech Saturdays Regrants Program", ngoMatch: "GYLFH", stage: "writing" },
  { title: "Chick-fil-A Foundation", ngoMatch: "GYLFH", stage: "writing" },
  // HPG
  { title: "Michigan Nonprofit Association Grants", ngoMatch: "HPG", stage: "researching" },
];

interface Props {
  ngos: NGO[];
  existingCount: number;
}

export function GrantSeedButton({ ngos, existingCount }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSeed = async () => {
    setLoading(true);
    let seeded = 0;

    try {
      for (const grant of TRELLO_GRANTS) {
        const ngo = ngos.find(
          (n) =>
            (n.common_name || n.legal_name)
              .toLowerCase()
              .includes(grant.ngoMatch.toLowerCase())
        );

        const payload: Record<string, unknown> = {
          title: grant.title,
          stage: grant.stage,
          notes: grant.focus ? `Focus: ${grant.focus}` : null,
        };

        if (ngo) {
          payload.ngo_id = ngo.id;
        }

        const { error } = await supabase.from("grant_applications").insert(payload);
        if (!error) seeded++;
      }

      queryClient.invalidateQueries({ queryKey: ["grant_applications"] });
      toast.success(`Imported ${seeded} grants from Trello tracker`);
      setOpen(false);
    } catch (e) {
      toast.error("Failed to seed grants");
    } finally {
      setLoading(false);
    }
  };

  if (existingCount > 10) return null; // Don't show if already seeded

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Import Trello Data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Trello Grant Tracker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will import {TRELLO_GRANTS.length} grant opportunities from your Trello Grant
            Tracking board, automatically matching them to existing NGOs in the system.
          </p>
          <div className="text-sm space-y-1">
            <p>
              <strong>NGOs in system:</strong> {ngos.length}
            </p>
            <p>
              <strong>Grants to import:</strong> {TRELLO_GRANTS.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Grants will be matched to NGOs by name. Unmatched grants will appear in the
              "Unassigned" section.
            </p>
          </div>
          <Button onClick={handleSeed} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Import Grants
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
