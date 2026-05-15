# HPG Assistant MCP Deployment Readiness Guide

This guide prepares the HPG Assistant MCP server for private ChatGPT connector testing.

## Current Status

The MCP server scaffold is intentionally read-only and draft-only.

Current tools:

1. `search_ngos`
2. `generate_onboarding_packet`

These tools read from Supabase and return structured text. They do not write records, send emails, approve NGOs, update finances, publish donor-facing claims, or change sponsorship status.

## Required Secrets

Set these only in the server hosting environment. Never place them in frontend `.env` files.

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
NODE_ENV=production
```

## Local Test Steps

From this folder:

```bash
cd mcp/hpg-assistant
npm install
npm run build
npm run dev
```

The local MCP server uses stdio transport for development testing.

## Deployment Target Options

Choose one server-side host:

1. Render Web Service
2. Railway service
3. Fly.io app
4. Dedicated VPS
5. Supabase Edge Function only after the transport requirements are confirmed

Do not deploy this as a static frontend. The Supabase service-role key must remain server-side.

## Pre-Deployment Checklist

- [ ] Confirm Supabase project URL.
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` only to server secret storage.
- [ ] Confirm `ngos` table is readable by server-side client.
- [ ] Confirm `work_items` table is readable by server-side client.
- [ ] Confirm test NGO record exists.
- [ ] Run `npm run build` inside `mcp/hpg-assistant`.
- [ ] Test `search_ngos`.
- [ ] Test `generate_onboarding_packet`.
- [ ] Confirm no write tools are enabled.

## ChatGPT Connector Setup Notes

When connecting this to ChatGPT Developer Mode or a private app configuration, expose only the approved MCP endpoint and only the tools required for the MVP.

Recommended initial tool allowlist:

```text
search_ngos
generate_onboarding_packet
```

Do not expose write tools until HPG has role-based authorization, audit logging, and human approval gates.

## Safety Rules

The first deployed MCP server must remain:

- read-only,
- draft-only,
- internal-facing,
- grounded in Supabase,
- unable to send email,
- unable to create or approve public commitments,
- unable to change financial or legal records.

## Next MCP Milestone

After deployment testing works, add:

1. `get_saved_packets`
2. `get_packet_history`
3. `prepare_cabinet_summary`

Keep these read-only until the approval model is fully hardened.
