const GENERAL_COUNSEL_DRIVE_ID =
  Deno.env.get("GENERAL_COUNSEL_DRIVE_ID") || "0AO_go0EeFdBeUk9PVA";
const FSA_PENDING_FOLDER_ID =
  Deno.env.get("GENERAL_COUNSEL_FSA_PENDING_FOLDER_ID") || "1mBzRaBY0raTvCz2OTKtnvXhJkVyzT3Pc";
const COMPLETED_CONTRACTS_FOLDER_ID =
  Deno.env.get("GENERAL_COUNSEL_COMPLETED_CONTRACTS_FOLDER_ID") || "1ow90Op7kLl_FiCY7oKc-Pm3xbFv7bT5E";

const encoder = new TextEncoder();

const clean = (value) => String(value ?? "").trim();

export const safeDriveFileName = (value, fallback = "HPG-Document.pdf") => {
  const name = clean(value)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[-. ]+|[-. ]+$/g, "")
    .slice(0, 180);
  return name || fallback;
};

const normalizedName = (value) => clean(value).toLocaleLowerCase("en-US").replace(/\s+/g, " ");

export async function getAccessToken() {
  const clientId = clean(Deno.env.get("GOOGLE_DRIVE_CLIENT_ID"));
  const clientSecret = clean(Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET"));
  const refreshToken = clean(Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN"));
  if (clientId && clientSecret && refreshToken) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new Error(`Google Drive authorization refresh failed (${response.status})`);
    }
    return payload.access_token;
  }

  const accessToken = clean(Deno.env.get("GOOGLE_DRIVE_ACCESS_TOKEN"));
  if (accessToken) return accessToken;
  throw new Error("Google Drive archive credentials are not configured on the server");
}

async function driveFetch(url, init = {}) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = clean(payload?.error?.message || payload?.error || payload?.message).slice(0, 300);
    throw new Error(`Google Drive request failed (${response.status})${message ? `: ${message}` : ""}`);
  }
  return payload;
}

async function listFolder(parentId, mimeType) {
  const clauses = [`'${parentId}' in parents`, "trashed=false"];
  if (mimeType) clauses.push(`mimeType='${mimeType}'`);
  const params = new URLSearchParams({
    q: clauses.join(" and "),
    corpora: "drive",
    driveId: GENERAL_COUNSEL_DRIVE_ID,
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    pageSize: "1000",
    fields: "files(id,name,mimeType,webViewLink,appProperties)",
  });
  const payload = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
  return Array.isArray(payload.files) ? payload.files : [];
}

async function ensureNgoCompletedFolder({ ngoId, legalName, commonName }) {
  const folders = await listFolder(COMPLETED_CONTRACTS_FOLDER_ID, "application/vnd.google-apps.folder");
  const candidates = [legalName, commonName].map(normalizedName).filter(Boolean);
  let folder = folders.find((item) => item.appProperties?.hpgNgoId === ngoId)
    || folders.find((item) => !item.appProperties?.hpgNgoId && candidates.includes(normalizedName(item.name)));

  if (folder) {
    if (folder.appProperties?.hpgNgoId !== ngoId) {
      folder = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folder.id)}?supportsAllDrives=true&fields=id,name,mimeType,webViewLink,appProperties`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appProperties: { ...(folder.appProperties || {}), hpgNgoId: ngoId },
          }),
        },
      );
    }
    return folder;
  }

  const preferredName = safeDriveFileName(legalName || commonName || `NGO-${ngoId}`, `NGO-${ngoId}`);
  const nameAlreadyAssigned = folders.some((item) => (
    normalizedName(item.name) === normalizedName(preferredName)
    && item.appProperties?.hpgNgoId
    && item.appProperties.hpgNgoId !== ngoId
  ));
  const folderName = nameAlreadyAssigned ? `${preferredName} (${ngoId.slice(0, 8)})` : preferredName;
  return driveFetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,mimeType,webViewLink,appProperties",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [COMPLETED_CONTRACTS_FOLDER_ID],
        appProperties: { hpgNgoId: ngoId, hpgRecordType: "ngo-completed-contract-folder" },
      }),
    },
  );
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function uploadPdf({ bytes, fileName, parentFolderId, archiveKey, appProperties }) {
  const existingFiles = await listFolder(parentFolderId, "application/pdf");
  const existing = existingFiles.find((item) => item.appProperties?.hpgArchiveKey === archiveKey);
  const boundary = `hpg_${crypto.randomUUID()}`;
  const metadata = {
    name: safeDriveFileName(fileName),
    mimeType: "application/pdf",
    parents: existing ? undefined : [parentFolderId],
    appProperties: {
      ...(existing?.appProperties || {}),
      ...Object.fromEntries(Object.entries(appProperties || {}).map(([key, value]) => [key, clean(value)])),
      hpgArchiveKey: archiveKey,
    },
  };
  if (existing) delete metadata.parents;
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = concatBytes([prefix, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), suffix]);
  const baseUrl = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}`
    : "https://www.googleapis.com/upload/drive/v3/files";
  const params = new URLSearchParams({
    uploadType: "multipart",
    supportsAllDrives: "true",
    fields: "id,name,webViewLink,appProperties",
  });
  const file = await driveFetch(`${baseUrl}?${params}`, {
    method: existing ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return {
    fileId: file.id,
    fileUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    folderId: parentFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${parentFolderId}`,
  };
}

export async function archiveReviewAgreement(input) {
  return uploadPdf({
    bytes: input.bytes,
    fileName: input.fileName,
    parentFolderId: FSA_PENDING_FOLDER_ID,
    archiveKey: `agreement:${input.agreementId}:review:v${input.revision}`,
    appProperties: {
      hpgRecordType: "fiscal-sponsorship-agreement-review",
      hpgNgoId: input.ngoId,
      hpgAgreementId: input.agreementId,
      hpgRevision: input.revision,
      hpgFiscalType: input.fiscalType,
      hpgSha256: input.sha256,
    },
  });
}

export async function archiveExecutedAgreement(input) {
  const folder = await ensureNgoCompletedFolder(input);
  return uploadPdf({
    bytes: input.bytes,
    fileName: input.fileName,
    parentFolderId: folder.id,
    archiveKey: `agreement:${input.agreementId}:executed:v${input.revision}`,
    appProperties: {
      hpgRecordType: "executed-fiscal-sponsorship-agreement",
      hpgNgoId: input.ngoId,
      hpgAgreementId: input.agreementId,
      hpgRevision: input.revision,
      hpgFiscalType: input.fiscalType,
      hpgSha256: input.sha256,
    },
  });
}

export async function archiveConfirmationLetter(input) {
  const folder = await ensureNgoCompletedFolder(input);
  return uploadPdf({
    bytes: input.bytes,
    fileName: input.fileName,
    parentFolderId: folder.id,
    archiveKey: `agreement:${input.agreementId}:confirmation:v${input.revision}`,
    appProperties: {
      hpgRecordType: "fiscal-sponsorship-confirmation-letter",
      hpgNgoId: input.ngoId,
      hpgAgreementId: input.agreementId,
      hpgConfirmationLetterId: input.confirmationLetterId,
      hpgRevision: input.revision,
      hpgFiscalType: input.fiscalType,
      hpgSha256: input.sha256,
    },
  });
}

export const GENERAL_COUNSEL_ARCHIVE = Object.freeze({
  driveId: GENERAL_COUNSEL_DRIVE_ID,
  pendingFolderId: FSA_PENDING_FOLDER_ID,
  completedContractsFolderId: COMPLETED_CONTRACTS_FOLDER_ID,
});
