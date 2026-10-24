import { describe, expect, test } from "bun:test";
import { agreementPdfPath, resolveReleasedAgreement, type NgoAgreement } from "./ngoAgreement";

const popli: NgoAgreement = { id: "popli-agreement", ngo_id: "popli", agreement_name: "Fiscal Sponsorship Agreement", status: "hpg_signed", hpg_signed_pdf_path: "popli/hpg.pdf", executed_pdf_path: "popli/executed.pdf", signer_name: null, signed_at: null, created_at: "2026-10-24" };
describe("NGO released agreement rules", () => {
  test("hpg_signed exposes only the HPG signed PDF", () => { expect(agreementPdfPath(popli, "popli")).toBe("popli/hpg.pdf"); expect(popli.status).toBe("hpg_signed"); });
  test("executed exposes only the executed PDF", () => { expect(agreementPdfPath({ ...popli, status: "executed" }, "popli")).toBe("popli/executed.pdf"); });
  test("unreleased agreement cannot be downloaded", () => { for (const status of ["draft", "issued", "viewed", "voided", "expired", "signed"]) expect(agreementPdfPath({ ...popli, status }, "popli")).toBeNull(); });
  test("another NGO cannot see POPLI even through a stale pointer or returned fallback", async () => { expect(agreementPdfPath(popli, "another-ngo")).toBeNull(); expect(await resolveReleasedAgreement("another-ngo", popli.id, async () => popli, async () => popli)).toBeNull(); });
  test("missing pointer resolves the current NGO released agreement", async () => { expect(await resolveReleasedAgreement("popli", null, async () => { throw new Error("must not query missing ID"); }, async () => popli)).toEqual(popli); });
  test("stale pointer falls back without altering onboarding", async () => { expect(await resolveReleasedAgreement("popli", "stale", async () => null, async () => popli)).toEqual(popli); });
  test("unreleased pointer falls back to a released agreement", async () => { expect(await resolveReleasedAgreement("popli", "draft", async () => ({ ...popli, status: "draft" }), async () => popli)).toEqual(popli); });
  test("valid linked agreement takes precedence over older agreements", async () => { expect(await resolveReleasedAgreement("popli", popli.id, async () => popli, async () => { throw new Error("fallback must not run"); })).toEqual(popli); });
  test("executed agreement never falls back to HPG-only PDF", () => { expect(agreementPdfPath({ ...popli, status: "executed", executed_pdf_path: null }, "popli")).toBeNull(); });
  test("URLs and traversal are rejected", () => { for (const path of ["https://drive.google.com/file", "../other.pdf", "/other.pdf"]) expect(agreementPdfPath({ ...popli, hpg_signed_pdf_path: path }, "popli")).toBeNull(); });
});