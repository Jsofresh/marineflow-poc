import Link from 'next/link'
import {
  FilePlus2,
  KanbanSquare,
  ClipboardList,
  Clock3,
  ReceiptText,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

type HomeLink = {
  title: string
  desc: string
  href: string
  icon: LucideIcon
}

const links: HomeLink[] = [
  { title: 'New service request', desc: 'What Jessica uses to capture intake details', href: '/intake', icon: FilePlus2 },
  { title: 'Work order board', desc: 'Automation-first pipeline + technician events', href: '/board', icon: KanbanSquare },
  { title: 'Wallace fallback queue', desc: 'Manual fallback when integration needs help', href: '/wallace-queue', icon: ClipboardList },
  { title: 'ClockShark technician time', desc: 'Time windows and per-tech rollups', href: '/clockshark', icon: Clock3 },
  { title: 'QuickBooks invoice monitor', desc: 'Track paid, waiting, and delinquent invoices', href: '/quickbooks', icon: ReceiptText },
  { title: 'Unified integration POC', desc: 'WordPress + Wallace + ClockShark + QuickBooks mock flow', href: '/poc-integration', icon: Workflow },
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
          {links.map(({ title, desc, href, icon: Icon }) => (
            <Link key={href} className="card-soft group p-5 transition hover:-translate-y-0.5 hover:shadow-md" href={href}>
              <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-white p-2 text-slate-700">
                <Icon size={18} strokeWidth={2} />
              </div>
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
