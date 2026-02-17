type IntakeLike = {
  customerName: string
  email: string | null
  phone: string | null
  vesselName: string | null
  serviceRequest: string
  location: string
}

type WorkOrderLike = {
  id: string
  status: string
  completedAt: Date | null
}

export type QbInvoicePayload = {
  DocNumber: string
  CustomerRef: {
    name: string
  }
  CustomerMemo: {
    value: string
  }
  BillEmail?: {
    Address: string
  }
  PrivateNote: string
  TxnDate: string
  Line: Array<{
    Amount: number
    DetailType: 'SalesItemLineDetail'
    Description: string
    SalesItemLineDetail: {
      ItemRef: { name: string }
      Qty?: number
      UnitPrice?: number
    }
  }>
}

function estimateLaborHours(serviceRequest: string) {
  const t = serviceRequest.toLowerCase()
  if (t.includes('engine') || t.includes('outboard')) return 3.5
  if (t.includes('electrical') || t.includes('wiring')) return 2.5
  if (t.includes('steering')) return 2
  if (t.includes('pump')) return 1.5
  return 2
}

function estimateLaborRate(location: string) {
  if (location === 'Marblehead') return 165
  if (location === 'Gloucester') return 155
  return 150
}

function estimateParts(serviceRequest: string) {
  const t = serviceRequest.toLowerCase()
  if (t.includes('pump')) return { label: 'Bilge Pump Kit', amount: 140 }
  if (t.includes('steering')) return { label: 'Steering Cable + Hardware', amount: 220 }
  if (t.includes('outboard') || t.includes('engine')) return { label: 'Tune-Up Parts Bundle', amount: 180 }
  return { label: 'General Marine Parts', amount: 95 }
}

export function buildQbInvoicePayload(workOrder: WorkOrderLike, intake: IntakeLike): QbInvoicePayload {
  const laborHours = estimateLaborHours(intake.serviceRequest)
  const laborRate = estimateLaborRate(intake.location)
  const parts = estimateParts(intake.serviceRequest)

  const laborAmount = Number((laborHours * laborRate).toFixed(2))
  const txnDate = new Date().toISOString().slice(0, 10)

  const lines: QbInvoicePayload['Line'] = [
    {
      Amount: laborAmount,
      DetailType: 'SalesItemLineDetail',
      Description: `Labor for WO ${workOrder.id}`,
      SalesItemLineDetail: {
        ItemRef: { name: 'Labor' },
        Qty: laborHours,
        UnitPrice: laborRate,
      },
    },
    {
      Amount: parts.amount,
      DetailType: 'SalesItemLineDetail',
      Description: `Parts: ${parts.label}`,
      SalesItemLineDetail: {
        ItemRef: { name: 'Parts' },
        Qty: 1,
        UnitPrice: parts.amount,
      },
    },
  ]

  const payload: QbInvoicePayload = {
    DocNumber: `WO-${workOrder.id.slice(-6).toUpperCase()}`,
    CustomerRef: { name: intake.customerName },
    CustomerMemo: {
      value: `${intake.vesselName ?? 'Vessel'} · ${intake.location} · ${intake.serviceRequest}`,
    },
    PrivateNote: `MarineFlow POC mock invoice for work order ${workOrder.id}`,
    TxnDate: txnDate,
    Line: lines,
  }

  if (intake.email) {
    payload.BillEmail = { Address: intake.email }
  }

  return payload
}
