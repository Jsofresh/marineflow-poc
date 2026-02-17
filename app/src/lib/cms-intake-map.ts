type UnknownRecord = Record<string, unknown>

export type NormalizedIntake = {
  customerName: string
  email: string | null
  phone: string | null
  vesselName: string | null
  serviceRequest: string
  location: string
  formType: 'GENERAL_REPAIR' | 'NON_STORAGE' | 'OUTDOOR_STORAGE' | 'UNKNOWN'
  sourceUrl: string | null
  receivedAt: string
  raw: unknown
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function asObject(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {}
}

function valueToString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s.length ? s : null
}

function pick(raw: UnknownRecord, aliases: string[]): string | null {
  const keyed = new Map<string, unknown>()

  for (const [k, v] of Object.entries(raw)) {
    keyed.set(normalizeKey(k), v)
  }

  for (const alias of aliases) {
    const found = keyed.get(normalizeKey(alias))
    const asText = valueToString(found)
    if (asText) return asText
  }

  return null
}

function detectFormType(raw: UnknownRecord): NormalizedIntake['formType'] {
  const pageUrl = pick(raw, ['Page URL', 'page_url', 'pageUrl'])?.toLowerCase() ?? ''
  const subject = pick(raw, ['Subject', 'subject'])?.toLowerCase() ?? ''

  if (pageUrl.includes('general-repair-form') || subject.includes('general repair')) return 'GENERAL_REPAIR'
  if (pageUrl.includes('non-storage-form') || subject.includes('non-storage')) return 'NON_STORAGE'
  if (pageUrl.includes('outdoor-storage') || subject.includes('outdoor storage')) return 'OUTDOOR_STORAGE'

  return 'UNKNOWN'
}

export function mapCmsWebhookToIntake(payload: unknown): NormalizedIntake {
  const root = asObject(payload)
  const maybeData = asObject(root.data)
  const maybeForm = asObject(root.form)
  const merged: UnknownRecord = { ...root, ...maybeData, ...maybeForm }

  const formType = detectFormType(merged)

  const customerName =
    pick(merged, ['Name of Owner', 'customerName', 'ownerName', 'name']) ?? 'Unknown Customer'

  const email = pick(merged, ['Email', 'email'])
  const phone = pick(merged, ['Telephone', 'phone'])
  const vesselName = pick(merged, ['BOAT NAME', 'vesselName', 'boatName'])

  const location =
    pick(merged, [
      'Boat Located for FALL PICK-UP',
      'Mooring/Harbor/Marina Slip',
      'Spring Drop off Location',
      'location',
      'Mailing Address',
    ]) ?? 'Unspecified'

  const knownRepairs = pick(merged, ['General Repairs Need', 'Known boat repairs needed'])
  const additionalWork = pick(merged, ['Additional work requested', 'Additional work'])
  const keyLocation = pick(merged, ['KEY LOCATION'])

  const serviceLines = [
    knownRepairs ? `Repairs: ${knownRepairs}` : null,
    additionalWork ? `Additional work: ${additionalWork}` : null,
    keyLocation ? `Key location: ${keyLocation}` : null,
  ].filter(Boolean)

  const serviceRequest = serviceLines.length
    ? serviceLines.join(' | ')
    : pick(merged, ['serviceRequest', 'request', 'notes']) ?? 'New customer request from CMS website form.'

  return {
    customerName,
    email,
    phone,
    vesselName,
    serviceRequest,
    location,
    formType,
    sourceUrl: pick(merged, ['Page URL', 'page_url', 'pageUrl']),
    receivedAt: new Date().toISOString(),
    raw: payload,
  }
}
