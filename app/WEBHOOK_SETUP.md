# CMS Webhook Intake Setup (Staff-only MarineFlow)

## Endpoint
`POST /api/webhooks/cms-intake`

Production URL:
`https://poc.stanley-systems.com/api/webhooks/cms-intake`

## Auth (required)
Set `CMS_WEBHOOK_SECRET` in `.env` and send one of:
- `x-cms-webhook-secret: <secret>`
- `x-webhook-secret: <secret>`
- `Authorization: Bearer <secret>`

If `CMS_WEBHOOK_SECRET` is empty, auth is bypassed (not recommended).

## Behavior
- Maps incoming CMS website form payload into MarineFlow intake fields.
- Creates `IntakeRequest`.
- If `CMS_WEBHOOK_AUTO_CREATE_WORK_ORDER=true`, also auto-creates a `WorkOrder`.
- Writes audit logs with source metadata (`INTAKE_CREATED_FROM_WEBHOOK`, optionally `WORK_ORDER_CREATED_FROM_WEBHOOK`).

## Env vars
Add to `.env`:

```bash
CMS_WEBHOOK_SECRET=change-me-very-long-random-string
CMS_WEBHOOK_AUTO_CREATE_WORK_ORDER=true
```

## Smoke test (local)

```bash
curl -X POST http://127.0.0.1:3000/api/webhooks/cms-intake \
  -H 'Content-Type: application/json' \
  -H 'x-cms-webhook-secret: change-me-very-long-random-string' \
  -d '{
    "Subject": "General Repair Form",
    "Name of Owner": "Tucker Beatty",
    "Email": "tucker@neatvc.com",
    "Telephone": "781-000-0000",
    "BOAT NAME": "Two Skip",
    "Mooring/Harbor/Marina Slip": "Corinthian Yacht Club",
    "General Repairs Need": "Looking for winterization services.",
    "KEY LOCATION": "Ignition",
    "Page URL": "https://clmarinemhd.com/general-repair-form/"
  }'
```

Expected response: `201` with `intakeId` and (if enabled) `workOrderId`.
