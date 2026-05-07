import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { read, utils } from 'xlsx'
import { ArrowLeft, Upload, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { detectColumns, getUniqueTransportValues } from '../lib/excel'
import type { Event, Bus, ColumnMapping, TransportMapping, TransportBusEntry } from '../types'

type Step = 'import' | 'columns' | 'transport'

interface TransportRule {
  usesBus: boolean
  buses: TransportBusEntry[]
}

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  firstName:    'Nom',
  lastName:     'Cognom',
  lastName2:    'Segon cognom',
  nickname:     'Sobrenom',
  transport:    'Transport',
  observations: 'Observacions',
  companions:   'Acompanyants',
}

const DIRECTION_LABELS = {
  anada:   'Anada',
  tornada: 'Tornada',
  ambdues: 'Anada i tornada',
}

export default function EventSetup() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [buses, setBuses] = useState<Bus[]>([])
  const [step, setStep] = useState<Step>('import')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({ firstName: -1, lastName: -1, lastName2: -1, nickname: -1, transport: -1, observations: -1, companions: -1 })
  const [transportRules, setTransportRules] = useState<Record<string, TransportRule>>({})

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<{ data: Event }>(`/api/events/${id}`).then(r => r.data),
      api.get<{ data: Bus[] }>(`/api/events/${id}/buses`).then(r => r.data),
    ]).then(([ev, bs]) => { setEvent(ev); setBuses(bs) })
  }, [id])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = read(ev.target?.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false })
      if (data.length < 2) { setError('El fitxer sembla buit'); return }
      const [hdrs, ...dataRows] = data as string[][]
      setHeaders(hdrs)
      setRows(dataRows)
      setMapping(detectColumns(hdrs))
      setStep('columns')
      setError('')
    }
    reader.readAsArrayBuffer(file)
  }

  function handleContinueFromImport() {
    if (rows.length === 0) { setError('Selecciona un fitxer Excel primer'); return }
    setStep('columns')
  }

  function handleContinueFromColumns() {
    const uniqueVals = getUniqueTransportValues(rows, mapping.transport)
    const initial: Record<string, TransportRule> = {}
    for (const val of uniqueVals) {
      initial[val] = {
        usesBus: false,
        buses: buses.length > 0 ? [{ busId: buses[0].id, direction: 'ambdues' }] : [],
      }
    }
    setTransportRules(initial)
    setStep('transport')
    setError('')
  }

  function updateBusEntry(val: string, idx: number, patch: Partial<TransportBusEntry>) {
    setTransportRules(prev => ({
      ...prev,
      [val]: {
        ...prev[val],
        buses: prev[val].buses.map((b, i) => i === idx ? { ...b, ...patch } : b),
      },
    }))
  }

  function addBusEntry(val: string) {
    setTransportRules(prev => ({
      ...prev,
      [val]: {
        ...prev[val],
        buses: [...prev[val].buses, { busId: buses[0]?.id ?? 0, direction: 'ambdues' }],
      },
    }))
  }

  function removeBusEntry(val: string, idx: number) {
    setTransportRules(prev => ({
      ...prev,
      [val]: {
        ...prev[val],
        buses: prev[val].buses.filter((_, i) => i !== idx),
      },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const transportMapping: TransportMapping = {}
      for (const [val, rule] of Object.entries(transportRules)) {
        transportMapping[val] = { usesBus: rule.usesBus, buses: rule.usesBus ? rule.buses : [] }
      }

      await api.patch(`/api/events/${id}`, { column_mapping: mapping, transport_mapping: transportMapping })
      await api.post(`/api/events/${id}/participants/import`, { rows, column_mapping: mapping, transport_mapping: transportMapping })

      navigate(`/events/${id}/admin`)
    } catch (err) {
      setError('Error en guardar. Torna-ho a provar.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (!event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Carregant...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700">
          <ArrowLeft size={16} /> Tornar
        </button>
        <h1 className="text-xl font-bold text-gray-900 mb-1">{event.name}</h1>
        <p className="text-sm text-gray-500 mb-6">Configuració de la llista</p>

        <div className="flex items-center gap-2 mb-6 text-xs">
          {(['import', 'columns', 'transport'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-gray-200" />}
              <span className={`px-2 py-1 rounded-full font-medium ${step === s ? 'bg-blue-100 text-blue-700' : s < step ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {i + 1}. {s === 'import' ? 'Importar' : s === 'columns' ? 'Columnes' : 'Transport'}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Import */}
        {step === 'import' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <Upload size={32} className="mx-auto mb-3 text-gray-400" />
              <p className="text-sm font-medium text-gray-700 mb-1">Importar Excel</p>
              <p className="text-xs text-gray-400 mb-4">Fitxer .xlsx o .csv del Google Forms</p>
              <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Seleccionar fitxer
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              </label>
            </div>
            {rows.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3">
                <CheckCircle size={16} /> {rows.length} files detectades
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={handleContinueFromImport} className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-medium">
              Continuar →
            </button>
          </div>
        )}

        {/* Step 2: Column mapping */}
        {step === 'columns' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="font-medium text-gray-900 mb-3">Mapeig de columnes</h2>
              <p className="text-xs text-gray-500 mb-4">Comprova que les columnes s'han detectat correctament.</p>
              <div className="space-y-3">
                {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map(field => (
                  <div key={field} className="flex items-center gap-3">
                    <label className="text-sm text-gray-700 w-28 shrink-0">{FIELD_LABELS[field]}</label>
                    <select
                      value={mapping[field]}
                      onChange={e => setMapping(prev => ({ ...prev, [field]: Number(e.target.value) }))}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={-1}>— No utilitzar —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Previsualització (3 files)</p>
              <div className="space-y-1">
                {rows.slice(0, 3).map((row, i) => (
                  <div key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="font-medium">{row[mapping.firstName]} {row[mapping.lastName]}</span>
                    {mapping.nickname >= 0 && <span className="text-gray-400">({row[mapping.nickname]})</span>}
                    {mapping.transport >= 0 && <span className="text-blue-600 truncate">{row[mapping.transport]}</span>}
                  </div>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep('import')} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium">← Enrere</button>
              <button onClick={handleContinueFromColumns} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium">Continuar →</button>
            </div>
          </div>
        )}

        {/* Step 3: Transport mapping */}
        {step === 'transport' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="font-medium text-gray-900 mb-1">Mapeig de transport</h2>
              <p className="text-xs text-gray-500 mb-4">Per cada valor indica amb quin(s) bus(os) va.</p>
              <div className="space-y-4">
                {Object.entries(transportRules).map(([val, rule]) => (
                  <div key={val} className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-gray-800 truncate" title={val}>{val}</p>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={rule.usesBus}
                        onChange={e => setTransportRules(prev => ({
                          ...prev,
                          [val]: { ...prev[val], usesBus: e.target.checked }
                        }))}
                        className="rounded"
                      />
                      Va amb bus
                    </label>

                    {rule.usesBus && (
                      <div className="pl-5 space-y-2">
                        {rule.buses.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              value={entry.busId}
                              onChange={e => updateBusEntry(val, idx, { busId: Number(e.target.value) })}
                              className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs"
                            >
                              {buses.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                            </select>
                            <select
                              value={entry.direction}
                              onChange={e => updateBusEntry(val, idx, { direction: e.target.value as TransportBusEntry['direction'] })}
                              className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs"
                            >
                              {Object.entries(DIRECTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            {rule.buses.length > 1 && (
                              <button type="button" onClick={() => removeBusEntry(val, idx)} className="text-gray-400 hover:text-red-500">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addBusEntry(val)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                        >
                          <Plus size={12} /> Afegir bus
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep('columns')} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium">← Enrere</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardant...' : 'Importar participants ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
