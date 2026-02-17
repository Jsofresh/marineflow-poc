'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type Result =
  | { kind: 'success'; message: string; intakeId?: string }
  | { kind: 'error'; message: string }

type FormType = 'INDOOR_STORAGE' | 'OUTDOOR_STORAGE' | 'NON_STORAGE' | 'GENERAL_REPAIR'

type IntakeSample = {
  id: string
  formType: FormType
  ownerName: string
  date: string
  email: string
  mailingAddress: string
  phone: string
  locationField: string
  helpfulDetails: string
  keyLocation: string
  boatMake: string
  hullColor: string
  boatName: string
  boatLength: string
  engineBrand: string
  engineHp: string
  serviceWeek?: string
  springServiceWeek?: string
  springDropOffLocation?: string
  winterStorageLocation?: string
  knownRepairs: string
  additionalWork?: string
  commission?: {
    twoYearEngineService?: boolean
    fiveYearEngineService?: boolean
    trailerService?: boolean
    trailerLocation?: string
    interiorDetailing?: boolean
    replaceEngineZincs?: boolean
    fullBoatWash?: boolean
    additionalWashHours?: number
  }
}

const FORM_LABELS: Record<FormType, string> = {
  INDOOR_STORAGE: 'Indoor Storage Form',
  OUTDOOR_STORAGE: 'Outdoor Storage Form',
  NON_STORAGE: 'Non-Storage Form',
  GENERAL_REPAIR: 'General Repair Form',
}

const MOCK_FORMS: IntakeSample[] = [
  {
    id: 'CMS-IND-001',
    formType: 'INDOOR_STORAGE',
    ownerName: 'Emily Carter',
    date: '2026-02-10',
    email: 'emily.carter@example.com',
    mailingAddress: '14 Harbor View Rd, Salem, MA 01970',
    phone: '(978) 555-0131',
    locationField: 'Winter Island mooring #17',
    helpfulDetails: 'Owner requests text confirmation before haul-out. Battery switch currently OFF.',
    keyLocation: 'Hanging in cabin on starboard hook',
    boatMake: 'Boston Whaler',
    hullColor: 'White / Navy',
    boatName: 'Blue Current',
    boatLength: '28 ft',
    engineBrand: 'Mercury',
    engineHp: '300 HP',
    serviceWeek: '2026-10-05',
    springServiceWeek: '2027-04-12',
    springDropOffLocation: 'Salem dock A',
    knownRepairs: 'Port bilge pump intermittent failure',
    additionalWork: 'Install new chartplotter transducer',
    commission: {
      twoYearEngineService: true,
      fiveYearEngineService: false,
      trailerService: false,
      trailerLocation: 'N/A',
      interiorDetailing: true,
      replaceEngineZincs: true,
      fullBoatWash: true,
      additionalWashHours: 1,
    },
  },
  {
    id: 'CMS-IND-002',
    formType: 'INDOOR_STORAGE',
    ownerName: 'Michael Rivera',
    date: '2026-02-12',
    email: 'mrivera@example.com',
    mailingAddress: '88 Bridge St, Gloucester, MA 01930',
    phone: '(978) 555-0194',
    locationField: 'Dock slip C-12',
    helpfulDetails: 'Tender on aft deck must be removed before transport.',
    keyLocation: 'Magnetic key box under helm seat',
    boatMake: 'Sea Ray',
    hullColor: 'White',
    boatName: 'North Wind',
    boatLength: '34 ft',
    engineBrand: 'Yamaha',
    engineHp: '2 x 250 HP',
    serviceWeek: '2026-10-12',
    springServiceWeek: '2027-04-19',
    springDropOffLocation: 'Gloucester ramp',
    knownRepairs: 'Replace trim tab actuator',
    additionalWork: 'Add cockpit LED lighting',
    commission: {
      twoYearEngineService: false,
      fiveYearEngineService: true,
      trailerService: true,
      trailerLocation: 'Back lot row 3',
      interiorDetailing: false,
      replaceEngineZincs: true,
      fullBoatWash: true,
      additionalWashHours: 2,
    },
  },
  {
    id: 'CMS-OUT-001',
    formType: 'OUTDOOR_STORAGE',
    ownerName: 'Rachel Nguyen',
    date: '2026-02-15',
    email: 'rachel.nguyen@example.com',
    mailingAddress: '7 Front St, Salem, MA 01970',
    phone: '(978) 555-0177',
    locationField: 'Dock D-4, Salem Marina',
    helpfulDetails: 'Fuel tank at half, owner wants launch text confirmation.',
    keyLocation: 'Zip-tied key tag under helm cover',
    boatMake: 'Grady-White',
    hullColor: 'White / Blue stripe',
    boatName: 'Tide Runner',
    boatLength: '30 ft',
    engineBrand: 'Yamaha',
    engineHp: '2 x 300 HP',
    serviceWeek: '2026-10-19',
    springServiceWeek: '2027-04-26',
    springDropOffLocation: 'Salem transient dock',
    knownRepairs: 'Starboard trim gauge unreliable',
    additionalWork: 'Add transom flood light + accessory fuse cleanup',
    commission: {
      twoYearEngineService: true,
      fiveYearEngineService: false,
      trailerService: false,
      trailerLocation: 'N/A',
      interiorDetailing: true,
      replaceEngineZincs: true,
      fullBoatWash: true,
      additionalWashHours: 1,
    },
  },
  {
    id: 'CMS-NS-001',
    formType: 'NON_STORAGE',
    ownerName: "Patrick O'Neil",
    date: '2026-02-16',
    email: 'patrick.oneil@example.com',
    mailingAddress: '102 Lighthouse Ln, Gloucester, MA 01930',
    phone: '(978) 555-0221',
    locationField: 'Mooring #22, Gloucester Harbor',
    helpfulDetails: 'Boat stays outside; owner requests full spring systems check before launch.',
    winterStorageLocation: 'Owner yard rack (non-storage)',
    keyLocation: 'Inside cabin drawer, labeled red float keychain',
    boatMake: 'Jeanneau',
    hullColor: 'White',
    boatName: 'North Star',
    boatLength: '36 ft',
    engineBrand: 'Volvo Penta',
    engineHp: '320 HP',
    serviceWeek: '2026-10-26',
    springServiceWeek: '2027-05-03',
    springDropOffLocation: 'Gloucester public ramp',
    knownRepairs: 'Anchor windlass intermittently trips breaker',
    additionalWork: 'Electronics recalibration + VHF antenna check',
    commission: {
      twoYearEngineService: false,
      fiveYearEngineService: true,
      trailerService: true,
      trailerLocation: 'Lot B trailer row',
      interiorDetailing: false,
      replaceEngineZincs: true,
      fullBoatWash: true,
      additionalWashHours: 2,
    },
  },
  {
    id: 'CMS-GEN-001',
    formType: 'GENERAL_REPAIR',
    ownerName: 'Daniel Mercer',
    date: '2026-02-14',
    email: 'dmercer@example.com',
    mailingAddress: '31 Bay St, Marblehead, MA 01945',
    phone: '(978) 555-0204',
    locationField: 'Marblehead Harbor / Slip B-9',
    helpfulDetails: 'Boat is in water; owner available by phone after 4 PM.',
    keyLocation: 'Inside cockpit drawer under throttle',
    boatMake: 'Parker',
    hullColor: 'White / Gray',
    boatName: 'Harbor Run',
    boatLength: '25 ft',
    engineBrand: 'Yamaha 4-stroke',
    engineHp: '250 HP',
    knownRepairs: 'Steering feels loose at speed; inspect helm + cables',
    additionalWork: 'General spring systems check',
  },
]

