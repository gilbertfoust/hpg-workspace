import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { File, Loader2, Upload, X } from "lucide-react";
import { DocumentCategory, useUploadFormTemplateDocument } from "@/hooks/useDocuments";
import type { FormTemplate } from "@/hooks/useFormTemplates";

interface FormTemplateDocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FormTemplate | null;
  moduleLabel?: string;
}

const categoryLabels: Record<DocumentCategory, string> = {
  onboarding: "Onboarding",
  compliance: "Compliance",
  finance: "Finance",
  hr: "HR",
  marketing: "Marketing",
  communications: "Communications",
  program: "Program",
  curriculum: "Curriculum",
  it: "IT",
  legal: "Legal",
  other: "Other",
};

const acceptedFileTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "text/html",
  "application/json",
  "application/zip",
].join(",");

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FormTemplateDocumentUploadDialog({
  open,
  onOpenChange,
  template,
  moduleLabel,
}: FormTemplateDocumentUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadFormTemplateDocument();

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) setSelectedFile(files[0]);
  };

  const handleClose = () => {
    if (!uploadMutation.isPending) {
      setSelectedFile(null);
      setCategory("other");
      onOpenChange(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !template) return;

    await uploadMutation.mutateAsync({
      file: selectedFile,
      formTemplateId: template.id,
      module: template.module,
      category,
      reviewStatus: "Department Form Attachment",
    });

    setSelectedFile(null);
    setCategory("other");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Form Document</DialogTitle>
          <DialogDescription>
            Save a file to {template?.name || "this form"}{moduleLabel ? ` in ${moduleLabel}` : ""}. The file will be linked to this departmental form template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5"
                : selectedFile
                ? "border-primary/50 bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              handleFileSelect(event.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={acceptedFileTypes}
              onChange={(event) => handleFileSelect(event.target.files)}
            />

            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <File className="w-8 h-8 text-primary" />
                <div className="text-left min-w-0">
                  <p className="font-medium text-sm truncate max-w-[220px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Drop a file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Max file size: 50MB</p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="department-form-category">Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as DocumentCategory)}>
              <SelectTrigger id="department-form-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploadMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedFile || !template || uploadMutation.isPending}>
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
