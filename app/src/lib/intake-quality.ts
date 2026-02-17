export type IntakeLike = {
  customerName: string
  email: string | null
  phone: string | null
  vesselName: string | null
  serviceRequest: string
  location: string
}

export function getIntakeQuality(input: IntakeLike) {
  const missing: string[] = []
  const warnings: string[] = []

  if (!input.email) missing.push('email')
  if (!input.phone) missing.push('phone')
  if (!input.vesselName) missing.push('vesselName')
  if (!input.location || input.location === 'Unspecified') missing.push('location')

  const serviceText = (input.serviceRequest ?? '').trim()
  if (!serviceText || serviceText.length < 24) {
    warnings.push('service_request_too_short')
  }
  if (/new customer request from cms website form\.?/i.test(serviceText)) {
    warnings.push('generic_service_request')
  }

  const baseChecks = 4
  const score = Math.max(0, Math.round(((baseChecks - missing.length) / baseChecks) * 100))
  const needsReview = score < 75 || warnings.length > 0

  return { score, missing, warnings, needsReview }
}
