import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCurriculumAsset, useUpdateCurriculumAsset } from "@/hooks/useCurriculumAssets";
import type { CurriculumAsset } from "@/hooks/useCurriculumAssets";

interface CurriculumAssetDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: CurriculumAsset | null;
}

const statusOptions = ["Draft", "In Review", "Approved", "Archived"];
const formatOptions = ["PDF", "Slide", "Video", "Worksheet", "Other"];

export function CurriculumAssetDrawer({ open, onOpenChange, asset }: CurriculumAssetDrawerProps) {
  const { mutateAsync: createAsset, isPending: isCreating } = useCreateCurriculumAsset();
  const { mutateAsync: updateAsset, isPending: isUpdating } = useUpdateCurriculumAsset();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");
  const [audience, setAudience] = useState("");
  const [format, setFormat] = useState("");
  const [language, setLanguage] = useState("");
  const [status, setStatus] = useState("Draft");
  const [fileUrl, setFileUrl] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(asset?.title || "");
      setDescription(asset?.description || "");
      setVersion(asset?.version || "");
      setAudience(asset?.audience || "");
      setFormat(asset?.format || "");
      setLanguage(asset?.language || "");
      setStatus(asset?.status || "Draft");
      setFileUrl(asset?.file_url || "");
    }
  }, [asset, open]);

  const handleSubmit = async () => {
    const payload = {
      title,
      description: description || null,
      version: version || null,
      audience: audience || null,
      format: format || null,
      language: language || null,
      status,
      file_url: fileUrl || null,
      last_updated_at: new Date().toISOString(),
    };

    if (asset?.id) {
      await updateAsset({ id: asset.id, ...payload });
    } else {
      await createAsset(payload);
    }

    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh]">
        <DrawerHeader>
          <DrawerTitle>{asset ? "Edit Curriculum Asset" : "New Curriculum Asset"}</DrawerTitle>
          <DrawerDescription>Capture metadata and upload links for curriculum materials.</DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Asset title" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Version</Label>
              <Input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="v1.0" />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Facilitators" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="English" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>File URL / Path</Label>
              <Input value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} placeholder="https://..." />
            </div>
          </div>
        </div>

        <DrawerFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title || isCreating || isUpdating}>
            {asset ? "Save Changes" : "Create Asset"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
