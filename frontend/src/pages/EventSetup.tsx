import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { read, utils } from 'xlsx'
import { ArrowLeft, Upload, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { detectColumns, getUniqueTransportValues } from '../lib/excel'
import type { Event, Bus, ColumnMapping, TransportMapping } from '../types'

type Step = 'import' | 'columns' | 'transport'

interface TransportRule {
  usesBus: boolean
  busIds: number[]
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
    const defaultIds = (() => {
      const firstAnada = buses.find(b => b.direction === 'anada')
      const firstTornada = buses.find(b => b.direction === 'tornada')
      const ids: number[] = []
      if (firstAnada) ids.push(firstAnada.id)
      if (firstTornada) ids.push(firstTornada.id)
      if (ids.length === 0 && buses.length > 0) ids.push(buses[0].id)
      return ids
    })()
    const initial: Record<string, TransportRule> = {}
    for (const val of uniqueVals) {
      initial[val] = {
        usesBus: false,
        busIds: [...defaultIds],
      }
    }
    setTransportRules(initial)
    setStep('transport')
    setError('')
  }

  function updateBusEntry(val: string, idx: number, busId: number) {
    setTransportRules(prev => ({
      ...prev,
      [val]: {
        ...prev[val],
        busIds: prev[val].busIds.map((b, i) => i === idx ? busId : b),
      },
    }))
  }

  function addBusEntry(val: string) {
    setTransportRules(prev => ({
      ...prev,
      [val]: {
        ...prev[val],
        busIds: [...prev[val].busIds, buses[0]?.id ?? 0],
      },
    }))
  }

  function removeBusEntry(val: string, idx: number) {
    setTransportRules(prev => ({
      ...prev,
      [val]: {
        ...prev[val],
        busIds: prev[val].busIds.filter((_, i) => i !== idx),
      },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const transportMapping: TransportMapping = {}
      for (const [val, rule] of Object.entries(transportRules)) {
        if (rule.usesBus) {
          transportMapping[val] = {
            usesBus: true,
            buses: rule.busIds.map(busId => {
              const bus = buses.find(b => b.id === busId)
              return { busId, direction: bus?.direction ?? 'anada' }
            })
          }
        } else {
          transportMapping[val] = { usesBus: false, buses: [] }
        }
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-sagals/20 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-gray-900 truncate">{event.name}</h1>
        </div>
      </div>
      <div className="p-4">
        <div className="max-w-lg mx-auto">
          <p className="text-sm text-gray-500 mb-6">Configuració de la llista</p>

        <div className="flex items-center gap-2 mb-6 text-xs">
          {(['import', 'columns', 'transport'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-gray-200" />}
              <span className={`px-2 py-1 rounded-full font-medium ${step === s ? 'bg-sagals-light text-sagals-dark' : s < step ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
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
              <label className="cursor-pointer bg-sagals text-white px-4 py-2 rounded-lg text-sm font-medium">
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
            <button onClick={handleContinueFromImport} className="w-full bg-sagals text-white py-3 rounded-xl text-sm font-medium">
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
                      className="w-48 shrink-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sagals"
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
                    {mapping.transport >= 0 && <span className="text-sagals-dark truncate">{row[mapping.transport]}</span>}
                  </div>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep('import')} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium">← Enrere</button>
              <button onClick={handleContinueFromColumns} className="flex-1 bg-sagals text-white py-3 rounded-xl text-sm font-medium">Continuar →</button>
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
                        {rule.busIds.map((busId, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              value={busId}
                              onChange={e => updateBusEntry(val, idx, Number(e.target.value))}
                              className="shrink-0 border border-gray-200 rounded px-2 py-1 text-xs"
                            >
                              {buses.map(b => <option key={b.id} value={b.id}>{b.label} · {DIRECTION_LABELS[b.direction]}</option>)}
                            </select>
                            {rule.busIds.length > 1 && (
                              <button type="button" onClick={() => removeBusEntry(val, idx)} className="text-gray-400 hover:text-red-500">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addBusEntry(val)}
                          className="flex items-center gap-1 text-xs text-sagals-dark hover:text-sagals"
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
    </div>
  )
}
