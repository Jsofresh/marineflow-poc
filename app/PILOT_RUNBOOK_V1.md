# MarineFlow Pilot Runbook v1 (Day‑1)

Audience: Jessica → Service Manager → CEO → Techs

Scope: This runbook is for the **pilot day**. It focuses on the minimum steps to run the workflow, validate outcomes, and recover quickly if something breaks.

---

## 0) One‑minute orientation (what this POC does)

MarineFlow is a lightweight flow:

1. **Intake**: capture customer request details
2. **Work order**: create + move through stages on the Board
3. **Billing sync**: attempt **(mock)** QuickBooks invoice sync
4. **Fallback**: if systems are down, use **Wallace fallback** to copy/paste details for manual entry

Key pages:

- Home: `/`
- Intake: `/intake`
- Board: `/board`
- Manager retry queue: `/manager`
- CEO snapshot: `/ceo`
- Wallace fallback queue: `/wallace-queue`
- Health check: `/api/health`

---

## 1) Day‑1 checklist (start of day)

### A. Confirm the app is up (5 minutes)

1. Open **Health check** in a browser:
   - `https://<your-host>/api/health`
   - Expected: JSON with `ok: true` and `db: ok`
2. Open Home page and click into:
   - Intake
   - Board
   - CEO snapshot

If health fails, jump to **Troubleshooting → Health check / restart**.

### B. Quick “happy path” validation (10 minutes)

1. Create a test request in **Intake** (use clearly fake data).
2. On **Board**, confirm the request appears under **Unassigned requests**.
3. Click **Create work order**.
4. Drag the new work order from **NEW → IN_PROGRESS → COMPLETE**.
5. Click **Sync to QB**:
   - Success: work order moves to **INVOICED** and shows an invoice ID
   - Failure: you’ll see an error and the work order becomes retry‑eligible

Optional: If you need to prove the manual path, use **Wallace fallback**.

---

## 2) Role playbook (what each person does)

## Jessica (Intake)

Goal: capture clean requests and ensure they become work orders.

**Step‑by‑step**

1. Go to **/intake**
2. Fill in:
   - Customer name (required)
   - Request description (required)
   - Contact info if available
   - Location
3. Click **Save request**
4. After the success message:
   - Click **Board** and ensure it’s converted into a work order

**If something looks wrong**

- If you saved a request but it doesn’t appear on the Board:
  - Refresh the Board page
  - Check `/api/health`
  - Escalate to Service Manager / Tech

---

## Service Manager (Work execution + billing)

Goal: keep work moving and keep billing clean.

**Daily routine**

1. Start on the **Board** (`/board`)
2. Convert any **Unassigned requests** into work orders
3. Move cards through stages by dragging
4. Check the **Manager retry queue** (`/manager`) and retry billing sync items
5. If automation is down, use **Wallace fallback** (`/wallace-queue`) so work doesn’t stall

**What to watch**

- Work orders stuck in the same stage too long
- Rising retry counts / repeated QuickBooks sync failures
- Anything requiring manual Wallace entry piling up

---

## CEO (Read‑only pilot health)

Goal: see if the pilot is healthy without digging into details.

1. Open **/ceo**
2. Look for:
   - **Invoiced** trending up
   - **Needs retry** staying low
   - **Stuck > 24h** near zero

---

## Techs (work updates)

Goal: keep status current so handoffs and billing happen.

1. Open **/board**
2. Find your work order
3. Drag it to the correct stage as work progresses
4. Add notes to the request text elsewhere (this POC does not include a tech notes field yet)

---

## 3) Wallace fallback (manual entry) — when to use it

Use **/wallace-queue** when:

- Wallace integration is not available
- A QuickBooks sync is repeatedly failing and you need to keep moving
- You need a simple “copy/paste packet” for manual entry

**Step‑by‑step**

1. In Step 1, **Create work order** (if needed)
2. In Step 2:
   - Click **Copy summary**
   - Paste into Wallace
   - Save in Wallace
   - Click **Mark entered**

Expected result: the work order disappears from the Wallace queue.

---

## 4) Troubleshooting

### A) Health check fails

1. Check the endpoint:

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

2. If it fails, check service status:

```bash
sudo systemctl status marineflow --no-pager
```

3. Restart the app:

```bash
sudo systemctl restart marineflow
sudo systemctl status marineflow --no-pager
```

4. Re‑check health:

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

If the reverse proxy is involved, also check:

```bash
sudo systemctl status caddy --no-pager
sudo systemctl restart caddy
```

### B) Something looks stuck / UI not updating

- Refresh the page
- Confirm `/api/health` is OK
- Check for errors in logs:

```bash
journalctl -u marineflow -n 200 --no-pager
```

### C) QuickBooks sync keeps failing

Notes:

- In this POC, QuickBooks sync is **mocked** and may fail intermittently by design.
- The intended manager behavior is:
  1) retry from `/manager` or the card button
  2) if needed, use `/wallace-queue` to continue manually

### D) Export data for debugging / audit

- Work order export CSV: `/api/work-orders/export.csv`
- Wallace queue export CSV: `/api/wallace/queue.csv`

---

## 5) Day‑end closeout (5 minutes)

1. Check `/ceo` snapshot for:
   - retries
   - stuck items
2. If retries exist:
   - note which IDs are failing
   - (optional) retry once from `/manager`
3. If Wallace queue has items:
   - ensure they are either entered into Wallace or explicitly deferred

---

## Appendix: “What to tell people” scripts

- Jessica: “If you see a green success message on Intake, your request is saved. Next step is creating the work order on the Board.”
- Manager: “If billing sync fails, it’s not a blocker. Retry once, then use Wallace fallback if needed.”
- CEO: “Invoiced up, retries and stuck down = healthy pilot.”