function toServiceRequestText(sample: IntakeSample) {
  const lines = [
    `${FORM_LABELS[sample.formType]} (${sample.id})`,
    `Owner date: ${sample.date}`,
    `Mailing address: ${sample.mailingAddress}`,
    `Location: ${sample.locationField}`,
    `Helpful details: ${sample.helpfulDetails}`,
    `Key location: ${sample.keyLocation}`,
    `Boat info: ${sample.boatMake}, ${sample.hullColor}, ${sample.boatLength}, engine ${sample.engineBrand} ${sample.engineHp}`,
    `Known repairs: ${sample.knownRepairs}`,
  ]

  if (sample.serviceWeek) lines.push(`Service/haul-out week (Mon): ${sample.serviceWeek}`)
  if (sample.springServiceWeek) lines.push(`Spring service/launch week (Mon): ${sample.springServiceWeek}`)
  if (sample.springDropOffLocation) lines.push(`Spring drop-off location: ${sample.springDropOffLocation}`)
  if (sample.winterStorageLocation) lines.push(`Winter storage location: ${sample.winterStorageLocation}`)
  if (sample.additionalWork) lines.push(`Additional work: ${sample.additionalWork}`)

  if (sample.commission) {
    const c = sample.commission
    lines.push(
      `Commission options: 2yr=${c.twoYearEngineService ? 'YES' : 'NO'}, 5yr=${c.fiveYearEngineService ? 'YES' : 'NO'}, Trailer service=${c.trailerService ? 'YES' : 'NO'} (${c.trailerLocation ?? 'N/A'}), Interior detailing=${c.interiorDetailing ? 'YES' : 'NO'}, Engine zincs=${c.replaceEngineZincs ? 'YES' : 'NO'}, Full boat wash=${c.fullBoatWash ? 'YES' : 'NO'} (+${c.additionalWashHours ?? 0}h)`
    )
  }

  return lines.join('\n')
}

