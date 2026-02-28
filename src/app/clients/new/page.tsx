'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]

export default function NewClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    age: '62',
    marital_status: 'married',
    spouse_name: '',
    spouse_age: '',
    state: 'FL',
    target_retirement_age: '62',
    planning_horizon_age: '90',
    model_survivor: false,
    survivor_spouse: 'primary',
    survivor_event_age: '',
  })

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      age: parseInt(form.age),
      marital_status: form.marital_status,
      spouse_name: form.marital_status !== 'single' ? form.spouse_name : null,
      spouse_age: form.marital_status !== 'single' && form.spouse_age ? parseInt(form.spouse_age) : null,
      state: form.state,
      target_retirement_age: parseInt(form.target_retirement_age),
      planning_horizon_age: parseInt(form.planning_horizon_age),
      model_survivor: form.model_survivor,
      survivor_spouse: form.model_survivor ? form.survivor_spouse : null,
      survivor_event_age: form.model_survivor && form.survivor_event_age ? parseInt(form.survivor_event_age) : null,
    }

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(JSON.stringify(data.error))
      return
    }

    const client = await res.json()
    router.push(`/clients/${client.id}`)
  }

  const isMarried = form.marital_status !== 'single'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center gap-4">
        <div className="flex gap-1">
          <div className="w-3 h-7 rounded-sm bg-green-500" />
          <div className="w-3 h-7 rounded-sm bg-blue-500" />
          <div className="w-3 h-7 rounded-sm bg-red-500" />
        </div>
        <Link href="/clients" className="text-slate-400 hover:text-white text-sm">← Back to Clients</Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">New Client</h1>
        <p className="text-slate-500 mb-8">Enter client information to begin building their retirement cash flow plan.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-800">Client Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={form.first_name}
                  onChange={e => set('first_name', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={form.last_name}
                  onChange={e => set('last_name', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Age *</label>
                <input
                  type="number"
                  required
                  min={18}
                  max={110}
                  value={form.age}
                  onChange={e => set('age', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State *</label>
                <select
                  value={form.state}
                  onChange={e => set('state', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marital Status *</label>
                <select
                  value={form.marital_status}
                  onChange={e => set('marital_status', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="partnered">Partnered</option>
                </select>
              </div>
            </div>
          </div>

          {/* Spouse */}
          {isMarried && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-slate-800">Spouse / Partner</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Spouse/Partner Name *</label>
                  <input
                    type="text"
                    required={isMarried}
                    value={form.spouse_name}
                    onChange={e => set('spouse_name', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Spouse/Partner Age *</label>
                  <input
                    type="number"
                    required={isMarried}
                    min={18}
                    max={110}
                    value={form.spouse_age}
                    onChange={e => set('spouse_age', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Planning Assumptions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-800">Planning Assumptions</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Retirement Age</label>
                <input
                  type="number"
                  min={55}
                  max={75}
                  value={form.target_retirement_age}
                  onChange={e => set('target_retirement_age', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Planning Horizon Age</label>
                <input
                  type="number"
                  min={75}
                  max={110}
                  value={form.planning_horizon_age}
                  onChange={e => set('planning_horizon_age', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Survivor Scenario */}
          {isMarried && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">Survivor Scenario</h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.model_survivor}
                    onChange={e => set('model_survivor', e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">Model survivor scenario</span>
                </label>
              </div>

              {form.model_survivor && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Who predeceases?</label>
                    <select
                      value={form.survivor_spouse}
                      onChange={e => set('survivor_spouse', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="primary">Primary Borrower</option>
                      <option value="spouse">Spouse / Partner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Survivor event at age</label>
                    <input
                      type="number"
                      min={62}
                      max={110}
                      value={form.survivor_event_age}
                      onChange={e => set('survivor_event_age', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 78"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/clients"
              className="flex-1 text-center px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Creating…' : 'Create Client & Continue →'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
