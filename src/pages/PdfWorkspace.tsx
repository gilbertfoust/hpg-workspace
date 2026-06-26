import { useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PdfEditor } from "@/components/pdf/PdfEditor";
import { PdfMergeSplitDialog } from "@/components/pdf/PdfMergeSplitDialog";
import { createBlankPdf, createTextPdf } from "@/lib/pdf/pdfCreator";
import { FilePlus, Layers, Upload } from "lucide-react";
import { toast } from "sonner";

export default function PdfWorkspace() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("document.pdf");
  const [documentId, setDocumentId] = useState(() => crypto.randomUUID());
  const [mergeSplitOpen, setMergeSplitOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  const loadFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    setPdfData(bytes);
    setPdfUrl(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
    setFileName(file.name);
    setDocumentId(crypto.randomUUID());
  };

  const handleCreateBlank = async () => {
    const bytes = await createBlankPdf(1);
    setPdfData(bytes);
    setPdfUrl(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
    setFileName("blank.pdf");
    setDocumentId(crypto.randomUUID());
    toast.success("Blank PDF created");
  };

  const handleCreateFromText = async () => {
    if (!newTitle.trim()) {
      toast.error("Enter a title");
      return;
    }
    const bytes = await createTextPdf(newTitle, newBody);
    setPdfData(bytes);
    setPdfUrl(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
    setFileName(`${newTitle.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    setDocumentId(crypto.randomUUID());
    toast.success("PDF created from text");
  };

  return (
    <MainLayout
      title="PDF Workspace"
      subtitle="View, edit, create, merge, and split PDF documents"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMergeSplitOpen(true)}>
            <Layers className="h-4 w-4 mr-2" /> Merge / Split
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Open PDF
          </Button>
        </div>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-12rem)]">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Create PDF</CardTitle>
              <CardDescription>Generate new documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full" onClick={handleCreateBlank}>
                <FilePlus className="h-4 w-4 mr-2" /> Blank Page
              </Button>
              <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <Textarea placeholder="Body text..." value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={4} />
              <Button className="w-full" onClick={handleCreateFromText}>Create from Text</Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 min-h-[500px]">
          {pdfUrl || pdfData ? (
            <PdfEditor
              url={pdfUrl ?? undefined}
              data={pdfData ?? undefined}
              fileName={fileName}
              documentId={documentId}
              className="h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full border rounded-lg bg-muted/20 text-muted-foreground gap-3">
              <Upload className="h-12 w-12 opacity-40" />
              <p>Open a PDF or create a new one to get started</p>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>Open PDF</Button>
            </div>
          )}
        </div>
      </div>

      <PdfMergeSplitDialog open={mergeSplitOpen} onOpenChange={setMergeSplitOpen} />
    </MainLayout>
  );
}