export default function IntakePage() {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [activeFormType, setActiveFormType] = useState<FormType>('INDOOR_STORAGE')

  const visibleSamples = useMemo(
    () => MOCK_FORMS.filter((s) => s.formType === activeFormType),
    [activeFormType]
  )

  async function importSample(sample: IntakeSample) {
    setLoadingId(sample.id)
    setResult(null)

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: sample.ownerName,
          email: sample.email,
          phone: sample.phone,
          vesselName: sample.boatName,
          serviceRequest: toServiceRequestText(sample),
          location: sample.springDropOffLocation || 'Salem',
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.ok) {
        setResult({
          kind: 'success',
          message: `Imported ${sample.id}. Next: create a work order on the Board.`,
          intakeId: data.intake?.id,
        })
      } else {
        setResult({ kind: 'error', message: data?.error ?? `Could not import ${sample.id}.` })
      }
    } catch {
      setResult({ kind: 'error', message: 'Network error. Please try again.' })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Incoming CMS form results (mock)</h1>
            <p className="text-sm text-slate-600">
              This page represents forms customers already submitted on the CMS website.
              Select form type, then import a mock result into intake queue.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="underline">
              Home
            </Link>
            <Link href="/board" className="underline">
              Board
            </Link>
          </div>
        </div>

        <section className="rounded border bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Service forms</p>
          <select
            className="w-full rounded border p-2 text-sm md:max-w-sm"
            value={activeFormType}
            onChange={(e) => setActiveFormType(e.target.value as FormType)}
          >
            <option value="INDOOR_STORAGE">Indoor Storage Form</option>
            <option value="OUTDOOR_STORAGE">Outdoor Storage Form</option>
            <option value="NON_STORAGE">Non-Storage Form</option>
            <option value="GENERAL_REPAIR">General Repair Form</option>
          </select>
        </section>

        {result && (
          <div
            className={`rounded border p-4 text-sm ${
              result.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            <p className="font-semibold">{result.kind === 'success' ? 'Imported' : 'Something went wrong'}</p>
            <p>{result.message}</p>
            {result.kind === 'success' && result.intakeId && (
              <p className="mt-2 text-xs text-emerald-900/80">Request ID: {result.intakeId}</p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {visibleSamples.length === 0 ? (
            <section className="rounded border bg-white p-4 text-sm text-slate-600">
              No mock examples loaded yet for this form type.
            </section>
          ) : (
            visibleSamples.map((sample) => (
              <section key={sample.id} className="rounded border bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{sample.id}</p>
                    <h2 className="text-lg font-semibold">{sample.ownerName} — {sample.boatName}</h2>
                    <p className="text-sm text-slate-600">{FORM_LABELS[sample.formType]} · Submitted {sample.date}</p>
                  </div>
                  <button
                    disabled={loadingId === sample.id}
                    onClick={() => importSample(sample)}
                    className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {loadingId === sample.id ? 'Importing…' : 'Import to intake queue'}
                  </button>
                </div>

                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p><span className="font-medium">Email:</span> {sample.email}</p>
                  <p><span className="font-medium">Phone:</span> {sample.phone}</p>
                  <p><span className="font-medium">Mailing address:</span> {sample.mailingAddress}</p>
                  <p><span className="font-medium">Location:</span> {sample.locationField}</p>
                {sample.winterStorageLocation && <p><span className="font-medium">Winter storage:</span> {sample.winterStorageLocation}</p>}
                  <p><span className="font-medium">Key location:</span> {sample.keyLocation}</p>
                  <p><span className="font-medium">Boat info:</span> {sample.boatMake} · {sample.hullColor} · {sample.boatLength}</p>
                  <p><span className="font-medium">Engine:</span> {sample.engineBrand} ({sample.engineHp})</p>
                </div>

                <div className="mt-3 rounded border bg-slate-50 p-3 text-sm">
                  <p><span className="font-medium">Known repairs:</span> {sample.knownRepairs}</p>
                  {sample.additionalWork && <p><span className="font-medium">Additional work:</span> {sample.additionalWork}</p>}
                  <p><span className="font-medium">Helpful details:</span> {sample.helpfulDetails}</p>
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
