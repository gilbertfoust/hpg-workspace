/* Private media assets remain inaccessible to public publication pages. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";

export type EditorialAsset = {
  id: string;
  editorial_item_id: string;
  bucket_name: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  file_size: number;
  alt_text: string;
  attribution: string;
  license_type: string;
  rights_document_id: string | null;
  rights_status: "pending" | "cleared" | "rejected";
  rights_note: string;
  created_at: string;
  uploaded_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};
export type AssetInput = {
  editorial_item_id: string;
  file: File;
  alt_text: string;
  attribution: string;
  license_type: "owned" | "licensed" | "permission" | "public_domain" | "unknown";
  rights_document_id: string | null;
};
const bucket = "editorial-media-private";
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/wav"]);
const maxBytes = 25 * 1024 * 1024; // Browser upload ceiling; larger video belongs in controlled Drive storage.

export function useEditorialAssets() {
  return useQuery<EditorialAsset[]>({
    queryKey: ["editorial-assets"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await (ensureSupabase() as any).from("editorial_assets")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EditorialAsset[];
    },
  });
}

export function useUploadEditorialAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ editorial_item_id, file, alt_text, attribution, license_type, rights_document_id }: AssetInput) => {
      if (!allowed.has(file.type)) throw new Error("Unsupported media type. Use images, PDF, supported video, or audio.");
      if (file.size < 1 || file.size > maxBytes) throw new Error("This uploader supports files up to 25 MB. Use approved Drive storage for larger recordings.");
      const client = ensureSupabase() as any;
      const { data: userData, error: authError } = await client.auth.getUser();
      if (authError || !userData.user) throw new Error("Sign in before uploading.");
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      const path = userData.user.id + "/" + editorial_item_id + "/" + crypto.randomUUID() + "." + ext;
      const uploaded = await client.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
      if (uploaded.error) throw uploaded.error;
      const { data, error } = await client.from("editorial_assets").insert({
        editorial_item_id, file_name: file.name, storage_path: path,
        content_type: file.type, file_size: file.size,
        alt_text, attribution, license_type, rights_document_id,
      }).select().single();
      if (error) {
        // A failed metadata insert must not strand an untracked private upload.
        await client.storage.from(bucket).remove([path]);
        throw error;
      }
      return data as EditorialAsset;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["editorial-assets"] }),
  });
}

export function useReviewEditorialAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: "cleared" | "rejected"; note: string }) => {
      const { data, error } = await (ensureSupabase() as any).rpc("review_editorial_asset", {
        p_id: id, p_decision: decision, p_note: note,
      });
      if (error) throw error;
      return data as EditorialAsset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["editorial-assets"] });
      qc.invalidateQueries({ queryKey: ["editorial"] });
    },
  });
}

export async function getEditorialAssetPreview(asset: EditorialAsset): Promise<string> {
  const { data, error } = await ensureSupabase().storage.from(bucket).createSignedUrl(asset.storage_path, 60);
  if (error || !data?.signedUrl) throw error || new Error("Could not open private media.");
  return data.signedUrl;
}
