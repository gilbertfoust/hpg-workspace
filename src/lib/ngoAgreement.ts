export type NgoAgreement = {
  id: string;
  ngo_id: string;
  agreement_name: string;
  status: string;
  hpg_signed_pdf_path: string | null;
  executed_pdf_path: string | null;
  signer_name: string | null;
  signed_at: string | null;
  created_at: string;
};

export const releasedAgreementStatuses = ["hpg_signed", "executed"];

export function isPreparedAgreementReviewPath(path: string): boolean {
  return /^[^/]+\/[^/]+\/review-v\d+\.pdf$/i.test(path);
}

export function isReleasedAgreement(item: NgoAgreement | null, ngoId: string): item is NgoAgreement {
  return !!item && item.ngo_id === ngoId && releasedAgreementStatuses.includes(item.status);
}

export function agreementPdfPath(item: NgoAgreement | null, ngoId: string): string | null {
  if (!isReleasedAgreement(item, ngoId)) return null;
  const path = item.status === "executed" ? item.executed_pdf_path : item.hpg_signed_pdf_path;
  // Only database-issued object keys; never accept external URLs or traversal.
  if (!path || path.startsWith("/") || path.includes(":") || path.includes("\\") || path.split("/").some((part) => part === ".." || part === ".")) return null;
  return path;
}

export async function resolveReleasedAgreement(
  ngoId: string,
  linkedId: string | null | undefined,
  findLinked: (id: string) => Promise<NgoAgreement | null>,
  findLatest: () => Promise<NgoAgreement | null>,
): Promise<NgoAgreement | null> {
  if (linkedId) {
    const linked = await findLinked(linkedId);
    if (isReleasedAgreement(linked, ngoId)) return linked;
  }
  const latest = await findLatest();
  return isReleasedAgreement(latest, ngoId) ? latest : null;
}