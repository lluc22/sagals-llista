import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, FileText } from 'lucide-react'
import { api } from '../lib/api'
import { addBus, removeBus, updateBus, type BusDraft } from '../lib/buses'
import type { Event, Bus } from '../types'

const DIRECTION_LABELS = {
  anada:   'Només anada',
  tornada: 'Només tornada',
}

function generateSlug(name: string, suffix = ''): string {
  const base = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return suffix ? `${base}-${suffix}` : base
}

function isSlugConflict(err: unknown): boolean {
  const e = err as { status?: number; data?: { errors?: { slug?: unknown } } }
  return e.status === 422 && !!e.data?.errors?.slug
}

export default function NewEvent() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [buses, setBuses] = useState<BusDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (buses.length === 0) {
      setError('Afegeix almenys un bus')
      return
    }
    setError('')
    setSaving(true)
    try {
      let event: Event | undefined
      for (let attempt = 0; attempt < 10; attempt++) {
        const slug = generateSlug(name, attempt > 0 ? String(attempt + 1) : '')
        try {
          const res = await api.post<{ data: Event }>('/api/events', { name, date, slug, status: 'draft', column_mapping: {}, transport_mapping: {} })
          event = res.data
          break
        } catch (err) {
          if (!isSlugConflict(err) || attempt === 9) throw err
        }
      }
      if (!event) throw new Error('No s\'ha pogut crear l\'event')
      for (let i = 0; i < buses.length; i++) {
        await api.post<{ data: Bus }>(`/api/events/${event.id}/buses`, { ...buses[i], order: i + 1 })
      }
      navigate(`/events/${event.id}/setup`)
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { errors?: Record<string, string[]> } }
      const detail = e.data?.errors ? Object.entries(e.data.errors).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') : (err as { message?: string })?.message ?? String(err)
      setError(`Error: ${detail}`)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-sagals-light border-b border-sagals/20 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Nova actuació</h1>
        </div>
      </div>
      <div className="p-4">
        <div className="max-w-lg mx-auto">

        <button
          type="button"
          onClick={() => navigate('/events/new-from-form')}
          className="w-full bg-white rounded-xl border border-sagals/20 p-4 text-left hover:border-sagals transition-colors shadow-sm mb-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-sagals-light flex items-center justify-center shrink-0">
            <FileText size={18} className="text-sagals-dark" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Importar des de formulari</p>
            <p className="text-xs text-gray-500">Crea l'actuació a partir d'un formulari de Tenimaleta</p>
          </div>
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-sagals/10 p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'actuació</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Festa Major Vic 2025"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sagals"
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sagals"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium text-gray-900">Busos</h2>
              <button
                type="button"
                onClick={() => setBuses(prev => addBus(prev))}
                className="flex items-center gap-1 text-sm text-sagals-dark hover:text-sagals"
              >
                <Plus size={16} /> Afegir bus
              </button>
            </div>

            {buses.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6 bg-white rounded-xl border border-dashed border-sagals/20">
                Cap bus afegit encara
              </p>
            )}

            <div className="space-y-3">
              {buses.map((bus, i) => (
                <div key={i} className="bg-white rounded-xl border border-sagals/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Bus {i + 1}</span>
                    <button
                      type="button"
                      data-testid={`remove-bus-${i}`}
                      onClick={() => setBuses(prev => removeBus(prev, i))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Etiqueta</label>
                    <input
                      type="text"
                      value={bus.label}
                      onChange={e => setBuses(prev => updateBus(prev, i, { label: e.target.value }))}
                      placeholder="Bus 1 · Sortida 8:00h"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sagals"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Hora sortida</label>
                      <input
                        type="time"
                        value={bus.departure_time}
                        onChange={e => setBuses(prev => updateBus(prev, i, { departure_time: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sagals"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Direcció</label>
                      <select
                        value={bus.direction}
                        onChange={e => setBuses(prev => updateBus(prev, i, { direction: e.target.value as BusDraft['direction'] }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sagals"
                      >
                        {Object.entries(DIRECTION_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-sagals text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Guardant...' : 'Crear actuació i continuar →'}
          </button>
        </form>
      </div>
      </div>
    </div>
  )
}
