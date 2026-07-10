# International NGO $100 Activation Fee — Payment Gateway Gate

Status: **Finance configuration required before live use**

The Agent OS now supports the dedicated international NGO activation form, secure invitation, submission routing, and Finance verification gate. It deliberately does not create or activate a live payment processor.

## Finance decision required

Finance must approve one or more supported payment methods for international NGOs:

1. HPG Stripe Payment Link or Checkout Session;
2. approved bank-transfer instructions;
3. another method approved in writing by Finance.

## Required controls

- fixed charge: **$100 USD**;
- payment metadata must include the permanent HPG NGO profile number;
- payment success must not automatically issue the confirmation letter without Finance verification;
- refunds, disputes, duplicate payments, failed payments, and partial payments require human Finance handling;
- payment credentials and webhook secrets must remain in approved secret storage;
- the public form must never expose banking credentials or unrestricted payment-administration links;
- a test-mode payment must pass before production activation.

## Implementation boundary

Until Finance selects and approves the payment method, the international form collects the payment method and optional transaction reference, then creates a Finance verification task. The confirmation-letter gate remains locked until `agent_os_verify_activation_fee()` records Finance verification.
