import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { agreementPdfPath, isPreparedAgreementReviewPath, resolveReleasedAgreement, type NgoAgreement } from "./ngoAgreement";

const popli: NgoAgreement = { id: "popli-agreement", ngo_id: "popli", agreement_name: "Fiscal Sponsorship Agreement", status: "hpg_signed", hpg_signed_pdf_path: "popli/hpg.pdf", executed_pdf_path: "popli/executed.pdf", signer_name: null, signed_at: null, created_at: "2026-10-24" };
describe("NGO released agreement rules", () => {
  test("prepared review-only agreement PDFs are excluded without hiding ordinary Financial Instructions", () => {
    for (const path of ["popli/agreement-id/review-v1.pdf", "another-ngo/another-agreement/review-v27.pdf"])
      assert.equal(isPreparedAgreementReviewPath(path), true);
    assert.equal(isPreparedAgreementReviewPath("popli/Financial Instructions 1-7 Revision 1.pdf"), false);
    assert.equal(isPreparedAgreementReviewPath("popli/agreement-id/executed.pdf"), false);
  });
  test("hpg_signed exposes only the HPG signed PDF", () => { assert.equal(agreementPdfPath(popli, "popli"), "popli/hpg.pdf"); assert.equal(popli.status, "hpg_signed"); });
  test("executed exposes only the executed PDF", () => { assert.equal(agreementPdfPath({ ...popli, status: "executed" }, "popli"), "popli/executed.pdf"); });
  test("unreleased agreement cannot be downloaded", () => { for (const status of ["draft", "issued", "viewed", "voided", "expired", "signed"]) assert.equal(agreementPdfPath({ ...popli, status }, "popli"), null); });
  test("another NGO cannot see POPLI even through a stale pointer or returned fallback", async () => { assert.equal(agreementPdfPath(popli, "another-ngo"), null); assert.equal(await resolveReleasedAgreement("another-ngo", popli.id, async () => popli, async () => popli), null); });
  test("missing pointer resolves the current NGO released agreement", async () => { assert.deepEqual(await resolveReleasedAgreement("popli", null, async () => { throw new Error("must not query missing ID"); }, async () => popli), popli); });
  test("stale pointer falls back without altering onboarding", async () => { assert.deepEqual(await resolveReleasedAgreement("popli", "stale", async () => null, async () => popli), popli); });
  test("unreleased pointer falls back to a released agreement", async () => { assert.deepEqual(await resolveReleasedAgreement("popli", "draft", async () => ({ ...popli, status: "draft" }), async () => popli), popli); });
  test("valid linked agreement takes precedence over older agreements", async () => { assert.deepEqual(await resolveReleasedAgreement("popli", popli.id, async () => popli, async () => { throw new Error("fallback must not run"); }), popli); });
  test("executed agreement never falls back to HPG-only PDF", () => { assert.equal(agreementPdfPath({ ...popli, status: "executed", executed_pdf_path: null }, "popli"), null); });
  test("URLs and traversal are rejected", () => { for (const path of ["https://drive.google.com/file", "../other.pdf", "/other.pdf"]) assert.equal(agreementPdfPath({ ...popli, hpg_signed_pdf_path: path }, "popli"), null); });
});