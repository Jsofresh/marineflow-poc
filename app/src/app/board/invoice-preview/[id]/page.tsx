import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { buildQbInvoicePayload } from '@/lib/qb-map'

export default async function InvoicePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const order = await prisma.workOrder.findUnique({
    where: { id },
    include: { intakeRequest: true },
  })

  const payload = order ? buildQbInvoicePayload(order, order.intakeRequest) : null

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="card-soft p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">QuickBooks Preview</p>
            <h1 className="text-2xl font-bold">Work Order {id}</h1>
          </div>
          <Link href="/board" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700">
            Back to board
          </Link>
        </div>

        {!order || !payload ? (
          <div className="card-soft p-4 text-sm text-rose-700">Preview unavailable</div>
        ) : (
          <div className="card-soft p-4 text-sm space-y-2">
            <p><b>Doc:</b> {payload.DocNumber}</p>
            <p><b>Customer:</b> {payload.CustomerRef.name}</p>
            <p><b>Email:</b> {payload.BillEmail?.Address ?? 'N/A'}</p>
            <p><b>Date:</b> {payload.TxnDate}</p>
            <p><b>Memo:</b> {payload.CustomerMemo.value}</p>
            <p><b>Note:</b> {payload.PrivateNote}</p>
            <p><b>Boat:</b> {order.intakeRequest.vesselName ?? 'Unknown vessel'}</p>
            <p className="whitespace-pre-wrap"><b>Full request:</b> {order.intakeRequest.serviceRequest}</p>

            <div className="pt-2">
              <p className="font-semibold">Invoice lines</p>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                {payload.Line.map((line, idx) => (
                  <li key={idx}>{line.Description} — ${line.Amount}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
