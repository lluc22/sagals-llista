import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, UserPlus, Save, X, Pencil } from 'lucide-react'
import { api } from '../lib/api'
import type { User } from '../types'

export default function UserAdmin() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [add, setAdd] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')

  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    api.get<{ data: User[] }>('/api/users').then(r => setUsers(r.data))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await api.post<{ data: User }>('/api/users', { email, password })
      setUsers(prev => [...prev, res.data])
      setAdd(false)
      setEmail('')
      setPassword('')
    } catch (err: any) {
      setError(err?.errors?.join(', ') ?? 'Error creant usuari')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(u: User) {
    setEditingId(u.id)
    setEditEmail(u.email)
    setEditPassword('')
  }

  async function handleUpdate(e: React.FormEvent, id: number) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body: any = { email: editEmail }
      if (editPassword) body.password = editPassword
      const res = await api.put<{ data: User }>(`/api/users/${id}`, body)
      setUsers(prev => prev.map(u => u.id === id ? res.data : u))
      setEditingId(null)
    } catch (err: any) {
      setError(err?.errors?.join(', ') ?? 'Error actualitzant usuari')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(user: User) {
    try {
      await api.del(`/api/users/${user.id}`)
      setUsers(prev => prev.filter(u => u.id !== user.id))
      setDeleteId(null)
    } catch (err: any) {
      setError(err?.errors?.join(', ') ?? 'Error eliminant usuari')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Tornar
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-sagals">Usuaris admin</h1>
          <button onClick={() => setAdd(true)} disabled={add}
            className="flex items-center gap-1 text-sm text-sagals-dark hover:text-sagals">
            <UserPlus size={14} /> Afegir
          </button>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>}

        {add && (
          <form onSubmit={handleCreate} className="bg-sagals-light border border-sagals rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={email} onChange={e => setEmail(e.target.value)}
                type="text" placeholder="Usuari *" autoFocus required
                className="border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
              <input value={password} onChange={e => setPassword(e.target.value)}
                type="password" placeholder="Contrasenya *" required minLength={8}
                className="border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1 text-xs bg-sagals text-white px-3 py-1 rounded-lg disabled:opacity-50">
                <Save size={12} /> Desar
              </button>
              <button type="button" onClick={() => { setAdd(false); setEmail(''); setPassword(''); setError('') }}
                className="flex items-center gap-1 text-xs text-gray-600 px-3 py-1 rounded-lg border border-gray-200 bg-white">
                <X size={12} /> Cancel·lar
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="space-y-0.5">
            {users.map(u => {
              if (editingId === u.id) {
                return (
                  <form key={u.id} onSubmit={e => handleUpdate(e, u.id)}
                    className="border border-sagals rounded-lg p-3 space-y-2 bg-sagals-light">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editEmail} onChange={e => setEditEmail(e.target.value)}
                        type="text" placeholder="Usuari *" autoFocus required
                        className="border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                      <input value={editPassword} onChange={e => setEditPassword(e.target.value)}
                        type="password" placeholder="Nova contrasenya (deixa buit per mantenir)" minLength={8}
                        className="border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving}
                        className="flex items-center gap-1 text-xs bg-sagals text-white px-3 py-1 rounded-lg disabled:opacity-50">
                        <Save size={12} /> Desar
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 text-xs text-gray-600 px-3 py-1 rounded-lg border border-gray-200 bg-white">
                        <X size={12} /> Cancel·lar
                      </button>
                    </div>
                  </form>
                )
              }
              return (
                <div key={u.id} className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-50 group">
                  <span className="text-sm text-gray-900 flex-1 truncate">{u.email}</span>
                  <button onClick={() => startEdit(u)}
                    className="text-gray-300 hover:text-sagals md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    title={`Editar ${u.email}`}>
                    <Pencil size={14} />
                  </button>
                  {deleteId === u.id ? (
                    <div className="flex items-center gap-1 bg-red-50 border border-red-100 rounded-lg px-2 py-0.5">
                      <span className="text-xs text-red-600">Segur?</span>
                      <button onClick={() => handleDelete(u)} className="text-xs text-red-600 font-medium hover:text-red-800">Sí</button>
                      <button onClick={() => setDeleteId(null)} className="text-xs text-gray-400">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteId(u.id)}
                      className="text-gray-300 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      title={`Eliminar ${u.email}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
            {users.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-6">Cap usuari</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
