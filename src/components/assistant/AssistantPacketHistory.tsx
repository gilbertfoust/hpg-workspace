import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Stamp } from "lucide-react";
import type { AssistantPacketEvent, SavedAssistantPacket } from "@/hooks/useAssistantPackets";

interface AssistantPacketHistoryProps {
  packets: SavedAssistantPacket[];
  events: AssistantPacketEvent[];
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusVariant(status: SavedAssistantPacket["status"]): "default" | "secondary" | "outline" {
  if (status === "approved") return "default";
  if (status === "reviewed") return "secondary";
  return "outline";
}

export function AssistantPacketHistory({ packets, events }: AssistantPacketHistoryProps) {
  const approvedPackets = packets.filter((packet) => packet.status === "approved");
  const latestApproved = approvedPackets[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Saved packets</p>
            <p className="text-2xl font-semibold">{packets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Approved packets</p>
            <p className="text-2xl font-semibold">{approvedPackets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">History events</p>
            <p className="text-2xl font-semibold">{events.length}</p>
          </CardContent>
        </Card>
      </div>

      {latestApproved && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Stamp className="h-4 w-4" /> Latest Approved Packet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{latestApproved.title}</p>
            <p className="text-muted-foreground">Approved: {formatDate(latestApproved.approved_at)}</p>
            {latestApproved.cabinet_summary && <p className="leading-6">{latestApproved.cabinet_summary}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved Packet Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px] pr-3">
              <div className="space-y-3">
                {packets.length === 0 && <p className="text-sm text-muted-foreground">No saved packets yet.</p>}
                {packets.map((packet, index) => (
                  <div key={packet.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">Version {packets.length - index}</p>
                      <Badge variant={statusVariant(packet.status)}>{packet.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Saved {formatDate(packet.created_at)}</p>
                    {packet.summary && <p className="text-sm leading-6">{packet.summary}</p>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" /> Event Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px] pr-3">
              <div className="space-y-3">
                {events.length === 0 && <p className="text-sm text-muted-foreground">No packet events recorded yet.</p>}
                {events.map((event) => (
                  <div key={event.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{event.event_type}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
                    </div>
                    <p className="text-sm">{event.note || "No note recorded."}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
