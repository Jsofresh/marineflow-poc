'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type IntakeFields = {
  customerName: string
  email: string
  phone: string
  vesselName: string
  location: string
  serviceRequest: string
}

export default function EditIntakePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [fields, setFields] = useState<IntakeFields>({
    customerName: '',
    email: '',
    phone: '',
    vesselName: '',
    location: '',
    serviceRequest: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/intake/list`)
        const data = await res.json()
        const intake = (data.intakes ?? []).find((i: { id: string }) => i.id === id)
        if (!intake) { setError('Intake not found'); setLoading(false); return }
        setFields({
          customerName: intake.customerName ?? '',
          email: intake.email ?? '',
          phone: intake.phone ?? '',
          vesselName: intake.vesselName ?? '',
          location: intake.location ?? '',
          serviceRequest: intake.serviceRequest ?? '',
        })
      } catch {
        setError('Failed to load intake')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/intake/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSuccess(true)
        setTimeout(() => router.push('/board'), 1200)
      } else {
        setError(data.error ?? 'Failed to save')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function set(key: keyof IntakeFields, value: string) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-2xl">
          <div className="card-soft p-6 text-sm text-slate-500">Loading intake…</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="card-soft flex items-center justify-between gap-3 p-5">
          <div>
            <h1 className="text-2xl font-bold">Edit intake request</h1>
            <p className="text-xs text-slate-500 mt-0.5">ID: {id}</p>
          </div>
          <Link href="/board" className="text-sm text-slate-500 underline hover:text-slate-700">
            ← Back to board
          </Link>
        </div>

        {error && (
          <div className="card-soft border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="card-soft border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 font-medium">
            ✓ Saved — returning to board…
          </div>
        )}

        <form onSubmit={handleSave} className="card-soft space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer name</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                value={fields.customerName}
                onChange={(e) => set('customerName', e.target.value)}
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vessel name</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                value={fields.vesselName}
                onChange={(e) => set('vesselName', e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
              <input
                type="email"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                value={fields.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                value={fields.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                value={fields.location}
                onChange={(e) => set('location', e.target.value)}
                required
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service request</span>
            <textarea
              rows={8}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={fields.serviceRequest}
              onChange={(e) => set('serviceRequest', e.target.value)}
              required
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-1">
            <Link
              href="/board"
              className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
