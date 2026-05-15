import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { useNGOs, type NGO } from "@/hooks/useNGOs";
import { useAssistantPacketEvents, useAssistantPackets } from "@/hooks/useAssistantPackets";
import { AssistantPacketHistory } from "@/components/assistant/AssistantPacketHistory";
import { History, Info } from "lucide-react";

export default function HPGAssistantHistory() {
  const { data: ngos, isLoading, error } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState<string>("");

  const selectedNgo = useMemo(
    () => (ngos || []).find((ngo) => ngo.id === selectedNgoId) || (ngos || [])[0] || null,
    [ngos, selectedNgoId]
  );

  const effectiveNgoId = selectedNgo?.id || null;
  const { data: savedPackets = [], error: packetsError } = useAssistantPackets(effectiveNgoId);
  const { data: events = [], error: eventsError } = useAssistantPacketEvents(effectiveNgoId);

  const supabaseNotConfigured = isSupabaseNotConfiguredError(error) || isSupabaseNotConfiguredError(packetsError) || isSupabaseNotConfiguredError(eventsError);

  if (supabaseNotConfigured) {
    return (
      <MainLayout title="HPG Assistant History" subtitle="Saved packet versions and approval timeline">
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="HPG Assistant History" subtitle="Saved packet versions, approval status, and event timeline">
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Assistant history is internal recordkeeping</AlertTitle>
          <AlertDescription>
            This page shows saved Assistant packet versions and approval events. It does not send emails, approve NGOs externally, or publish donor-facing claims.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" /> Select NGO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={effectiveNgoId || ""} onValueChange={setSelectedNgoId} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select an NGO" />
              </SelectTrigger>
              <SelectContent>
                {(ngos || []).map((ngo: NGO) => (
                  <SelectItem key={ngo.id} value={ngo.id}>{ngo.common_name || ngo.legal_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedNgo ? (
          <AssistantPacketHistory packets={savedPackets} events={events} />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No NGO records are available yet.
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
