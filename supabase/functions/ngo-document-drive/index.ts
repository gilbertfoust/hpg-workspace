import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { getAccessToken, safeDriveFileName } from "../_shared/googleDrive.js";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-workspace-notification-secret" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const rootId = Deno.env.get("NGO_COORDINATOR_PROFILES_DRIVE_FOLDER_ID") || "1n3oDLG2WOLrQi2kAimeSD09ZuwaPCdvn";
const driveId = Deno.env.get("NGO_COORDINATOR_DRIVE_ID") || "0AIU7hUcYbTpgUk9PVA";
const boundedFetch: typeof fetch = (input, init = {}) => fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function drive(url: string, options: RequestInit = {}) {
  const response = await boundedFetch(url, { ...options, headers: { Authorization: `Bearer ${await getAccessToken()}`, ...options.headers } });
  if (!response.ok) throw new Error(`Drive returned ${response.status}: ${(await response.text()).slice(0, 250)}`);
  return response;
}
async function folder(parentId: string, name: string, key: string, ngoId: string) {
  const params = new URLSearchParams({ q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, corpora: "drive", driveId, includeItemsFromAllDrives: "true", supportsAllDrives: "true", fields: "nextPageToken,files(id,name,appProperties)", pageSize: "1000" });
  let page = "";
  do {
    if (page) params.set("pageToken", page);
    const response = await drive(`https://www.googleapis.com/drive/v3/files?${params}`);
    const result = await response.json();
    const match = result.files?.find((item: { appProperties?: Record<string,string> }) => item.appProperties?.hpgNgoId === ngoId && item.appProperties?.hpgFolderType === key);
    if (match) return match.id as string;
    page = result.nextPageToken || "";
  } while (page);
  const response = await drive("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: safeDriveFileName(name), mimeType: "application/vnd.google-apps.folder", parents: [parentId], appProperties: { hpgNgoId: ngoId, hpgFolderType: key } }),
  });
  return (await response.json()).id as string;
}
async function archive(service: ReturnType<typeof createClient>, record: Record<string, unknown>) {
  const documentId = String(record.document_id);
  const ngoId = String(record.ngo_id);
  const { data: doc, error: docError } = await service.from("documents").select("id,ngo_id,file_path,file_name,file_type,file_size,uploaded_at").eq("id", documentId).single();
  if (docError || !doc || doc.ngo_id !== ngoId) throw new Error("Document record is unavailable");
  if (record.drive_file_id) {
    if (!record.source_removed_at && (doc.file_type?.startsWith("video/") || /\.(mp4|mov|webm|avi|mpeg|mpg|3gp)$/i.test(doc.file_name))) {
      const { error: cleanupError } = await service.storage.from("ngo-documents").remove([doc.file_path]);
      if (cleanupError) throw cleanupError;
      await service.from("ngo_document_archives").update({ source_removed_at: new Date().toISOString(), state: "archived", last_error: null }).eq("document_id", documentId);
    }
    return { documentId, driveFileId: record.drive_file_id, isVideo: !!record.media_folder_id };
  }
  const { data: ngo, error: ngoError } = await service.from("ngos").select("legal_name,common_name").eq("id", ngoId).single();
  if (ngoError || !ngo) throw new Error("NGO profile is unavailable");
  const profileId = await folder(rootId, ngo.legal_name || ngo.common_name || ngoId, "profile", ngoId);
  const mediaId = await folder(profileId, "Media footage", "media", ngoId);
  const documentsId = await folder(profileId, "Documents", "documents", ngoId);
  const isVideo = doc.file_type?.startsWith("video/") || /\.(mp4|mov|webm|avi|mpeg|mpg|3gp)$/i.test(doc.file_name);
  const parent = isVideo ? mediaId : documentsId;
  const { data: blob, error: downloadError } = await service.storage.from("ngo-documents").download(doc.file_path);
  if (downloadError || !blob) throw downloadError || new Error("Staged file is unavailable");
  if (blob.size > 104857600 || blob.size !== doc.file_size) throw new Error("Staged file size does not match the record");
  const metadata = { name: safeDriveFileName(doc.file_name), parents: [parent], mimeType: doc.file_type || "application/octet-stream", appProperties: { hpgNgoId: ngoId, hpgDocumentId: documentId, hpgRecordType: isVideo ? "ngo-media" : "ngo-document" } };
  const start = await drive("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,webViewLink,size", {
    method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": metadata.mimeType, "X-Upload-Content-Length": String(blob.size) }, body: JSON.stringify(metadata),
  });
  const location = start.headers.get("Location");
  if (!location || !location.startsWith("https://www.googleapis.com/")) throw new Error("Drive did not return a resumable upload location");
  const completed = await drive(location, { method: "PUT", headers: { "Content-Type": metadata.mimeType, "Content-Range": `bytes 0-${blob.size - 1}/${blob.size}` }, body: blob });
  const file = await completed.json();
  if (!file.id || Number(file.size) !== blob.size) throw new Error("Drive upload could not be verified");
  const { error: updateError } = await service.from("ngo_document_archives").update({ state: "archived", drive_file_id: file.id, drive_file_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, drive_folder_id: parent, drive_folder_url: `https://drive.google.com/drive/folders/${parent}`, media_folder_id: mediaId, media_folder_url: `https://drive.google.com/drive/folders/${mediaId}`, archived_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null }).eq("document_id", documentId);
  if (updateError) throw updateError;
  if (isVideo) {
    const { error: removeError } = await service.storage.from("ngo-documents").remove([doc.file_path]);
    if (removeError) throw new Error(`Drive copy saved, but staged video cleanup failed: ${removeError.message}`);
    await service.from("ngo_document_archives").update({ source_removed_at: new Date().toISOString() }).eq("document_id", documentId);
  }
  return { documentId, driveFileId: file.id, isVideo };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false }, global: { fetch: boundedFetch } });
  try {
    const auth = req.headers.get("authorization") || "";
    const userClient = createClient(url, anon, { global: { fetch: boundedFetch, headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: userResult } = auth ? await userClient.auth.getUser(auth.replace(/^Bearer\s+/i, "")) : { data: { user: null } };
    const workerSecret = req.headers.get("x-workspace-notification-secret") || "";
    const { data: workerAuthorized } = workerSecret ? await service.rpc("workspace_admin_notification_worker_secret_matches", { p_secret: workerSecret }) : { data: false };
    if (!userResult.user && !workerAuthorized) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    if (body.action === "healthcheck" || body.scheduled) {
      try {
        await drive(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rootId)}?supportsAllDrives=true&fields=id,mimeType`);
      } catch {
        return json({ ready: false, reason: "Google Drive archive connection needs configuration" });
      }
      if (body.action === "healthcheck") return json({ ready: true });
    }
    const documentId = String(body.documentId || "");
    if (body.action === "read") {
      if (!userResult.user || !uuid.test(documentId)) return json({ error: "Unauthorized" }, 401);
      const { data: allowed } = await userClient.from("documents").select("id,ngo_id,file_name,file_type,file_path").eq("id", documentId).maybeSingle();
      if (!allowed) return json({ error: "Document unavailable" }, 404);
      const { data: nativeFile } = await service.storage.from("ngo-documents").download(allowed.file_path);
      if (nativeFile) return new Response(nativeFile, { headers: { ...cors, "Content-Type": allowed.file_type || "application/octet-stream", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(allowed.file_name)}`, "Cache-Control": "private, no-store" } });
      const { data: archived } = await service.from("ngo_document_archives").select("state,drive_file_id,source_removed_at").eq("document_id", documentId).single();
      if (archived?.state !== "archived" || !archived.drive_file_id) return json({ error: "Media is still processing" }, 409);
      const media = await drive(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(archived.drive_file_id)}?alt=media&supportsAllDrives=true`);
      return new Response(media.body, { headers: { ...cors, "Content-Type": allowed.file_type || "application/octet-stream", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(allowed.file_name)}`, "Cache-Control": "private, no-store" } });
    }
    if (!workerAuthorized) {
      if (!uuid.test(documentId) || !userResult.user) return json({ error: "Invalid document" }, 400);
      const { data: allowed } = await userClient.from("documents").select("id").eq("id", documentId).maybeSingle();
      if (!allowed) return json({ error: "Document unavailable" }, 404);
    }
    if (documentId) {
      try { await drive(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rootId)}?supportsAllDrives=true&fields=id,mimeType`); }
      catch { return json({ ready: false, queued: true, documentId, archive_pending: true, message: "Document received. The additional archive copy is pending." }, 202); }
    }
    let query = service.from("ngo_document_archives").select("document_id,ngo_id,state,updated_at,attempts,drive_file_id,source_removed_at,media_folder_id").in("state", ["pending", "retry"]);
    if (documentId) query = query.eq("document_id", documentId);
    else query = query.lte("updated_at", new Date(Date.now() - 60000).toISOString()).order("updated_at", { ascending: true }).limit(2);
    const { data: rows, error } = await query;
    if (error) throw error;
    const results = [];
    for (const row of rows || []) {
      const claimedAt = new Date().toISOString();
      const claim = await service.from("ngo_document_archives").update({ state: "processing", attempts: row.attempts + 1, updated_at: claimedAt }).eq("document_id", row.document_id).eq("state", row.state).eq("updated_at", row.updated_at).select("document_id").maybeSingle();
      if (!claim.data) continue;
      try { results.push(await archive(service, row)); }
      catch (cause) {
        const message = cause instanceof Error ? cause.message : "Unknown Drive archive error";
        await service.from("ngo_document_archives").update({ state: "retry", last_error: message.slice(0, 400), updated_at: new Date().toISOString() }).eq("document_id", row.document_id);
        results.push({ documentId: row.document_id, error: message });
      }
    }
    return json({ results });
  } catch (cause) { return json({ error: cause instanceof Error ? cause.message : "Drive operation failed" }, 500); }
});
