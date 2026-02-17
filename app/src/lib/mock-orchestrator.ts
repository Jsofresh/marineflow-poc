export type WorkOrderStage = 'INTAKE' | 'DISPATCH' | 'TIME_TRACKING' | 'INVOICE' | 'COMPLETION'

export type ServiceRequest = {
  id: string
  customerName: string
  phone?: string
  email?: string
  vesselName?: string
  requestType: 'WORK_ORDER' | 'BOAT_LAUNCH'
  serviceRequest: string
  location: string
  createdAt: string
}

export type MockWorkOrder = {
  id: string
  serviceRequestId: string
  requestType: ServiceRequest['requestType']
  customerName: string
  vesselName?: string
  stage: WorkOrderStage
  status: 'NEW' | 'DISPATCHED' | 'IN_PROGRESS' | 'INVOICED' | 'COMPLETED'
  wallaceStatus?: 'QUEUED' | 'ASSIGNED' | 'ERROR'
  clockSharkStatus?: 'NOT_STARTED' | 'RUNNING' | 'COMPLETE'
  quickBooksStatus?: 'PENDING' | 'INVOICED' | 'PAID'
  invoiceId?: string
  createdAt: string
  updatedAt: string
}

type Store = {
  requests: ServiceRequest[]
  workOrders: MockWorkOrder[]
}

declare global {
  var __marineflowMockStore: Store | undefined
}

const store: Store = globalThis.__marineflowMockStore ?? { requests: [], workOrders: [] }
globalThis.__marineflowMockStore = store

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function createServiceRequest(input: Omit<ServiceRequest, 'id' | 'createdAt'>): ServiceRequest {
  const created: ServiceRequest = { id: id('sr'), createdAt: new Date().toISOString(), ...input }
  store.requests.unshift(created)
  return created
}

export function createWorkOrderFromRequest(sr: ServiceRequest): MockWorkOrder {
  const now = new Date().toISOString()
  const wo: MockWorkOrder = {
    id: id('wo'),
    serviceRequestId: sr.id,
    requestType: sr.requestType,
    customerName: sr.customerName,
    vesselName: sr.vesselName,
    stage: 'INTAKE',
    status: 'NEW',
    wallaceStatus: 'QUEUED',
    clockSharkStatus: 'NOT_STARTED',
    quickBooksStatus: 'PENDING',
    createdAt: now,
    updatedAt: now,
  }
  store.workOrders.unshift(wo)
  return wo
}

export function listWorkOrders() {
  return store.workOrders
}

export function getWorkOrder(id: string) {
  return store.workOrders.find((w) => w.id === id)
}

export function dispatchToWallace(id: string) {
  const wo = getWorkOrder(id)
  if (!wo) return null
  if (!(wo.stage === 'INTAKE' || wo.stage === 'DISPATCH')) return wo
  wo.stage = 'DISPATCH'
  wo.status = 'DISPATCHED'
  wo.wallaceStatus = 'ASSIGNED'
  wo.updatedAt = new Date().toISOString()
  return wo
}

export function addClockSharkTime(id: string, hours = 1.5) {
  const wo = getWorkOrder(id)
  if (!wo) return null
  if (!(wo.stage === 'DISPATCH' || wo.stage === 'TIME_TRACKING')) return wo
  wo.stage = 'TIME_TRACKING'
  wo.status = 'IN_PROGRESS'
  wo.clockSharkStatus = hours > 0 ? 'RUNNING' : 'NOT_STARTED'
  wo.updatedAt = new Date().toISOString()
  return wo
}

export function createQuickBooksInvoice(id: string, markPaid = false) {
  const wo = getWorkOrder(id)
  if (!wo) return null

  if (!markPaid) {
    if (!(wo.stage === 'TIME_TRACKING' || wo.stage === 'INVOICE')) return wo
    wo.stage = 'INVOICE'
    wo.status = 'INVOICED'
    wo.invoiceId = wo.invoiceId ?? idFn('inv')
    wo.quickBooksStatus = 'INVOICED'
    wo.updatedAt = new Date().toISOString()
    return wo
  }

  if (!(wo.stage === 'INVOICE' && wo.quickBooksStatus === 'INVOICED')) return wo
  wo.quickBooksStatus = 'PAID'
  wo.stage = 'COMPLETION'
  wo.status = 'COMPLETED'
  wo.clockSharkStatus = 'COMPLETE'
  wo.updatedAt = new Date().toISOString()
  return wo
}

function idFn(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

export function runOrchestrationFromIntake(input: Omit<ServiceRequest, 'id' | 'createdAt'>) {
  const sr = createServiceRequest(input)
  const wo = createWorkOrderFromRequest(sr)
  return { serviceRequest: sr, workOrder: wo }
}
