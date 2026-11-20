# Clinic Operations System (front-end demo)

A click-through demo for the clinic proposal: **record every booking and payment once, see one live status, and let the system follow up on unpaid visits.** Front end only: all data lives in the browser and every name, number and amount is fictional. It mirrors the structure of the school enrollment template (React 19 + TypeScript + Vite, hash-routed so `dist/` runs from any folder).

Pitch deck brief: `../CLINIC-PITCH-DECK-BRIEF.md`. Build plan: `../CLINIC-SYSTEM-PLAN.md`.

## Run it
```bash
npm install
npm run dev      # http://localhost:5176
npm test         # ledger, unpaid-list and payment-recognition rules
npm run build    # static site in dist/
```
First visit seeds ~140 sample visits across three placeholder services (Service A/B/C). **Settings -> Data -> Reset demo data** restores them.

## What the demo shows (mapped to the pitch)
| Pitch idea | Where |
|---|---|
| One live status instead of the logbook | **Day sheet** (`#/app`): Booked / Arrived / Done and Unpaid / Partial / Paid, printable |
| Doctor taps instead of relaying | **Quick view** (`#/app/quick`, best on a phone): "Paid ₱___ cash ✓" with a confirm step |
| Automated monitoring of paid patients | Status is derived from the ledger (`core/logic.ts`: `payStatus`, `balance`); Payments page has the daily close-out |
| Automated list of unpaid patients | **Unpaid list**: oldest first, aging filters, last contact and promised dates, CSV export, drafted reminder (staff send it) |
| Automatic recognition of payments (AI agent) | **Payment inbox**: a message becomes a *proposal* (patient, visit, amount, confidence, warnings). Staff confirm; nothing is recorded by itself. The matching here is simple built-in heuristics standing in for a DOVA payments agent |
| Cash today, online tomorrow | "Link" button on a visit opens a demo online-payment link; "Simulate: patient paid online" marks it Paid with source *Online (verified)*. Toggle in Settings |
| Optional patient booking | `#/book`: a request lands in Bookings as *Requested* for staff to confirm |
| Roles | Sidebar "Demo: using as" switcher: Administrator / Front desk / Doctor (the doctor sees only their own patients and cannot open unpaid list, ledger or settings) |
| Reports | No-show rate, same-day recording %, collections per day, by method, aging |

## Rules baked in (check each with the client)
* Unpaid = a visit that has happened (arrived, done or no-show) with a balance. Future bookings and today's not-yet-arrived patients are not owed. Optional grace days in Settings.
* A payment cannot exceed the balance, and a reference number already in the ledger is refused (duplicate guard).
* Only an administrator can void a payment (reason required); the record stays, marked void.
* The payment-recognition inbox only **proposes**. A partial name match (surname only) is never "high" confidence. In production only a provider-verified online payment may mark Paid without a human.
* Recording a payment on a *booked* visit marks it *Arrived*.
* Sample receipts are labelled "not an official receipt": real BIR-compliant receipting is an open item.

## Layout
```
src/config/clinic.config.ts   client defaults (names, services, doctors, methods, role permissions)
src/core/                     types, pure rules (logic.ts + tests), data context, storage adapter, demo seed
src/features/                 one file per screen
src/ui/                       layout and shared components
```

## Turning the demo into the real system
1. Implement `Repository` (`src/core/storage.ts`) against Supabase in a **dedicated project owned by the clinic**; keep service-level data isolation with row-level security and an audit trail (as done for the EMS).
2. Real sign-in and server-enforced roles (the demo switcher is not security). 2-factor for administrators.
3. Replace the demo heuristics with the DOVA payments agent behind a tool that **refuses** to record a payment without a human confirmation (enforce in code, not in the prompt); minimise patient data sent to the AI and put a data-processing agreement in place.
4. Online payments: a payment-provider account in the clinic's name and a signed-webhook endpoint. The browser must never be able to mark a payment paid.
5. Nightly backups, privacy notice/consent, retention rules, and the integration path chosen for the existing records system (see the plan, section 2).
