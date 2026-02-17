import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">MarineFlow (Pilot POC)</h1>
        <p className="text-slate-700">
          Capture customer requests, turn them into work orders, and (mock) sync invoices to QuickBooks.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="rounded border bg-white p-4 hover:bg-slate-100" href="/intake">
            <p className="font-semibold">New service request</p>
            <p className="text-sm text-slate-600">What Jessica uses to capture intake details</p>
          </Link>

          <Link className="rounded border bg-white p-4 hover:bg-slate-100" href="/board">
            <p className="font-semibold">Work order board</p>
            <p className="text-sm text-slate-600">Move work through stages, preview and sync invoices</p>
          </Link>

          <Link className="rounded border bg-white p-4 hover:bg-slate-100" href="/dashboard">
            <p className="font-semibold">Role dashboard</p>
            <p className="text-sm text-slate-600">Quick orientation for Jessica / Manager / CEO</p>
          </Link>

          <Link className="rounded border bg-white p-4 hover:bg-slate-100" href="/wallace-queue">
            <p className="font-semibold">Wallace fallback queue</p>
            <p className="text-sm text-slate-600">Copy/paste details for manual entry if needed</p>
          </Link>

          <Link className="rounded border bg-white p-4 hover:bg-slate-100" href="/wallace-exceptions">
            <p className="font-semibold">Wallace exceptions panel</p>
            <p className="text-sm text-slate-600">Manager actions for PENDING/ERROR Wallace jobs</p>
          </Link>
          <Link className="rounded border bg-white p-4 hover:bg-slate-100" href="/clockshark">
            <p className="font-semibold">ClockShark technician time</p>
            <p className="text-sm text-slate-600">Clocked day totals + Wallace per-job hours</p>
          </Link>


          <Link className="rounded border bg-white p-4 hover:bg-slate-100" href="/poc-integration">
            <p className="font-semibold">Unified integration POC</p>
            <p className="text-sm text-slate-600">Mock WordPress + Wallace + ClockShark + QuickBooks lifecycle</p>
          </Link>
        </div>

        <div className="rounded border bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold mb-1">Quick tip</p>
          <p>
            If invoices can’t sync automatically, use{' '}
            <Link className="underline" href="/wallace-queue">
              Wallace fallback
            </Link>{' '}
            to keep work moving.
          </p>
        </div>
      </div>
    </main>
  )
}
