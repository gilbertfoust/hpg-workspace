# Fiscal Sponsorship Accounting Flow

## Overview

HPG acts as fiscal sponsor. Incoming funds for sponsored NGOs are split between:

1. **Pass-through / restricted NGO funds** — liability or restricted net assets (via fund + revenue classification)
2. **HPG admin fee revenue** — typically account `4300 Fiscal Sponsorship Admin Fees`

## Admin fee calculation

`finance_admin_fee_rules` stores:

- Default percentage (demo seed: 10%)
- Optional NGO-specific override
- Optional grant-specific override
- Fee revenue account and fund references

RPC `finance_calculate_admin_fee(amount, ngo_id, grant_id)` returns suggested fee and pass-through amounts.

## Deposit workflow

1. Record deposit with sponsored NGO selected on **Deposits & Revenue** page.
2. System suggests admin fee split; finance may override.
3. On post: **Dr Bank / Cr Admin fee revenue + Cr pass-through revenue** (multi-line deposit).

## Disbursement workflow

1. Create **Sponsored NGO disbursement** or **Grant pass-through** payment.
2. Tie to NGO, fund, grant application, and documentation/approval notes.
3. On post: **Dr expense (grant disbursement) / Cr bank**.

## Audit

All posts create journal entries with `source_type` and audit events. Receipts should be linked via `finance_document_links` or journal line `document_id`.
