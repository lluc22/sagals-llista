import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, CheckCircle, Pencil, Trash2, Plus, X, Save, AlertTriangle } from 'lucide-react'
import { api } from '../lib/api'
import type { Event, Bus, Participant } from '../types'

const STATUS_LABELS: Record<string, string> = {
  draft:  'Esborrany',
  active: 'Actiu',
  closed: 'Tancat',
}

const DIR: Record<string, string> = {
  anada:   'Anada',
  tornada: 'Tornada',
  ambdues: 'Anada i tornada',
}

const BUS_DIRS = ['anada', 'tornada', 'ambdues'] as const

type BusDraft = { label: string; departure_time: string; direction: 'anada' | 'tornada' | 'ambdues' }
type PartDraft = { first_name: string; last_name: string; last_name2: string; nickname: string }

const EMPTY_BUS: BusDraft = { label: '', departure_time: '', direction: 'ambdues' }

export default function EventAdmin() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [buses, setBuses] = useState<Bus[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])

  const [activating, setActivating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [confirmReimport, setConfirmReimport] = useState(false)
  const [reimporting, setReimporting] = useState(false)

  const [editingBusId, setEditingBusId] = useState<number | null>(null)
  const [busDraft, setBusDraft] = useState<BusDraft>(EMPTY_BUS)
  const [addingBus, setAddingBus] = useState(false)
  const [newBus, setNewBus] = useState<BusDraft>(EMPTY_BUS)
  const [savingBus, setSavingBus] = useState(false)

  const [editingPartId, setEditingPartId] = useState<number | null>(null)
  const [partDraft, setPartDraft] = useState<PartDraft>({ first_name: '', last_name: '', last_name2: '', nickname: '' })
  const [savingPart, setSavingPart] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<{ data: Event }>(`/api/events/${id}`).then(r => r.data),
      api.get<{ data: Bus[] }>(`/api/events/${id}/buses`).then(r => r.data),
      api.get<{ data: Participant[] }>(`/api/events/${id}/participants`).then(r => r.data),
    ]).then(([ev, bs, ps]) => { setEvent(ev); setBuses(bs); setParticipants(ps) })
  }, [id])

  async function handleActivate() {
    if (!id) return
    setActivating(true)
    try {
      const res = await api.post<{ data: Event }>(`/api/events/${id}/activate`)
      setEvent(res.data)
    } finally { setActivating(false) }
  }

  async function handleReimport() {
    if (!id) return
    setReimporting(true)
    try {
      for (const p of participants) await api.del(`/api/participants/${p.id}`)
      navigate(`/events/${id}/setup`)
    } finally { setReimporting(false); setConfirmReimport(false) }
  }

  async function handleDeleteParticipant(participantId: number) {
    await api.del(`/api/participants/${participantId}`)
    setParticipants(prev => prev.filter(p => p.id !== participantId))
  }

  function startEditPart(p: Participant) {
    setEditingPartId(p.id)
    setPartDraft({ first_name: p.first_name, last_name: p.last_name, last_name2: p.last_name2, nickname: p.nickname })
  }

  async function handleSavePart(participantId: number) {
    setSavingPart(true)
    try {
      const res = await api.patch<{ data: Participant }>(`/api/participants/${participantId}`, partDraft)
      setParticipants(prev => prev.map(p => p.id === participantId ? res.data : p))
      setEditingPartId(null)
    } finally { setSavingPart(false) }
  }

  async function handleSaveBus(busId: number) {
    setSavingBus(true)
    try {
      await api.patch(`/api/buses/${busId}`, busDraft)
      setBuses(prev => prev.map(b => b.id === busId ? { ...b, ...busDraft } : b))
      setEditingBusId(null)
    } finally { setSavingBus(false) }
  }

  async function handleDeleteBus(busId: number) {
    await api.del(`/api/buses/${busId}`)
    setBuses(prev => prev.filter(b => b.id !== busId))
  }

  async function handleAddBus() {
    if (!id || !newBus.label.trim()) return
    setSavingBus(true)
    try {
      const res = await api.post<{ data: Bus }>(`/api/events/${id}/buses`, { ...newBus, order: buses.length + 1 })
      setBuses(prev => [...prev, res.data])
      setNewBus(EMPTY_BUS)
      setAddingBus(false)
    } finally { setSavingBus(false) }
  }

  function copyLink() {
    if (!event?.access_token) return
    navigator.clipboard.writeText(`${window.location.origin}/list/${event.slug}?t=${event.access_token}`)
    setCopied('link')
    setTimeout(() => setCopied(null), 2000)
  }

  function tripSummary(p: Participant): string {
    if (p.trips.length === 0) return 'Transport propi'
    return p.trips.map(t => {
      const bus = buses.find(b => b.id === t.bus_id)
      return bus ? `${bus.label} · ${DIR[t.direction]}` : null
    }).filter(Boolean).join(', ')
  }

  if (!event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Carregant...</div>

  const sorted = [...participants].sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Header */}
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Tornar
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
            <p className="text-sm text-gray-500">{new Date(event.date + 'T12:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            event.status === 'active' ? 'bg-green-100 text-green-700' :
            event.status === 'closed' ? 'bg-gray-100 text-gray-500' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {STATUS_LABELS[event.status] ?? event.status}
          </span>
        </div>

        {/* Activate */}
        {event.status === 'draft' && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm text-blue-800 mb-3">Activa l'actuació perquè els llistadors puguin marcar assistència.</p>
            <button onClick={handleActivate} disabled={activating} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {activating ? 'Activant...' : 'Activar actuació'}
            </button>
          </div>
        )}

        {/* Participants */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-gray-900">Participants ({participants.length})</h2>
            {participants.length > 0 && !confirmReimport && (
              <button onClick={() => setConfirmReimport(true)} className="text-xs text-orange-600 hover:text-orange-700">
                Reimportar
              </button>
            )}
          </div>

          {confirmReimport && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 mb-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-orange-800 mb-2">S'esborraran tots els participants. Continuar?</p>
                <div className="flex gap-2">
                  <button onClick={handleReimport} disabled={reimporting} className="text-xs bg-orange-600 text-white px-3 py-1 rounded-lg disabled:opacity-50">
                    {reimporting ? 'Esborrant...' : 'Confirmar'}
                  </button>
                  <button onClick={() => setConfirmReimport(false)} className="text-xs text-gray-600 px-3 py-1 rounded-lg border border-gray-200">
                    Cancel·lar
                  </button>
                </div>
              </div>
            </div>
          )}

          {participants.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-4">Cap participant importat encara</p>
              <button onClick={() => navigate(`/events/${id}/setup`)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Importar participants
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {sorted.map(p => (
                <div key={p.id}>
                  {editingPartId === p.id ? (
                    <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50 my-1">
                      <div className="grid grid-cols-2 gap-2">
                        {(['first_name', 'last_name', 'last_name2', 'nickname'] as const).map(field => (
                          <input key={field} value={partDraft[field]} onChange={e => setPartDraft(prev => ({ ...prev, [field]: e.target.value }))}
                            placeholder={{ first_name: 'Nom', last_name: 'Cognom', last_name2: 'Segon cognom', nickname: 'Sobrenom' }[field]}
                            className="border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSavePart(p.id)} disabled={savingPart} className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1 rounded-lg disabled:opacity-50">
                          <Save size={12} /> Desar
                        </button>
                        <button onClick={() => setEditingPartId(null)} className="flex items-center gap-1 text-xs text-gray-600 px-3 py-1 rounded-lg border border-gray-200 bg-white">
                          <X size={12} /> Cancel·lar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 group">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-900">{p.first_name} {p.last_name}</span>
                        {p.nickname && <span className="text-xs text-gray-400 ml-1">({p.nickname})</span>}
                        <p className="text-xs text-gray-400 truncate">{tripSummary(p)}</p>
                      </div>
                      <button onClick={() => startEditPart(p)} aria-label={`Editar ${p.first_name} ${p.last_name}`}
                        className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteParticipant(p.id)} aria-label={`Eliminar ${p.first_name} ${p.last_name}`}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buses */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-gray-900">Busos</h2>
            <button onClick={() => { setAddingBus(true); setNewBus(EMPTY_BUS) }} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <Plus size={14} /> Afegir bus
            </button>
          </div>

          <div className="space-y-1">
            {buses.map(bus => (
              <div key={bus.id}>
                {editingBusId === bus.id ? (
                  <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50 my-1">
                    <input value={busDraft.label} onChange={e => setBusDraft(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="Bus 1 · Sortida 8:00h" className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="time" value={busDraft.departure_time} onChange={e => setBusDraft(prev => ({ ...prev, departure_time: e.target.value }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                      <select value={busDraft.direction} onChange={e => setBusDraft(prev => ({ ...prev, direction: e.target.value as BusDraft['direction'] }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm bg-white">
                        {BUS_DIRS.map(d => <option key={d} value={d}>{DIR[d]}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveBus(bus.id)} disabled={savingBus} className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1 rounded-lg disabled:opacity-50">
                        <Save size={12} /> Desar
                      </button>
                      <button onClick={() => setEditingBusId(null)} className="flex items-center gap-1 text-xs text-gray-600 px-3 py-1 rounded-lg border border-gray-200 bg-white">
                        <X size={12} /> Cancel·lar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-50 group">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900">{bus.label}</span>
                      <p className="text-xs text-gray-400">{bus.departure_time && `${bus.departure_time} · `}{DIR[bus.direction]}</p>
                    </div>
                    <button onClick={() => { setEditingBusId(bus.id); setBusDraft({ label: bus.label, departure_time: bus.departure_time, direction: bus.direction }) }}
                      aria-label={`Editar ${bus.label}`} className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDeleteBus(bus.id)} aria-label={`Eliminar ${bus.label}`}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {addingBus && (
              <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50 mt-2">
                <input value={newBus.label} onChange={e => setNewBus(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Bus 1 · Sortida 8:00h" className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white" autoFocus />
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" value={newBus.departure_time} onChange={e => setNewBus(prev => ({ ...prev, departure_time: e.target.value }))}
                    className="border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                  <select value={newBus.direction} onChange={e => setNewBus(prev => ({ ...prev, direction: e.target.value as BusDraft['direction'] }))}
                    className="border border-gray-200 rounded px-2 py-1 text-sm bg-white">
                    {BUS_DIRS.map(d => <option key={d} value={d}>{DIR[d]}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddBus} disabled={savingBus || !newBus.label.trim()} className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1 rounded-lg disabled:opacity-50">
                    <Save size={12} /> Desar
                  </button>
                  <button onClick={() => setAddingBus(false)} className="flex items-center gap-1 text-xs text-gray-600 px-3 py-1 rounded-lg border border-gray-200 bg-white">
                    <X size={12} /> Cancel·lar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Share link */}
        {event.status === 'active' && event.access_token && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-medium text-gray-900 mb-3">Enllaç de llista</h2>
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 truncate flex-1 mr-2">
                {window.location.origin}/list/{event.slug}
              </p>
              <button onClick={copyLink} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 shrink-0">
                {copied === 'link' ? <CheckCircle size={12} /> : <Copy size={12} />}
                {copied === 'link' ? 'Copiat!' : 'Copiar'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
