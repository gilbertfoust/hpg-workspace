import { useState } from "react";
import { useSigningRequests, useCreateSigningRequest } from "@/hooks/useSigningRequests";
import { useEsignDocuments } from "@/hooks/useEsignDocuments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

function statusVariant(status: string) {
  switch (status) {
    case "signed": return "default" as const;
    case "pending": return "secondary" as const;
    default: return "destructive" as const;
  }
}

export function SigningRequestsTab() {
  const { data: requests, isLoading } = useSigningRequests();
  const { data: documents } = useEsignDocuments();
  const createMutation = useCreateSigningRequest();
  const [open, setOpen] = useState(false);
  const [signingLink, setSigningLink] = useState<string | null>(null);

  const [documentId, setDocumentId] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createMutation.mutateAsync({
        document_id: documentId,
        signer_name: signerName,
        signer_email: signerEmail,
        expires_at: addDays(new Date(), parseInt(expiresInDays)).toISOString(),
      });
      
      if (result?.signing_link) {
        setSigningLink(result.signing_link);
        toast.success("Signing request created — copy the link below to share");
      } else {
        toast.success("Signing request created and email sent");
        setOpen(false);
      }
      
      setDocumentId("");
      setSignerName("");
      setSignerEmail("");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyLink = () => {
    if (signingLink) {
      navigator.clipboard.writeText(signingLink);
      toast.success("Signing link copied to clipboard");
    }
  };

  const handleDialogChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setSigningLink(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Create and track signing requests sent to external signers.
        </p>
        <Dialog open={open} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" /> New Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Signing Request</DialogTitle>
            </DialogHeader>

            {signingLink ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Request created!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Email sending is not configured yet. Share this signing link manually:
                </p>
                <div className="flex items-center gap-2">
                  <Input value={signingLink} readOnly className="text-xs" />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" className="w-full" onClick={() => handleDialogChange(false)}>
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Document</Label>
                  <Select value={documentId} onValueChange={setDocumentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a document" />
                    </SelectTrigger>
                    <SelectContent>
                      {documents?.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.original_filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Signer Name</Label>
                  <Input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Signer Email</Label>
                  <Input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expires In</Label>
                  <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || !documentId}>
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create & Send"
                  )}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !requests?.length ? (
          <p className="py-8 text-center text-muted-foreground">No signing requests yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Signer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Signed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => {
                const displayStatus = req.status === "pending" && new Date(req.expires_at) < new Date()
                  ? "expired" : req.status;
                return (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      {req.esign_documents?.original_filename ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div>{req.signer_name}</div>
                      <div className="text-xs text-muted-foreground">{req.signer_email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(displayStatus)}>
                        {displayStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(req.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {req.signed_at
                        ? format(new Date(req.signed_at), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
