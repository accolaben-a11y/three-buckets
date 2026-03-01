'use client'
import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'

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

function DeleteClientModal({ client, onClose, onDeleted }: {
  client: Client
  onClose: () => void
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    if (res.ok) {
      onDeleted(client.id)
      onClose()
    }
    setDeleting(false)
  }

  return (
    <Modal open onClose={onClose} title="Delete Client Profile" size="sm">
      <p className="text-slate-600 text-sm mb-6">
        Are you sure you want to delete <span className="font-semibold">{client.first_name} {client.last_name}</span>?
        This action will remove them from your client list. Contact your administrator if you need to recover this record.
      </p>
      <div className="flex gap-3">
        <button
          autoFocus
          onClick={onClose}
          className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg hover:bg-slate-50 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2 rounded-lg font-semibold"
        >
          {deleting ? 'Deleting…' : 'Delete Client'}
        </button>
      </div>
    </Modal>
  )
}

function OverflowMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700"
        title="More options"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
          <button
            onClick={() => { setOpen(false); onDelete() }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Delete Client
          </button>
        </div>
      )}
    </div>
  )
}

export default function ClientsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'updated'>('updated')
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)

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
                  <th className="px-4 py-3 w-10" />
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
                    <td className="px-4 py-4">
                      <OverflowMenu onDelete={() => setDeletingClient(client)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {deletingClient && (
        <DeleteClientModal
          client={deletingClient}
          onClose={() => setDeletingClient(null)}
          onDeleted={id => setClients(cs => cs.filter(c => c.id !== id))}
        />
      )}
    </div>
  )
}
