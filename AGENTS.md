# Project rules
- Resolve NGO portal agreements through a shared NGO-scoped released-agreement query; derive private PDF actions only from its database record, so Documents and Onboarding cannot diverge or accept arbitrary paths.
- Keep the active `sign-ngo-agreement` function authoritative for signature transitions; client guards prevent repeated submissions without writing agreement status or PDFs.
- Mount NGO portal views under `/portal/*` using the existing protected route, which already enforces NGO-only access.