import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { addBus, removeBus, updateBus, type BusDraft } from '../lib/buses'
import type { TenimaletaForm, TenimaletaFormResponse, TenimaletaCasteller, Event, Bus, TransportBusEntry, FormMapping } from '../types'

type Step = 'select-form' | 'questions' | 'buses' | 'transport'

interface DraftBusRef {
  busIndex: number
}

interface TransportRule {
  usesBus: boolean
  buses: DraftBusRef[]
}

const DIRECTION_LABELS = {
  anada: 'Anada',
  tornada: 'Tornada',
}

function detectTransportQuestion(elements: TenimaletaForm['elements']): string {
  return elements.filter(el => {
    const q = el.content.question.toLowerCase()
    return (el.type === 'checkbox' || el.type === 'multiple-choice') &&
      (q.includes('bus') || q.includes('autobús') || q.includes('transport'))
  })[0]?.id ?? ''
}

function detectTextQuestion(elements: TenimaletaForm['elements'], keywords: string[]): string {
  return elements.filter(el => {
    const q = el.content.question.toLowerCase()
    return (el.type === 'paragraph' || el.type === 'short-answer') &&
      keywords.some(k => q.includes(k))
  })[0]?.id ?? ''
}

function getOptionLabels(elements: TenimaletaForm['elements'], questionId: string): Record<string, string> {
  const el = elements.find(e => e.id === questionId)
  if (!el || !el.content.options) return {}
  const opts = el.content.options
  const result: Record<string, string> = {}
  opts.forEach((opt, i) => {
    result[String(i)] = typeof opt === 'string' ? opt : opt.text
  })
  return result
}

function getUniqueTransportValues(
  responses: Record<string, TenimaletaFormResponse>,
  questionId: string,
  elements: TenimaletaForm['elements']
): string[] {
  const optLabels = getOptionLabels(elements, questionId)
  const values = new Set<string>()
  for (const resp of Object.values(responses)) {
    const raw = resp[questionId]
    if (raw === undefined || raw === null || raw === '') continue
    if (typeof raw === 'number') {
      const label = optLabels[String(raw)]
      if (label) values.add(label)
    } else if (typeof raw === 'string') {
      values.add(raw)
    } else if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'number') {
          const label = optLabels[String(item)]
          if (label) values.add(label)
        } else if (typeof item === 'string') {
          values.add(item)
        }
      }
    } else if (typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v !== undefined && v !== null && v !== '' && v !== 0) {
          const label = optLabels[k]
          if (label) values.add(label)
        }
      }
    }
  }
  return Array.from(values).map(v => v.trim()).sort()
}

function resolveTransportValue(raw: unknown, optLabels: Record<string, string>): string {
  if (typeof raw === 'number') return optLabels[String(raw)] ?? String(raw)
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) {
    return raw.map(item => {
      if (typeof item === 'number') return optLabels[String(item)] ?? String(item)
      return String(item)
    }).join(', ')
  }
  if (typeof raw === 'object' && raw !== null) {
    const labels: string[] = []
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v !== undefined && v !== null && v !== '' && v !== 0) {
        labels.push(optLabels[k] ?? k)
      }
    }
    return labels.join(', ')
  }
  return ''
}

