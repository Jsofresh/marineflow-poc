# NO_PRODUCTION_WRITE_MODE.md

Use this checklist before connecting any external credentials (Wallace, QuickBooks, ClockShark, WordPress).

## Goal
Run MarineFlow POC safely in the background without changing live CMS production workflows.

---

## 1) Global safety posture
- [ ] Keep all external integrations in **read/test mode** by default.
- [ ] Do **not** enable any production write action without explicit owner approval (Jaden).
- [ ] Keep all generated records tagged as test.

---

## 2) Required environment flags
Set these in `.env` before credential wiring:

```bash
INTEGRATIONS_MODE=background-safe
POC_TEST_PREFIX=[POC TEST]

# Webhook intake control
PROD_WEBHOOK_ACCEPT=false
CMS_WEBHOOK_SECRET=<set but do not share externally yet>
CMS_WEBHOOK_AUTO_CREATE_WORK_ORDER=true

# Wallace controls
WALLACE_WRITE_ENABLED=false
WALLACE_MODE=prepare_only

# QuickBooks controls
QB_WRITE_ENABLED=false
QB_MODE=mock

# ClockShark controls
CLOCKSHARK_WRITE_ENABLED=false
CLOCKSHARK_MODE=read_only

# Notifications
AUTO_NOTIFY_MANAGERS=false
AUTO_NOTIFY_CEO=false
NOTIFY_TARGET=JADEN_ONLY
```

---

## 3) Data isolation rules
- [ ] Prefix all test-created customers/work-orders/invoice memos with `POC_TEST_PREFIX`.
- [ ] Keep test queues separate from future live queues where possible.
- [ ] Never import historical production records into write-enabled pipelines during POC.

---

## 4) Integration-by-integration safety checks

### WordPress / CMS website intake
- [ ] Use a test endpoint or test secret first.
- [ ] Validate payload mapping with `/webhook-test` and sample payloads.
- [ ] Confirm no customer-facing CMS page behavior changes.

### Wallace
- [ ] Use handoff packet / export flow only.
- [ ] No live create/update calls until explicit sign-off.

### QuickBooks
- [ ] Keep sync mocked or sandboxed.
- [ ] Verify invoice payload preview only (`qb-preview`) until approved.

### ClockShark
- [ ] Read-only token/scope.
- [ ] Validate time mapping without writing to external systems.

---

## 5) Approval gate to exit safe mode
All must be true before enabling writes:
- [ ] Jaden explicit approval in-thread
- [ ] At least 3 successful end-to-end POC test runs
- [ ] Exception/retry handling confirmed
- [ ] Rollback plan documented
- [ ] CEO pitch checkpoint complete

Then switch flags deliberately (one system at a time):
- Wallace write
- QuickBooks write
- ClockShark write (if applicable)

---

## 6) Rollback switch (immediate)
If anything behaves unexpectedly:
- Set all write flags to false
- Restart services
- Route all updates to Jaden-only notifications

```bash
WALLACE_WRITE_ENABLED=false
QB_WRITE_ENABLED=false
CLOCKSHARK_WRITE_ENABLED=false
AUTO_NOTIFY_MANAGERS=false
AUTO_NOTIFY_CEO=false
NOTIFY_TARGET=JADEN_ONLY
```

---

## 7) Daily operator check (while in safe mode)
- [ ] `/api/health` is green
- [ ] New intake mapping quality acceptable
- [ ] Retry queues are visible and understandable
- [ ] No production side effects observed
