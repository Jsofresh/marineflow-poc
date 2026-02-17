export default function PilotChecklistPage() {
  const checks = [
    'Create 3 new intake requests from /intake',
    'Convert all unassigned intakes into work orders from /board',
    'Move one work order through full pipeline to COMPLETE',
    'Confirm auto QB sync behavior on COMPLETE',
    'If QB sync fails, confirm RETRY_PENDING + Retry button works',
    'Open QB Preview and verify customer + line items make sense',
    'Export CSV and verify rows include latest work orders',
    'Open timeline for one order and verify action history',
  ]

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-3xl rounded border bg-white p-6 space-y-4">
        <h1 className="text-2xl font-bold">CMS Pilot Acceptance Checklist</h1>
        <p className="text-sm text-slate-600">Run this end-to-end before demoing to stakeholders.</p>
        <ul className="list-decimal ml-6 space-y-2">
          {checks.map((c) => (
            <li key={c} className="text-sm">{c}</li>
          ))}
        </ul>
      </div>
    </main>
  )
}