function defaultBusRefs(busList: { direction: string }[]): DraftBusRef[] {
  if (busList.length === 0) return []
  const firstAnada = busList.findIndex(b => b.direction === 'anada')
  const firstTornada = busList.findIndex(b => b.direction === 'tornada')
  const refs: DraftBusRef[] = []
  if (firstAnada >= 0) refs.push({ busIndex: firstAnada })
  if (firstTornada >= 0) refs.push({ busIndex: firstTornada })
  if (refs.length === 0) refs.push({ busIndex: 0 })
  return refs
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

const FIELD_LABELS: Record<string, string> = {
  transport: 'Transport',
  observations: 'Observacions',
  companions: 'Acompanyants',
}

export default function FormImport() {
  const { id: existingEventId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isExistingEvent = !!existingEventId

  const [step, setStep] = useState<Step>('select-form')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [forms, setForms] = useState<Record<string, TenimaletaForm>>({})
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
  const [responses, setResponses] = useState<Record<string, TenimaletaFormResponse>>({})
  const [castellers, setCastellers] = useState<Record<string, TenimaletaCasteller>>({})

  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [existingEvent, setExistingEvent] = useState<Event | null>(null)
  const [existingBuses, setExistingBuses] = useState<Bus[]>([])

  const [transportQId, setTransportQId] = useState('')
  const [observationsQId, setObservationsQId] = useState<string | null>(null)
  const [companionsQId, setCompanionsQId] = useState<string | null>(null)

  const [buses, setBuses] = useState<BusDraft[]>([])
  const [pendingBuses, setPendingBuses] = useState<(BusDraft & { id: number; event_id: number; order: number })[]>([])
  const [transportRules, setTransportRules] = useState<Record<string, TransportRule>>({})

  const [previewData, setPreviewData] = useState<{ nickname: string; firstName: string; lastName: string; transport: string }[]>([])

  useEffect(() => {
    if (isExistingEvent && existingEventId) {
      Promise.all([
        api.get<{ data: Event }>(`/api/events/${existingEventId}`).then(r => r.data),
        api.get<{ data: Bus[] }>(`/api/events/${existingEventId}/buses`).then(r => r.data),
        api.get<{ data: Record<string, TenimaletaForm> }>('/api/tenimaleta/forms').then(r => r.data),
      ]).then(([ev, bs, formsData]) => {
        setExistingEvent(ev)
        setExistingBuses(bs)
        setForms(formsData)
        setEventName(ev.name)
        setEventDate(ev.date)
        if (ev.form_id) {
          setSelectedFormId(String(ev.form_id))
          const f = formsData[String(ev.form_id)]
          if (f) {
            const fm = ev.form_mapping as FormMapping | null
            if (fm) {
              setTransportQId(fm.transport_question_id)
              setObservationsQId(fm.observations_question_id ?? null)
              setCompanionsQId(fm.companions_question_id ?? null)
            } else {
              setTransportQId(detectTransportQuestion(f.elements))
              setObservationsQId(detectTextQuestion(f.elements, ['bservacions', 'aspectes', 'comentar', 'al·lèrg', 'intoleràncies']) || null)
              setCompanionsQId(detectTextQuestion(f.elements, ['companyant', 'acompañant', 'acompany']) || null)
            }
            Promise.all([
              api.get<{ data: Record<string, TenimaletaFormResponse> }>(`/api/tenimaleta/forms/${ev.form_id}/responses`),
              api.get<{ data: Record<string, TenimaletaCasteller> }>('/api/tenimaleta/castellers'),
            ]).then(([resRes, castRes]) => {
              setResponses(resRes.data)
              setCastellers(castRes.data)
              setLoading(false)
              if (fm) {
                const busList = bs
                const uniqueVals = getUniqueTransportValues(resRes.data, fm.transport_question_id, f.elements.filter(e => !e.isComprovant && e.type !== 'image' && e.type !== 'image-upload' && e.type !== 'text' && e.type !== 'copiable-text' && !(e.type === 'ticket-v2-single' || e.type === 'ticket-v2' || e.type === 'ticket' || e.type === 'ticket-v2')))
                const optLabels = getOptionLabels(f.elements, fm.transport_question_id)
                const initial: Record<string, TransportRule> = {}
                for (const val of uniqueVals) {
                  const lower = val.toLowerCase()
                  const usesBus = !(lower.includes('no vinc') || lower.includes('propi') || lower.includes('propio') || lower.includes('no vaig'))
                  const optionMapping = fm.transport_option_mapping?.[val] || fm.transport_option_mapping?.[val.trim()] || fm.transport_option_mapping?.[val + ' ']
                  initial[val] = {
                    usesBus: usesBus,
                    buses: optionMapping ? optionMapping.map(om => ({ busIndex: busList.findIndex(b => b.id === om.bus_id) })).filter(r => r.busIndex >= 0) : (usesBus ? defaultBusRefs(busList) : []),
                  }
                }
                setTransportRules(initial)
                const preview = Object.entries(resRes.data).slice(0, 5).map(([_id, resp]) => {
                  const casteller = castRes.data[_id] ?? {}
                  const nickname = resp.mote || ''
                  const firstName = casteller.nom || nickname || ''
                  const lastName = casteller.cognom || ''
                  const rawTransport = resp[fm.transport_question_id]
                  const transportLabel = resolveTransportValue(rawTransport, optLabels)
                  return { nickname, firstName, lastName, transport: transportLabel }
                })
                setPreviewData(preview)
                setPendingBuses(bs.map((b, i) => ({ ...b, order: i })))
                setStep('transport')
              } else {
                setStep('questions')
              }
            }).catch(() => {
              setError('No es poden carregar les respostes')
              setLoading(false)
            })
          } else {
            setLoading(false)
          }
        } else {
          setLoading(false)
        }
      }).catch(() => {
        setError('No es poden carregar les dades')
        setLoading(false)
      })
    } else {
      api.get<{ data: Record<string, TenimaletaForm> }>('/api/tenimaleta/forms')
        .then(res => { setForms(res.data); setLoading(false) })
        .catch(() => { setError('No es poden carregar els formularis'); setLoading(false) })
    }
  }, [isExistingEvent, existingEventId])

  const form = selectedFormId ? forms[selectedFormId] : null
  const formElements = form?.elements?.filter(e => !e.isComprovant && e.type !== 'image' && e.type !== 'image-upload' && e.type !== 'text' && e.type !== 'copiable-text' && !(e.type === 'ticket-v2-single' || e.type === 'ticket-v2' || e.type === 'ticket' || e.type === 'ticket-v2')) ?? []

  function selectForm(formId: string) {
    setSelectedFormId(formId)
    const f = forms[formId]
    if (!f) return
    if (!isExistingEvent) setEventName(f.title || `Formulari ${formId}`)

    const autoTransport = detectTransportQuestion(f.elements)
    const autoObs = detectTextQuestion(f.elements, ['bservacions', 'aspectes', 'comentar', 'al·lèrg', 'intoleràncies'])
    const autoComp = detectTextQuestion(f.elements, ['companyant', 'acompañant', 'acompany'])

    setTransportQId(autoTransport)
    setObservationsQId(autoObs || null)
    setCompanionsQId(autoComp || null)

    Promise.all([
      api.get<{ data: Record<string, TenimaletaFormResponse> }>(`/api/tenimaleta/forms/${formId}/responses`),
      api.get<{ data: Record<string, TenimaletaCasteller> }>('/api/tenimaleta/castellers'),
    ]).then(([resRes, castRes]) => {
      setResponses(resRes.data)
      setCastellers(castRes.data)
      setStep('questions')
    }).catch(() => setError('No es poden carregar les respostes'))
  }

  function handleContinueFromQuestions() {
    if (!transportQId) { setError('Selecciona la pregunta de transport'); return }
    setError('')
    if (isExistingEvent) {
      const busList = existingBuses
      const uniqueVals = getUniqueTransportValues(responses, transportQId, formElements)
      const initial: Record<string, TransportRule> = {}
      for (const val of uniqueVals) {
        const lower = val.toLowerCase()
        const usesBus = !(lower.includes('no vinc') || lower.includes('propi') || lower.includes('propio') || lower.includes('no vaig'))
        initial[val] = {
          usesBus,
          buses: usesBus && busList.length > 0 ? defaultBusRefs(busList) : [],
        }
      }
      setTransportRules(initial)
      const preview = Object.entries(responses).slice(0, 5).map(([_id, resp]) => {
        const casteller = castellers[_id] ?? {}
        const nickname = resp.mote || ''
        const firstName = casteller.nom || nickname || ''
        const lastName = casteller.cognom || ''
        const rawTransport = resp[transportQId]
        const optLabels = getOptionLabels(formElements, transportQId)
        const transportLabel = resolveTransportValue(rawTransport, optLabels)
        return { nickname, firstName, lastName, transport: transportLabel }
      })
      setPreviewData(preview)
      setPendingBuses(existingBuses.map((b, i) => ({ ...b, order: i })))
      setStep('transport')
    } else {
      setStep('buses')
    }
  }

  function handleContinueFromBuses() {
    if (buses.length === 0 && !isExistingEvent) { setError('Afegeix almenys un bus'); return }
    setError('')

    const busList = isExistingEvent ? existingBuses : buses.map((b, i) => ({ ...b, id: -(i + 1), event_id: 0, order: i }))
    const uniqueVals = getUniqueTransportValues(responses, transportQId, formElements)
    const initial: Record<string, TransportRule> = {}
    for (const val of uniqueVals) {
      const lower = val.toLowerCase()
      const usesBus = !(lower.includes('no vinc') || lower.includes('propi') || lower.includes('propio') || lower.includes('no vaig'))
      initial[val] = {
        usesBus,
        buses: usesBus && busList.length > 0 ? defaultBusRefs(busList) : [],
      }
    }
    setTransportRules(initial)

    const preview = Object.entries(responses).slice(0, 5).map(([_id, resp]) => {
      const casteller = castellers[_id] ?? {}
      const nickname = resp.mote || ''
      const firstName = casteller.nom || nickname || ''
      const lastName = casteller.cognom || ''
      const rawTransport = resp[transportQId]
      const optLabels = getOptionLabels(formElements, transportQId)
      const transportLabel = resolveTransportValue(rawTransport, optLabels)
      return { nickname, firstName, lastName, transport: transportLabel }
    })
    setPreviewData(preview)
    setPendingBuses(busList)
    setStep('transport')
  }

  function updateBusEntry(val: string, idx: number, patch: Partial<DraftBusRef>) {
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
        buses: [...prev[val].buses, { busIndex: 0 }],
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

  async function handleImport() {
    if (!selectedFormId) return
    if (!isExistingEvent && !eventName.trim()) { setError('El nom de l\'actuació és obligatori'); return }
    setSaving(true)
    setError('')

    try {
      let event: Event
      let busList: Bus[]

      if (isExistingEvent && existingEvent) {
        event = existingEvent
        busList = existingBuses
      } else {
        let createdEvent: Event | null = null
        for (let attempt = 0; attempt < 10; attempt++) {
          const slug = generateSlug(eventName, attempt > 0 ? String(attempt + 1) : '')
          try {
            const res = await api.post<{ data: Event }>('/api/events', {
              name: eventName,
              date: eventDate || '2026-01-01',
              slug,
              status: 'draft',
              column_mapping: {},
              transport_mapping: {},
            })
            createdEvent = res.data
            break
          } catch (err) {
            if (!isSlugConflict(err) || attempt === 9) throw err
          }
        }
        if (!createdEvent) throw new Error('No s\'ha pogut crear l\'event')
        event = createdEvent

        busList = []
        for (let i = 0; i < buses.length; i++) {
          const res = await api.post<{ data: Bus }>(`/api/events/${event.id}/buses`, { ...buses[i], order: i })
          busList.push(res.data)
        }
      }

      const transportMapping: Record<string, { usesBus: boolean; buses: TransportBusEntry[] }> = {}
      for (const [val, rule] of Object.entries(transportRules)) {
        if (rule.usesBus) {
          const mappedBuses: TransportBusEntry[] = rule.buses.map(ref => {
            const bus = busList[ref.busIndex]
            return { busId: bus.id, direction: bus.direction }
          })
          transportMapping[val] = { usesBus: true, buses: mappedBuses }
        } else {
          transportMapping[val] = { usesBus: false, buses: [] }
        }
      }

      const optLabels = getOptionLabels(formElements, transportQId)

      const rows: { first_name: string; last_name: string; last_name2: string; nickname: string; transport_raw: string; observations: string; companions: string }[] = []

      for (const [castellerId, resp] of Object.entries(responses)) {
        const casteller = castellers[castellerId] ?? {}
        const nickname = resp.mote || ''
        const firstName = casteller.nom || nickname || ''
        const lastName = casteller.cognom || ''
        const last_name2 = casteller.segon_cognom || ''

        if (!firstName && !nickname) continue

        const rawTransport = resp[transportQId]
        const transportRaw = resolveTransportValue(rawTransport, optLabels)

        const rawObs = observationsQId ? resp[observationsQId] : undefined
        const observations = resolveTransportValue(rawObs, getOptionLabels(formElements, observationsQId ?? ''))

        const rawComp = companionsQId ? resp[companionsQId] : undefined
        const companions = resolveTransportValue(rawComp, getOptionLabels(formElements, companionsQId ?? ''))

        rows.push({ first_name: firstName, last_name: lastName, last_name2, nickname, transport_raw: transportRaw, observations, companions })
      }

      const columnMapping = { firstName: 0, lastName: 1, last_name2: 2, nickname: 3, transport: 4, observations: 5, companions: 6 }

      await api.patch(`/api/events/${event.id}`, {
        form_id: Number(selectedFormId),
        form_mapping: {
          transport_question_id: transportQId,
          observations_question_id: observationsQId,
          companions_question_id: companionsQId,
          transport_option_mapping: Object.fromEntries(
            Object.entries(transportRules).map(([k, v]) => [k, v.buses.map(b => {
              const bus = busList[b.busIndex]
              return { bus_id: bus.id, direction: bus.direction }
            })])
          ),
        },
      })

      await api.post(`/api/events/${event.id}/participants/import`, {
        rows,
        column_mapping: columnMapping,
        transport_mapping: transportMapping,
      })

      navigate(`/events/${event.id}/admin`)
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { errors?: Record<string, string[]> } }
      const detail = e.data?.errors ? Object.entries(e.data.errors).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') : (err as { message?: string })?.message ?? String(err)
      setError(`Error: ${detail}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} /> Carregant...
      </div>
    )
  }

  const formEntries = Object.entries(forms)
    .filter(([, f]) => !f.hidden && f.elements && f.elements.length > 0)
    .sort(([, a], [, b]) => {
      const dateA = a.closingDate ? new Date(a.closingDate).getTime() : 0
      const dateB = b.closingDate ? new Date(b.closingDate).getTime() : 0
      return dateB - dateA
    })

  const busOptions = isExistingEvent ? existingBuses : pendingBuses

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-sagals px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <button onClick={() => {
            if (step === 'questions') setStep('select-form')
            else if (step === 'buses') setStep('questions')
            else if (step === 'transport') setStep(isExistingEvent ? 'questions' : 'buses')
            else navigate(isExistingEvent ? `/events/${existingEventId}/admin` : '/')
          }} className="text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-white truncate">Importar des de formulari</h1>
        </div>
      </div>

      <div className="p-4">
        <div className="max-w-lg mx-auto">

          <div className="flex items-center gap-2 mb-6 text-xs">
            {([isExistingEvent ? 'select-form' : 'select-form', 'questions', ...(isExistingEvent ? [] : ['buses']), 'transport'] as Step[]).map((s, i, arr) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px bg-gray-200" />}
                <span className={`px-2 py-1 rounded-full font-medium ${
                  step === s ? 'bg-sagals-light text-sagals-dark' :
                  arr.indexOf(step) > i ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {s === 'select-form' ? '1. Formulari' : s === 'questions' ? '2. Preguntes' : s === 'buses' ? '3. Busos' : `${arr.length}. Transport`}
                </span>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          {step === 'select-form' && (
            <div className="space-y-2">
              {isExistingEvent && existingEvent && (
                <div className="bg-sagals-light border border-sagals/20 rounded-xl p-4 mb-4">
                  <p className="font-medium text-sagals-dark">Actuació: {existingEvent.name}</p>
                  <p className="text-xs text-sagals-dark/70 mt-1">
                    {new Date(existingEvent.date + 'T12:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · '}{existingBuses.length} busos
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-500">Selecciona un formulari de Tenimaleta per importar les respostes:</p>
              {formEntries.map(([id, f]) => (
                <button
                  key={id}
                  onClick={() => selectForm(id)}
                  className="w-full bg-white rounded-xl border border-gray-100 p-4 text-left hover:border-sagals transition-colors shadow-sm"
                >
                  <p className="font-semibold text-gray-900">{f.title || `Formulari ${id}`}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {f.closingDate ? `Tanca: ${new Date(f.closingDate).toLocaleDateString('ca-ES')}` : 'Sense data de tancament'}
                    {' · '}{f.elements?.length ?? 0} preguntes
                  </p>
                </button>
              ))}
            </div>
          )}

          {step === 'questions' && form && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <h2 className="font-medium text-gray-900">{form.title || `Formulari ${selectedFormId}`}</h2>
                <p className="text-xs text-gray-500">{Object.keys(responses).length} respostes</p>

                {!isExistingEvent && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'actuació</label>
                      <input
                        type="text"
                        value={eventName}
                        onChange={e => setEventName(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sagals"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                      <input
                        type="date"
                        value={eventDate}
                        onChange={e => setEventDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sagals"
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <h2 className="font-medium text-gray-900 mb-1">Mapeig de preguntes</h2>
                <p className="text-xs text-gray-500 mb-3">Selecciona quina pregunta correspon a cada camp.</p>

                {(['transport', 'observations', 'companions'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {FIELD_LABELS[field]}
                      {field === 'transport' && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <select
                      value={field === 'transport' ? transportQId : field === 'observations' ? (observationsQId ?? '') : (companionsQId ?? '')}
                      onChange={e => {
                        if (field === 'transport') setTransportQId(e.target.value)
                        else if (field === 'observations') setObservationsQId(e.target.value || null)
                        else setCompanionsQId(e.target.value || null)
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sagals"
                    >
                      <option value="">— {field === 'transport' ? 'Selecciona' : 'Cap'} —</option>
                      {formElements.map(el => (
                        <option key={el.id} value={el.id}>{el.content.question}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <button onClick={handleContinueFromQuestions} className="w-full bg-sagals text-white py-3 rounded-xl text-sm font-medium">
                Continuar →
              </button>
            </div>
          )}

          {step === 'buses' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <h2 className="font-medium text-gray-900">Busos</h2>
                <p className="text-xs text-gray-500">Afegeix els busos per a aquesta actuació.</p>

                {buses.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    Cap bus afegit encara
                  </p>
                )}

                <div className="space-y-3">
                  {buses.map((bus, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Bus {i + 1}</span>
                        <button type="button" onClick={() => setBuses(prev => removeBus(prev, i))} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={bus.label}
                          onChange={e => setBuses(prev => updateBus(prev, i, { label: e.target.value }))}
                          placeholder="Bus 1 · Sortida 8:00h"
                          className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
                        />
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={bus.departure_time}
                            onChange={e => setBuses(prev => updateBus(prev, i, { departure_time: e.target.value }))}
                            className="border border-gray-200 rounded px-2 py-1 text-sm bg-white flex-1"
                          />
                          <select
                            value={bus.direction}
                            onChange={e => setBuses(prev => updateBus(prev, i, { direction: e.target.value as BusDraft['direction'] }))}
                            className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
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

                <button
                  type="button"
                  onClick={() => setBuses(prev => addBus(prev))}
                  className="flex items-center gap-1 text-sm text-sagals-dark hover:text-sagals"
                >
                  <Plus size={14} /> Afegir bus
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('questions')} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium">← Enrere</button>
                <button onClick={handleContinueFromBuses} disabled={saving || buses.length === 0} className="flex-1 bg-sagals text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50">
                  {saving ? 'Guardant...' : 'Continuar →'}
                </button>
              </div>
            </div>
          )}

          {step === 'transport' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="font-medium text-gray-900 mb-1">Mapeig de transport</h2>
                <p className="text-xs text-gray-500 mb-4">Per cada valor indica amb quin(s) bus(os) va.</p>
                <div className="space-y-4">
                  {Object.entries(transportRules).map(([val, rule]) => (
                    <div key={val} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium text-gray-800" title={val}>{val}</p>
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={rule.usesBus}
                          onChange={e => setTransportRules(prev => ({
                            ...prev,
                            [val]: { ...prev[val], usesBus: e.target.checked }
                          }))}
                          className="rounded accent-sagals"
                        />
                        Va amb bus
                      </label>

                      {rule.usesBus && (
                        <div className="pl-5 space-y-2">
                          {rule.buses.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <select
                                value={entry.busIndex}
                                onChange={e => updateBusEntry(val, idx, { busIndex: Number(e.target.value) })}
                                className="shrink-0 border border-gray-200 rounded px-2 py-1 text-xs"
                              >
                                {busOptions.map((b, bi) => <option key={bi} value={bi}>{b.label || `Bus ${bi + 1}`} · {DIRECTION_LABELS[b.direction]}</option>)}
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

              {previewData.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Previsualització ({Object.keys(responses).length} participants)</p>
                  <div className="space-y-1">
                    {previewData.map((p, i) => (
                      <div key={i} className="text-xs text-gray-600 flex gap-2">
                        <span className="font-medium">{p.nickname || `${p.firstName} ${p.lastName}`}</span>
                        {p.transport && <span className="text-sagals-dark">{p.transport}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(isExistingEvent ? 'questions' : 'buses')} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium">← Enrere</button>
                <button type="button" onClick={handleImport} disabled={saving} className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50">
                  {saving ? 'Important...' : `Importar ${Object.keys(responses).length} participants ✓`}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}