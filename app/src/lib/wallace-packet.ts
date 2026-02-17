type WallaceInput = {
  workOrderId: string
  customerName: string
  location: string
  vesselName: string | null
  email: string | null
  phone: string | null
  serviceRequest: string
  source?: string
}

export function buildWallacePacket(input: WallaceInput) {
  const lines = [
    '=== WALLACE HANDOFF PACKET ===',
    `WORK ORDER ID (MarineFlow): ${input.workOrderId}`,
    `CUSTOMER: ${input.customerName}`,
    `LOCATION: ${input.location}`,
    `VESSEL: ${input.vesselName ?? 'N/A'}`,
    `EMAIL: ${input.email ?? 'N/A'}`,
    `PHONE: ${input.phone ?? 'N/A'}`,
    `REQUEST: ${input.serviceRequest}`,
    `SOURCE: ${input.source ?? 'MarineFlow'}`,
    `GENERATED_AT: ${new Date().toISOString()}`,
    '==============================',
  ]

  return lines.join('\n')
}
