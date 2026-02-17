# FIELD_MAPPING_MATRIX.md

MarineFlow staff-only intake normalization matrix for CMS website forms.

## Scope
- Source forms (WordPress):
  - General Repair Form
  - Non-Storage Form
  - Outdoor Storage Form
- Destination system:
  - MarineFlow `IntakeRequest`
  - Optional auto-created `WorkOrder`
- Downstream targets:
  - Wallace fallback queue
  - QuickBooks mapping layer (`qb-map.ts`)

---

## Canonical MarineFlow Intake Fields

| MarineFlow field | Required | Type | Notes |
|---|---:|---|---|
| `customerName` | Yes | string | Owner name |
| `email` | No | string\|null | Customer email |
| `phone` | No | string\|null | Customer phone |
| `vesselName` | No | string\|null | Boat name |
| `serviceRequest` | Yes | string | Human-readable summarized request |
| `location` | Yes | string | Pickup/slip/drop-off/address fallback |

---

## Source → Canonical Mapping

### Identity / Contact
- `Name of Owner` / `ownerName` / `name` → `customerName`
- `Email` / `email` → `email`
- `Telephone` / `phone` → `phone`

### Vessel
- `BOAT NAME` / `boatName` / `vesselName` → `vesselName`

### Location (priority order)
1. `Boat Located for FALL PICK-UP`
2. `Mooring/Harbor/Marina Slip`
3. `Spring Drop off Location`
4. `location`
5. `Mailing Address`
6. fallback: `Unspecified`

### Service request synthesis
`serviceRequest` is composed from available fields:
- `General Repairs Need` / `Known boat repairs needed`
- `Additional work requested`
- `KEY LOCATION`

Format:
- `Repairs: <...> | Additional work: <...> | Key location: <...>`
- If all missing: fallback to incoming `serviceRequest/request/notes`
- If still missing: `New customer request from CMS website form.`

---

## Form Type Detection Rules

Detected into internal enum:
- `GENERAL_REPAIR`
- `NON_STORAGE`
- `OUTDOOR_STORAGE`
- `UNKNOWN`

Detection uses:
1. `Page URL` (`general-repair-form`, `non-storage-form`, `outdoor-storage`)
2. `Subject` (`general repair`, `non-storage`, `outdoor storage`)

---

## Webhook Contract (current)

### Endpoint
`POST /api/webhooks/cms-intake`

### Auth
One of:
- `x-cms-webhook-secret: <secret>`
- `x-webhook-secret: <secret>`
- `Authorization: Bearer <secret>`

Controlled by env:
- `CMS_WEBHOOK_SECRET`
- `CMS_WEBHOOK_AUTO_CREATE_WORK_ORDER=true|false`

### Side effects
1. Creates `IntakeRequest`
2. Optional: auto-creates `WorkOrder`
3. Writes audit entries:
   - `INTAKE_CREATED_FROM_WEBHOOK`
   - `WORK_ORDER_CREATED_FROM_WEBHOOK` (if enabled)

---

## Quality Flags (to implement next)

Recommended intake quality checks:
- missing phone/email
- missing explicit location
- generic/short service request
- missing vessel name for storage forms

Output can drive:
- `Needs Review` badge
- manager triage queue

---

## Known Open Items

- Need additional edge-case samples for final lock:
  - deposit/partial payment invoice
  - revision/credit invoice
  - malformed/missing-field webhook payload examples
- Need final WordPress webhook sender config from CMS side once approved.
