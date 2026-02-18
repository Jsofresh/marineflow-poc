# Webhook Debugging / Replay Runbook (Svix → MarineFlow)

Use this runbook to inspect, resend, and verify CMS webhook deliveries into MarineFlow.

---

## 1) Current production-like endpoint

- MarineFlow webhook URL:
  - `https://poc.stanley-systems.com/api/webhooks/cms-intake`

- Required header:
  - `x-cms-webhook-secret: <CMS_WEBHOOK_SECRET>`

- Current Svix test source ingest URL:
  - `https://api.us.svix.com/ingest/api/v1/source/src_32TphglQnxqB6ZHi2sd80/in/76tJeXAcM5yjFmw84famOI`

> If this source changes, update the URL above.

---

## 2) Send a test event (manual replay command)

```bash
curl -X POST 'https://api.us.svix.com/ingest/api/v1/source/src_32TphglQnxqB6ZHi2sd80/in/76tJeXAcM5yjFmw84famOI' \
  -H 'Content-Type: application/json' \
  -d '{
    "customerName":"Svix Test Customer",
    "email":"svix-test@example.com",
    "phone":"978-555-0101",
    "vesselName":"Test Vessel 28",
    "serviceRequest":"Engine diagnostics and spring prep",
    "location":"Salem",
    "formType":"GENERAL_REPAIR",
    "sourceUrl":"https://coastlinemarineservice.com/forms/general-repair"
  }'
```

---

## 3) Inspect in Svix dashboard

1. Open Svix source → **Destinations**
2. Open endpoint `https://poc.stanley-systems.com/api/webhooks/cms-intake`
3. Check **Message Attempts**:
   - Expect status `Succeeded` / 2xx
4. For failures:
   - Open failed attempt details
   - Inspect response code/body
   - Fix config/code
   - Re-run command in section 2

---

## 4) Verify in MarineFlow

After successful Svix delivery, confirm in app:

- Intake queue page: `https://poc.stanley-systems.com/intake`
- Work board: `https://poc.stanley-systems.com/board`
- Health check: `https://poc.stanley-systems.com/api/health`

Expected:
- New intake appears
- Work order can be created/advanced normally

---

## 5) Common failure patterns

### 401 Unauthorized
- Cause: wrong/missing `x-cms-webhook-secret`
- Fix: update endpoint header in Svix to match `CMS_WEBHOOK_SECRET`

### 400 Invalid payload
- Cause: malformed JSON or missing required fields
- Fix: resend using payload template from section 2

### 5xx from MarineFlow
- Cause: app/runtime issue
- Fix:
  1. Check service health `/api/health`
  2. Check deploy/runtime logs
  3. Retry webhook after fix

---

## 6) Optional: getting secret on VPS (operator only)

```bash
grep CMS_WEBHOOK_SECRET /home/jaden/.openclaw/workspace/marineflow-poc/app/.env
```

Copy only the value (right side of `=`) into Svix endpoint header.

---

## 7) Security notes

- Keep source ingest URLs private.
- Never paste real secrets into chat logs/screenshots.
- Rotate `CMS_WEBHOOK_SECRET` if it is exposed.
