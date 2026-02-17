'use client'

import { useMemo, useState } from 'react'

const SAMPLE_PAYLOAD = {
  Subject: 'General Repair Form',
  'Name of Owner': 'Tucker Beatty',
  Email: 'tucker@neatvc.com',
  Telephone: '781-000-0000',
  'BOAT NAME': 'Two Skip',
  'Mooring/Harbor/Marina Slip': 'Corinthian Yacht Club',
  'General Repairs Need': 'Looking for winterization services.',
  'KEY LOCATION': 'Ignition',
  'Page URL': 'https://clmarinemhd.com/general-repair-form/',
}

export default function WebhookTestPage() {
  const [secret, setSecret] = useState('')
  const [payloadText, setPayloadText] = useState(JSON.stringify(SAMPLE_PAYLOAD, null, 2))
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const prettyHint = useMemo(() => {
    try {
      const parsed = JSON.parse(payloadText)
      return `Valid JSON (${Object.keys(parsed).length} keys)`
    } catch {
      return 'Invalid JSON'
    }
  }, [payloadText])

  async function sendTest() {
    setLoading(true)
    setError('')
    setResult('')

    try {
      const payload = JSON.parse(payloadText)
      const res = await fetch('/api/webhooks/cms-intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'x-cms-webhook-secret': secret } : {}),
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      setResult(JSON.stringify(data, null, 2))

      if (!res.ok) {
        setError(`Request failed (${res.status})`)
      }
    } catch {
      setError('Invalid JSON payload')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-2xl font-bold">Webhook Test Console</h1>
        <p className="text-sm text-slate-600">
          Internal testing tool for CMS intake webhook. Paste incoming form payload JSON, send it to
          <code className="mx-1 rounded bg-slate-200 px-1 py-0.5">/api/webhooks/cms-intake</code>, and inspect response.
        </p>

        <section className="rounded border bg-white p-4 space-y-3">
          <label className="block text-sm font-medium">Webhook Secret (header: x-cms-webhook-secret)</label>
          <input
            type="password"
            className="w-full rounded border px-3 py-2"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Paste CMS_WEBHOOK_SECRET for prod-like test"
          />

          <label className="block text-sm font-medium">Payload JSON</label>
          <textarea
            className="h-72 w-full rounded border p-3 font-mono text-xs"
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
          />
          <p className={`text-xs ${prettyHint.startsWith('Valid') ? 'text-emerald-700' : 'text-rose-700'}`}>{prettyHint}</p>

          <div className="flex gap-2">
            <button
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={loading}
              onClick={sendTest}
            >
              {loading ? 'Sending...' : 'Send Test Webhook'}
            </button>
            <button
              className="rounded border bg-white px-4 py-2 text-sm"
              onClick={() => setPayloadText(JSON.stringify(SAMPLE_PAYLOAD, null, 2))}
            >
              Reset Sample
            </button>
          </div>
        </section>

        {error ? <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

        {result ? (
          <section className="rounded border bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">Response</h2>
            <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{result}</pre>
          </section>
        ) : null}
      </div>
    </main>
  )
}
