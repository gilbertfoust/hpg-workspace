# NGO Activation Fee Routing

Status: **Implemented in PR #99; production deployment pending**  
Owner: Development Executive Secretariat + Finance  
Applies after: **General Counsel-approved agreement is fully signed**

## Governing rule

HPG uses two separate post-agreement fee routes:

| NGO jurisdiction | Required route | Amount |
|---|---|---:|
| United States | Existing U.S. NGO onboarding fee form | Existing HPG/Finance configuration |
| Outside the United States | International NGO Activation Fee Form | **$100 USD fixed** |

The forms are mutually exclusive:

- A U.S. NGO must never receive the international $100 form.
- An international NGO must never receive the U.S. onboarding fee form.
- Country must be present before the system creates the fee route.

## Approved sequence

```text
Agreement approved by General Counsel
→ agreement fully signed by the NGO and an authorized HPG signer
→ classify jurisdiction from the NGO/case country
→ select the correct fee policy and form
→ send the secure form invitation
→ receive form and payment information
→ Finance verifies the applicable payment
→ issue HPG confirmation letter
→ activate the NGO profile
→ transfer the master relationship to NGO Coordination
→ begin cross-department onboarding
```

The confirmation letter is blocked until Finance records payment verification.

## International form

Template name:

`International NGO Activation Fee Form — $100 USD`

Required information includes:

- permanent HPG NGO profile number;
- legal organization name;
- country;
- authorized representative;
- billing email;
- fixed `$100 USD` amount;
- payment method;
- payer name;
- optional payment/transaction reference;
- signed-agreement acknowledgment;
- accuracy and authorization certification.

Server-side validation rejects:

- an amount other than $100 USD;
- a U.S. NGO attempting to use the international form;
- a profile number that does not match the invitation;
- submission without the required acknowledgments;
- expired, revoked, reused, or invalid invitation tokens.

## Secure invitation model

International NGOs may not have an HPG portal account at this stage. The Agent OS therefore uses a pre-activation external invitation:

- 256-bit random token;
- only the SHA-256 token hash is stored;
- default expiration of 14 days, maximum 30 days;
- one active invitation per case and form;
- previous active invitation revoked when a replacement is issued;
- invitation creation restricted to internal staff or the authenticated Agent OS worker;
- public token allows access only to the assigned form and safe case display information;
- successful submission consumes the invitation.

## Communication controls

After an authorized internal action creates the invitation, the system queues a routine automatic email through `communication_queue`.

The communication worker remains protected by:

1. server-side live-delivery setting;
2. live request flag;
3. Resend credential configuration;
4. authority-level restriction to `automatic` records;
5. retry and terminal-failure logging.

The case is marked as having the form sent only after the communication worker reports successful delivery. A terminal delivery failure creates an urgent internal next action.

## Finance processing

Submission creates or updates:

- the external-form invitation status;
- a `form_submissions` record routed to Finance;
- a Finance verification work item when an internal actor is available;
- a Trello synchronization request for the Finance NGO onboarding route;
- the sponsorship case next action;
- the audit history through existing Agent OS case and run records.

The form submission is not payment verification. Finance must separately confirm that the applicable payment cleared and record the payment reference through `agent_os_verify_activation_fee()`.

## Payment processing boundary

This implementation does **not** create a Stripe product, charge a card, move money, or independently verify a bank transfer. A live payment link or invoice must be approved and configured by HPG Finance. The Agent OS stores and routes the form, payment method, and transaction reference, then waits for Finance verification.

## Production prerequisites

- Agent OS runtime migrations validated and deployed;
- `agent-os-external-form` Edge Function deployed;
- public HPG Workspace base URL configured when invitations are created;
- `AGENT_OS_WORKER_SECRET` installed for scheduled creation where used;
- Resend sender verified and communications worker configured;
- Finance Trello route `finance_ngo_onboarding` mapped;
- fabricated U.S. and international cases tested;
- Technology and Finance approval recorded before live use.
