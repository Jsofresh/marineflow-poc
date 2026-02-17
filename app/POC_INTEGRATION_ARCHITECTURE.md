# POC Integration Architecture (CMS)

## Goal
Demonstrate that CMS can reduce technical labor by connecting intake, dispatch, time tracking, invoicing, and completion in one workflow.

## Scope for this POC
- Service work order lifecycle:
  1. Intake
  2. Dispatch
  3. Time Tracking
  4. Invoice
  5. Completion
- Boat launch variant:
  - Same lifecycle, different intake type (`BOAT_LAUNCH`) and task language

## Mock Integration Pattern (now implemented)
1. **WordPress Mock Intake API**
   - `POST /api/mock/wordpress/intake`
   - Produces normalized `ServiceRequest` and creates initial `WorkOrder`
2. **Orchestrator API**
   - `GET /api/mock/orchestrator/work-orders`
   - `POST /api/mock/orchestrator/work-orders`
   - Owns state transitions and lifecycle progression
3. **Wallace Mock Adapter**
   - `POST /api/mock/wallace/dispatch`
4. **ClockShark Mock Adapter**
   - `POST /api/mock/clockshark/time-entry`
5. **QuickBooks Mock Adapter**
   - `POST /api/mock/quickbooks/invoice`
6. **Unified Dashboard UI**
   - `/poc-integration`
   - One-screen lifecycle simulation

## Why this matters before real CMS access
- Proves process value without production credentials
- Makes real integration later mostly a connector swap
- Keeps business logic testable now (not blocked on vendor auth)

## Data contracts to stabilize next
- `ServiceRequest`
- `WorkOrder`
- `DispatchUpdate`
- `TimeEntry`
- `InvoiceRecord`

## Decision rule
Any new feature should map to one of these outcomes:
- less duplicate entry for staff
- less handoff confusion between desk/manager/tech
- faster billing completion
- clearer completion status
