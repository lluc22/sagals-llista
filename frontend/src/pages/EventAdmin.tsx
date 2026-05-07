import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, CheckCircle, Pencil, Trash2, Plus, X, Save, AlertTriangle, Users, MessageSquare } from 'lucide-react'
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
type TripDraft = { bus_id: number; direction: 'anada' | 'tornada' }
type PartDraft = { first_name: string; last_name: string; last_name2: string; nickname: string; trips: TripDraft[] }

const EMPTY_BUS: BusDraft = { label: '', departure_time: '', direction: 'ambdues' }
const EMPTY_PART: PartDraft = { first_name: '', last_name: '', last_name2: '', nickname: '', trips: [] }

const SECTION_LIMIT = 6

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

  const [showReviewed, setShowReviewed] = useState(false)

  const [editingPartId, setEditingPartId] = useState<number | null>(null)
  const [partDraft, setPartDraft] = useState<PartDraft>(EMPTY_PART)
  const [savingPart, setSavingPart] = useState(false)
  const [addingPart, setAddingPart] = useState(false)
  const [newPartDraft, setNewPartDraft] = useState<PartDraft>(EMPTY_PART)

  const [search, setSearch] = useState('')
  const [showAllSections, setShowAllSections] = useState<Set<string>>(new Set())

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
    setPartDraft({
      first_name: p.first_name,
      last_name: p.last_name,
      last_name2: p.last_name2,
      nickname: p.nickname,
      trips: p.trips.map(t => ({ bus_id: t.bus_id, direction: t.direction })),
    })
  }

  function toggleTrip(bus_id: number, direction: 'anada' | 'tornada') {
    setPartDraft(prev => {
      const exists = prev.trips.some(t => t.bus_id === bus_id && t.direction === direction)
      return {
        ...prev,
        trips: exists
          ? prev.trips.filter(t => !(t.bus_id === bus_id && t.direction === direction))
          : [...prev.trips, { bus_id, direction }],
      }
    })
  }

  function toggleNewTrip(bus_id: number, direction: 'anada' | 'tornada') {
    setNewPartDraft(prev => {
      const exists = prev.trips.some(t => t.bus_id === bus_id && t.direction === direction)
      return {
        ...prev,
        trips: exists
          ? prev.trips.filter(t => !(t.bus_id === bus_id && t.direction === direction))
          : [...prev.trips, { bus_id, direction }],
      }
    })
  }

  async function handleToggleReviewed(p: Participant) {
    const res = await api.patch<{ data: Participant }>(`/api/participants/${p.id}`, { reviewed: !p.reviewed })
    setParticipants(prev => prev.map(x => x.id === p.id ? res.data : x))
  }

  async function handleSavePart(participantId: number) {
    setSavingPart(true)
    try {
      const res = await api.patch<{ data: Participant }>(`/api/participants/${participantId}`, partDraft)
      setParticipants(prev => prev.map(p => p.id === participantId ? res.data : p))
      setEditingPartId(null)
    } finally { setSavingPart(false) }
  }

  async function handleAddPart() {
    if (!id || !newPartDraft.first_name.trim()) return
    setSavingPart(true)
    try {
      const res = await api.post<{ data: Participant }>(`/api/events/${id}/participants`, {
        first_name: newPartDraft.first_name,
        last_name: newPartDraft.last_name,
        last_name2: newPartDraft.last_name2,
        nickname: newPartDraft.nickname,
      })
      let p = res.data
      if (newPartDraft.trips.length > 0) {
        const r2 = await api.patch<{ data: Participant }>(`/api/participants/${p.id}`, { trips: newPartDraft.trips })
        p = r2.data
      }
      setParticipants(prev => [...prev, p])
      setAddingPart(false)
      setNewPartDraft(EMPTY_PART)
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

  function busDirs(bus: Bus): ('anada' | 'tornada')[] {
    return bus.direction === 'ambdues' ? ['anada', 'tornada'] : [bus.direction as 'anada' | 'tornada']
  }

  if (!event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Carregant...</div>

  const sorted = [...participants].sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
  )

  const filtered = sorted.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return [p.first_name, p.last_name, p.last_name2, p.nickname].some(s => s?.toLowerCase().includes(q))
  })

  const needsAttention = filtered.filter(p => (p.companions || p.observations) && !p.reviewed)
  const alreadyReviewed = filtered.filter(p => (p.companions || p.observations) && p.reviewed)

  const sectionMap = new Map<string, Participant[]>()
  for (const p of filtered) {
    const key = tripSummary(p)
    const arr = sectionMap.get(key) ?? []
    arr.push(p)
    sectionMap.set(key, arr)
  }
  const sections = [...sectionMap.entries()].sort(([a], [b]) => {
    if (a === 'Transport propi') return 1
    if (b === 'Transport propi') return -1
    return a.localeCompare(b)
  })

  function BusCheckboxes({ trips, onToggle }: { trips: TripDraft[]; onToggle: (bus_id: number, dir: 'anada' | 'tornada') => void }) {
    if (buses.length === 0) return null
    return (
      <div>
        <p className="text-xs text-gray-500 mb-1">Busos</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {buses.flatMap(bus =>
            busDirs(bus).map(dir => {
              const checked = trips.some(t => t.bus_id === bus.id && t.direction === dir)
              return (
                <label key={`${bus.id}-${dir}`} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => onToggle(bus.id, dir)} className="rounded accent-blue-600" />
                  <span className="text-gray-700">{bus.label} · {DIR[dir]}</span>
                </label>
              )
            })
          )}
        </div>
      </div>
    )
  }

  function PartRow({ p }: { p: Participant }) {
    if (editingPartId === p.id) {
      return (
        <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50 my-1">
          <div className="grid grid-cols-2 gap-2">
            {(['first_name', 'last_name', 'last_name2', 'nickname'] as const).map(field => (
              <input key={field} value={partDraft[field]} onChange={e => setPartDraft(prev => ({ ...prev, [field]: e.target.value }))}
                placeholder={{ first_name: 'Nom', last_name: 'Cognom', last_name2: 'Segon cognom', nickname: 'Sobrenom' }[field]}
                className="border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
            ))}
          </div>
          <BusCheckboxes trips={partDraft.trips} onToggle={toggleTrip} />
          <div className="flex gap-2">
            <button onClick={() => handleSavePart(p.id)} disabled={savingPart} className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1 rounded-lg disabled:opacity-50">
              <Save size={12} /> Desar
            </button>
            <button onClick={() => setEditingPartId(null)} className="flex items-center gap-1 text-xs text-gray-600 px-3 py-1 rounded-lg border border-gray-200 bg-white">
              <X size={12} /> Cancel·lar
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-900">{p.first_name} {p.last_name}</span>
            {p.nickname && <span className="text-xs text-gray-400">({p.nickname})</span>}
            {p.companions && <Users size={11} className="text-amber-400 shrink-0" />}
            {p.observations && <MessageSquare size={11} className="text-amber-400 shrink-0" />}
          </div>
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
    )
  }

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
            <div className="flex items-center gap-3">
              <button onClick={() => { setAddingPart(true); setNewPartDraft(EMPTY_PART) }}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                <Plus size={14} /> Afegir
              </button>
              {participants.length > 0 && !confirmReimport && (
                <button onClick={() => setConfirmReimport(true)} className="text-xs text-orange-600 hover:text-orange-700">
                  Reimportar
                </button>
              )}
            </div>
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

          {/* Add participant form */}
          {addingPart && (
            <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50 mb-3">
              <div className="grid grid-cols-2 gap-2">
                {(['first_name', 'last_name', 'last_name2', 'nickname'] as const).map(field => (
                  <input key={field} value={newPartDraft[field]}
                    onChange={e => setNewPartDraft(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={{ first_name: 'Nom *', last_name: 'Cognom', last_name2: 'Segon cognom', nickname: 'Sobrenom' }[field]}
                    className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
                    autoFocus={field === 'first_name'} />
                ))}
              </div>
              <BusCheckboxes trips={newPartDraft.trips} onToggle={toggleNewTrip} />
              <div className="flex gap-2">
                <button onClick={handleAddPart} disabled={savingPart || !newPartDraft.first_name.trim()}
                  className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1 rounded-lg disabled:opacity-50">
                  <Save size={12} /> Desar
                </button>
                <button onClick={() => setAddingPart(false)}
                  className="flex items-center gap-1 text-xs text-gray-600 px-3 py-1 rounded-lg border border-gray-200 bg-white">
                  <X size={12} /> Cancel·lar
                </button>
              </div>
            </div>
          )}

          {participants.length === 0 && !addingPart ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-4">Cap participant importat encara</p>
              <button onClick={() => navigate(`/events/${id}/setup`)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Importar participants
              </button>
            </div>
          ) : (
            <>
              {/* Search */}
              {participants.length > 0 && (
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cercar..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}

              {/* Atenció */}
              {(needsAttention.length > 0 || alreadyReviewed.length > 0) && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3 space-y-2">
                  {needsAttention.length > 0 && <p className="text-xs font-medium text-amber-700">Atenció ({needsAttention.length})</p>}
                  {needsAttention.map(p => (
                    <div key={p.id} className="flex items-start gap-2">
                      <div className="flex-1 space-y-0.5">
                        <p className="text-xs font-medium text-gray-800">{p.first_name} {p.last_name}{p.nickname && ` (${p.nickname})`}</p>
                        {p.companions && (
                          <p className="text-xs text-gray-600 flex items-start gap-1">
                            <Users size={11} className="shrink-0 mt-0.5 text-amber-500" />
                            {p.companions}
                          </p>
                        )}
                        {p.observations && (
                          <p className="text-xs text-gray-600 flex items-start gap-1">
                            <MessageSquare size={11} className="shrink-0 mt-0.5 text-amber-500" />
                            {p.observations}
                          </p>
                        )}
                      </div>
                      <button onClick={() => handleToggleReviewed(p)}
                        className="shrink-0 text-amber-400 hover:text-green-500 transition-colors mt-0.5" title="Marcar com a revisat">
                        <CheckCircle size={14} />
                      </button>
                    </div>
                  ))}

                  {alreadyReviewed.length > 0 && (
                    <div className={needsAttention.length > 0 ? 'border-t border-amber-100 pt-2 mt-1' : ''}>
                      {needsAttention.length > 0 && (
                        <button onClick={() => setShowReviewed(v => !v)}
                          className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 mb-2">
                          {showReviewed ? '▾' : '▸'} Revisats ({alreadyReviewed.length})
                        </button>
                      )}
                      {(needsAttention.length === 0 || showReviewed) && (
                        <div className="space-y-2">
                          {alreadyReviewed.map(p => (
                            <div key={p.id} className="flex items-start gap-2 opacity-60">
                              <div className="flex-1 space-y-0.5">
                                <p className="text-xs font-medium text-gray-700 line-through">{p.first_name} {p.last_name}{p.nickname && ` (${p.nickname})`}</p>
                                {p.companions && <p className="text-xs text-gray-500 flex items-start gap-1"><Users size={11} className="shrink-0 mt-0.5" />{p.companions}</p>}
                                {p.observations && <p className="text-xs text-gray-500 flex items-start gap-1"><MessageSquare size={11} className="shrink-0 mt-0.5" />{p.observations}</p>}
                              </div>
                              <button onClick={() => handleToggleReviewed(p)}
                                className="shrink-0 text-green-400 hover:text-amber-500 transition-colors mt-0.5" title="Desmarcar">
                                <CheckCircle size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sections */}
              {filtered.length === 0 && search ? (
                <p className="text-center text-sm text-gray-400 py-4">Cap resultat per "{search}"</p>
              ) : (
                <div className="space-y-4">
                  {sections.map(([sectionKey, sectionParts]) => {
                    const expanded = search.length > 0 || showAllSections.has(sectionKey)
                    const visible = expanded ? sectionParts : sectionParts.slice(0, SECTION_LIMIT)
                    return (
                      <div key={sectionKey}>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 mb-0.5">{sectionKey}</p>
                        <div className="space-y-0.5">
                          {visible.map(p => <PartRow key={p.id} p={p} />)}
                        </div>
                        {sectionParts.length > SECTION_LIMIT && !search && (
                          <button
                            onClick={() => setShowAllSections(prev => {
                              const next = new Set(prev)
                              next.has(sectionKey) ? next.delete(sectionKey) : next.add(sectionKey)
                              return next
                            })}
                            className="text-xs text-blue-600 hover:text-blue-700 mt-1 px-2">
                            {showAllSections.has(sectionKey) ? `Amaga` : `Mostra tots (${sectionParts.length})`}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
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
