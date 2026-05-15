import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, History, Mail, ScrollText, Stamp } from "lucide-react";
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

async function copyText(text: string, label: string) {
  await navigator.clipboard.writeText(text);
  // Keep this component independent from toast context so it can be reused anywhere.
  console.info(`${label} copied`);
}

function eventIcon(type: AssistantPacketEvent["event_type"]) {
  if (type === "approval") return <Stamp className="h-4 w-4" />;
  if (type === "created") return <ScrollText className="h-4 w-4" />;
  return <History className="h-4 w-4" />;
}

export function AssistantPacketHistory({ packets, events }: AssistantPacketHistoryProps) {
  const approvedPackets = packets.filter((packet) => packet.status === "approved");
  const draftPackets = packets.filter((packet) => packet.status === "draft");
  const latestApproved = approvedPackets[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Saved packets</p>
            <p className="text-2xl font-semibold">{packets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Approved</p>
            <p className="text-2xl font-semibold">{approvedPackets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Drafts</p>
            <p className="text-2xl font-semibold">{draftPackets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Events</p>
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
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{latestApproved.title}</p>
                <p className="text-muted-foreground">Approved: {formatDate(latestApproved.approved_at)}</p>
              </div>
              <Badge variant="default">approved</Badge>
            </div>
            {latestApproved.cabinet_summary && <p className="leading-6">{latestApproved.cabinet_summary}</p>}
            <div className="flex flex-wrap gap-2">
              {latestApproved.email_body && (
                <Button size="sm" variant="outline" onClick={() => copyText(`Subject: ${latestApproved.email_subject || ""}\n\n${latestApproved.email_body}`, "Approved email draft")}>
                  <Mail className="mr-2 h-4 w-4" /> Copy Email
                </Button>
              )}
              {latestApproved.cabinet_summary && (
                <Button size="sm" variant="outline" onClick={() => copyText(latestApproved.cabinet_summary || "", "Approved Cabinet summary")}>
                  <Copy className="mr-2 h-4 w-4" /> Copy Summary
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved Packet Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-3">
                {packets.length === 0 && <p className="text-sm text-muted-foreground">No saved packets yet.</p>}
                {packets.map((packet, index) => (
                  <div key={packet.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">Version {packets.length - index}</p>
                        <p className="text-xs text-muted-foreground">Saved {formatDate(packet.created_at)}</p>
                      </div>
                      <Badge variant={statusVariant(packet.status)}>{packet.status}</Badge>
                    </div>
                    {packet.summary && <p className="text-sm leading-6">{packet.summary}</p>}
                    <div className="flex flex-wrap gap-2">
                      {packet.email_body && (
                        <Button size="sm" variant="outline" onClick={() => copyText(`Subject: ${packet.email_subject || ""}\n\n${packet.email_body}`, "Saved email draft")}>
                          <Mail className="mr-2 h-4 w-4" /> Email
                        </Button>
                      )}
                      {packet.cabinet_summary && (
                        <Button size="sm" variant="outline" onClick={() => copyText(packet.cabinet_summary || "", "Saved Cabinet summary")}>
                          <Copy className="mr-2 h-4 w-4" /> Summary
                        </Button>
                      )}
                    </div>
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
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-3">
                {events.length === 0 && <p className="text-sm text-muted-foreground">No packet events recorded yet.</p>}
                {events.map((event) => (
                  <div key={event.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-muted p-2">{eventIcon(event.event_type)}</span>
                        <Badge variant="outline">{event.event_type}</Badge>
                      </div>
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
