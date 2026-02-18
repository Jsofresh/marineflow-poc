# Wallace (Anchorsoft) Integration Research — 2026-02-17

## What we could verify publicly

### Vendor/Product presence
- Wallace Software Solutions (Anchorsoft marine DMS product pages):
  - https://wallacedms.com/
  - https://wallacedms.com/marine/
- Public pages describe marine dealer/marina operations modules but do **not** expose clear public API reference docs.

### Public API docs status
- No definitive official public Wallace API reference discovered during this pass.
- Practical implication: production integration likely requires vendor-guided endpoint access, file exchange format, or custom bridge.

## Related systems we can leverage now
- WordPress official REST API:
  - https://developer.wordpress.org/rest-api/
- WordPress webhook tooling (for intake-to-automation triggers):
  - https://wordpress.org/plugins/wp-webhooks/
  - https://github.com/Ironikus/wp-webhooks
- ClockShark public integration/help surfaces found, but endpoint-level API docs may require authenticated/support context.

## POC strategy (recommended)
1. Keep Wallace integration behind adapter interface.
2. Use a **Wallace Mock API** for demo automation and orchestration testing.
3. Swap adapter internals later once vendor confirms live interface.

## Implemented in this repo
- Added adapter: `src/lib/wallace-adapter.ts`
  - `dispatchToWallaceMock({ workOrderId, packet })`
  - Simulates Wallace acceptance and returns mock external job id.
  - Updates work order state to Wallace confirmed + `PARTS_ORDERED`.
- Added mock API endpoint: `POST /api/mock/wallace/submit`
  - File: `src/app/api/mock/wallace/submit/route.ts`
  - Accepts `workOrderId` (+ optional packet), builds fallback packet, dispatches through adapter.
- `approve-invoice` flow now calls the Wallace adapter for immediate automation progression.

## Open questions for Wallace vendor/Jessica
- Is there an official REST/SOAP/API gateway for Anchorsoft (marine)?
- If yes:
  - auth mechanism (API key/OAuth/IP allowlist)
  - endpoint list and rate limits
  - required payload fields for service/work orders
  - status webhooks/callbacks support
- If no API:
  - best available import/export channel (CSV/SFTP/email parser)
  - polling/export cadence and delivery guarantees
