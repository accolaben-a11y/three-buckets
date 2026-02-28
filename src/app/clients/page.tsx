'use client'
import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Client {
  id: string
  first_name: string
  last_name: string
  age: number
  spouse_age: number | null
  target_retirement_age: number
  state: string
  updated_at: string
  advisor: { full_name: string; email: string }
  scenarios: { name: string }[]
}

export default function ClientsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'updated'>('updated')

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => { setClients(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = clients
    .filter(c => {
      const name = `${c.first_name} ${c.last_name}`.toLowerCase()
      return name.includes(search.toLowerCase())
    })
    .sort((a, b) => {
      if (sortBy === 'name') return `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-3 h-7 rounded-sm bg-green-500" />
            <div className="w-3 h-7 rounded-sm bg-blue-500" />
            <div className="w-3 h-7 rounded-sm bg-red-500" />
          </div>
          <span className="font-bold text-lg">Three Buckets</span>
        </div>
        <div className="flex items-center gap-4">
          {session?.user.role === 'admin' && (
            <Link href="/admin" className="text-slate-300 hover:text-white text-sm">
              Admin Panel
            </Link>
          )}
          <span className="text-slate-400 text-sm">{session?.user.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-slate-400 hover:text-white text-sm"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Your Clients</h1>
            <p className="text-slate-500 text-sm mt-1">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            href="/clients/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Client
          </Link>
        </div>

        {/* Search + Sort */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'name' | 'updated')}
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="updated">Sort: Last Modified</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>

        {/* Client Table */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading clients…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-slate-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-slate-600 font-medium">
              {search ? 'No clients match your search.' : 'No clients yet.'}
            </p>
            {!search && (
              <Link href="/clients/new" className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block">
                Add your first client →
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Age</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Spouse Age</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Retirement Age</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">State</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Scenario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Modified</th>
                  {session?.user.role === 'admin' && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Advisor</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(client => (
                  <tr
                    key={client.id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">
                        {client.first_name} {client.last_name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{client.age}</td>
                    <td className="px-4 py-4 text-slate-600">{client.spouse_age ?? '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{client.target_retirement_age}</td>
                    <td className="px-4 py-4 text-slate-600">{client.state}</td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-slate-600">
                        {client.scenarios[0]?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-sm">
                      {new Date(client.updated_at).toLocaleDateString()}
                    </td>
                    {session?.user.role === 'admin' && (
                      <td className="px-4 py-4 text-slate-500 text-sm">{client.advisor.full_name}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
