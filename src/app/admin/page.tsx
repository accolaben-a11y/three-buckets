'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  contact_info: string | null
  is_active: boolean
  created_at: string
  _count: { clients: number }
}

interface Settings {
  inflation_rate_bps: number
  home_appreciation_bps: number
  loc_growth_rate_bps: number
  planning_horizon_age: number
  hecm_lending_limit_cents: number
  session_timeout_minutes: number
}

export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', contact_info: '', role: 'advisor' })
  const [editUser, setEditUser] = useState({ full_name: '', contact_info: '', is_active: true, password: '' })
  const [settingsForm, setSettingsForm] = useState<Settings | null>(null)

  useEffect(() => {
    if (session?.user.role !== 'admin') { router.push('/clients'); return }
    loadData()
  }, [session, router])

  async function loadData() {
    const [usersRes, settingsRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/settings'),
    ])
    if (usersRes.ok) setUsers(await usersRes.json())
    if (settingsRes.ok) {
      const s = await settingsRes.json()
      setSettings(s)
      setSettingsForm(s)
    }
  }

  async function createUser() {
    setSaving(true)
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    })
    setSaving(false)
    setShowCreateModal(false)
    setNewUser({ email: '', password: '', full_name: '', contact_info: '', role: 'advisor' })
    await loadData()
  }

  async function updateUser() {
    if (!showEditModal) return
    setSaving(true)
    const payload: Record<string, unknown> = {
      full_name: editUser.full_name,
      contact_info: editUser.contact_info,
      is_active: editUser.is_active,
    }
    if (editUser.password) payload.password = editUser.password
    await fetch(`/api/admin/users/${showEditModal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setShowEditModal(null)
    await loadData()
  }

  async function saveSettings() {
    if (!settingsForm) return
    setSaving(true)
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsForm),
    })
    setSaving(false)
    await loadData()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-3 h-7 rounded-sm bg-green-500" />
            <div className="w-3 h-7 rounded-sm bg-blue-500" />
            <div className="w-3 h-7 rounded-sm bg-red-500" />
          </div>
          <span className="font-bold">Three Buckets — Admin Panel</span>
        </div>
        <Link href="/clients" className="text-slate-400 hover:text-white text-sm">← Back to Clients</Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-200 rounded-lg p-1 mb-6 w-fit">
          {[
            { key: 'users', label: 'Advisor Accounts' },
            { key: 'settings', label: 'Global Settings' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800">Advisor Accounts ({users.length})</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                + New Advisor
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Role</th>
                    <th className="text-left px-4 py-3">Clients</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-800">{user.full_name}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{user._count.clients}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setShowEditModal(user)
                            setEditUser({ full_name: user.full_name, contact_info: user.contact_info ?? '', is_active: user.is_active, password: '' })
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && settingsForm && (
          <div className="max-w-xl">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Global Default Assumptions</h2>
            <p className="text-slate-500 text-sm mb-6">
              These defaults apply to all new scenarios. Changes do not retroactively affect saved scenarios.
            </p>

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              {[
                { key: 'inflation_rate_bps', label: 'Inflation Rate', suffix: '%', divisor: 100 },
                { key: 'home_appreciation_bps', label: 'Home Appreciation Rate', suffix: '%', divisor: 100 },
                { key: 'loc_growth_rate_bps', label: 'HECM LOC Growth Rate', suffix: '%', divisor: 100 },
                { key: 'planning_horizon_age', label: 'Planning Horizon Age', suffix: 'years', divisor: 1 },
                { key: 'session_timeout_minutes', label: 'Session Timeout', suffix: 'minutes', divisor: 1 },
              ].map(({ key, label, suffix, divisor }) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={(settingsForm[key as keyof Settings] as number) / divisor}
                      onChange={e => setSettingsForm(f => f ? {
                        ...f,
                        [key]: Math.round(parseFloat(e.target.value) * divisor),
                      } : f)}
                      step={divisor === 100 ? 0.1 : 1}
                      className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-right text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-500">{suffix}</span>
                  </div>
                </div>
              ))}

              {/* HECM Lending Limit */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  HECM Lending Limit
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">$</span>
                  <input
                    type="number"
                    value={settingsForm.hecm_lending_limit_cents / 100}
                    onChange={e => setSettingsForm(f => f ? {
                      ...f,
                      hecm_lending_limit_cents: Math.round(parseFloat(e.target.value) * 100),
                    } : f)}
                    step={1000}
                    className="w-36 px-3 py-1.5 border border-slate-300 rounded-lg text-right text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg mt-2 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Create User Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Advisor Account">
        <div className="space-y-4">
          {[
            { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Jane Smith' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'jane@company.com' },
            { key: 'password', label: 'Temporary Password', type: 'password', placeholder: 'min 8 characters' },
            { key: 'contact_info', label: 'Contact Info (for PDF header)', type: 'text', placeholder: 'Jane Smith | HECM Specialist | (555) 123-4567' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type={type}
                value={newUser[key as keyof typeof newUser]}
                onChange={e => setNewUser(u => ({ ...u, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              value={newUser.role}
              onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="advisor">Advisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowCreateModal(false)} className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={createUser} disabled={saving || !newUser.email || !newUser.password || !newUser.full_name}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold">
              {saving ? 'Creating…' : 'Create Advisor'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={!!showEditModal} onClose={() => setShowEditModal(null)} title={`Edit: ${showEditModal?.full_name}`}>
        {showEditModal && (
          <div className="space-y-4">
            {[
              { key: 'full_name', label: 'Full Name', type: 'text' },
              { key: 'contact_info', label: 'Contact Info', type: 'text' },
              { key: 'password', label: 'Reset Password (leave blank to keep current)', type: 'password' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={editUser[key as keyof typeof editUser] as string}
                  onChange={e => setEditUser(u => ({ ...u, [key]: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={editUser.is_active}
                onChange={e => setEditUser(u => ({ ...u, is_active: e.target.checked }))}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Account Active</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowEditModal(null)} className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={updateUser} disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
