import Link from 'next/link'

const links = [
  ['New service request', 'What Jessica uses to capture intake details', '/intake'],
  ['Work order board', 'Automation-first pipeline + technician events', '/board'],
  ['Role dashboard', 'Quick orientation for Jessica / Manager / CEO', '/dashboard'],
  ['Wallace fallback queue', 'Manual fallback when integration needs help', '/wallace-queue'],
  ['Wallace exceptions panel', 'Exception-driven manager actions only', '/wallace-exceptions'],
  ['ClockShark technician time', 'Time windows and per-tech rollups', '/clockshark'],
  ['QuickBooks invoice monitor', 'Track paid, waiting, and delinquent invoices', '/quickbooks'],
  ['Unified integration POC', 'WordPress + Wallace + ClockShark + QuickBooks mock flow', '/poc-integration'],
]

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="card-soft p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Coastline Marine Service</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">MarineFlow Operations Console</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Turn customer intake into automated work order execution with Wallace dispatch, ClockShark technician events, and QuickBooks invoicing.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {links.map(([title, desc, href]) => (
            <Link key={href} className="card-soft group p-5 transition hover:-translate-y-0.5 hover:shadow-md" href={href}>
              <p className="font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
              <p className="mt-4 text-xs font-medium text-emerald-700 group-hover:text-emerald-600">Open →</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
