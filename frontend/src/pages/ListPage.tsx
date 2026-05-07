import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Users, MessageSquare } from 'lucide-react'
import { api } from '../lib/api'
import { connectSocket, joinAttendanceChannel, disconnectSocket } from '../lib/socket'
import type { Bus, TripWithAttendance } from '../types'

const DIR: Record<string, string> = { anada: 'Anada', tornada: 'Tornada' }

type Casteller = { id: number; mote: string | null }

function participantName(p: TripWithAttendance['participant']): string {
  const full = [p.first_name, p.last_name, p.last_name2].filter(Boolean).join(' ')
  if (p.nickname) return `${p.nickname} (${full})`
  return full
}

function Avatar({
  participant,
  status,
  photo,
  onPhotoClick,
}: {
  participant: TripWithAttendance['participant']
  status: string
  photo?: string
  onPhotoClick?: (e: React.MouseEvent) => void
}) {
  const ring =
    status === 'present' ? 'ring-2 ring-green-500' :
    status === 'absent'  ? 'ring-2 ring-red-500' :
    'ring-1 ring-gray-200'

  if (photo) {
    return (
      <div
        className={`w-9 h-9 rounded-full overflow-hidden shrink-0 ${ring} cursor-zoom-in`}
        onClick={onPhotoClick}
      >
        <img src={photo} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
      status === 'present' ? 'bg-green-500 text-white' :
      status === 'absent'  ? 'bg-red-500 text-white' :
      'bg-gray-100 text-gray-500'
    }`}>
      {status === 'present' ? '✓' :
       status === 'absent'  ? '✗' :
       (participant.first_name[0] ?? '?').toUpperCase()}
    </div>
  )
}

function SectionHeader({
  label,
  count,
  collapsed,
  color,
  stickyTop,
  onToggle,
}: {
  label: string
  count: number
  collapsed: boolean
  color: 'pendent' | 'present' | 'absent'
  stickyTop: number
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      style={{ top: stickyTop }}
      className="sticky z-[5] w-full flex items-center justify-between py-2.5 px-1 text-left bg-gray-50"
    >
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
        color === 'pendent' ? 'bg-yellow-100 text-yellow-700' :
        color === 'present' ? 'bg-green-100 text-green-700' :
        'bg-red-100 text-red-700'
      }`}>
        {label} · {count}
      </span>
      <span className={`text-xs text-gray-400`}>{collapsed ? '▶' : '▼'}</span>
    </button>
  )
}

const STATUS_ACTIONS = [
  { status: 'present', label: 'Present',    active: 'bg-green-500 text-white', idle: 'border border-green-300 text-green-700' },
  { status: 'absent',  label: 'Absent',   active: 'bg-red-500 text-white',   idle: 'border border-red-300 text-red-700' },
  { status: 'pendent', label: 'Pendent', active: 'bg-gray-400 text-white',  idle: 'border border-gray-200 text-gray-500' },
] as const

function TripRow({
  t,
  photo,
  isActive,
  onToggle,
  onMark,
  onPhotoClick,
}: {
  t: TripWithAttendance
  photo?: string
  isActive: boolean
  onToggle: () => void
  onMark: (status: 'present' | 'absent' | 'pendent') => void
  onPhotoClick?: (e: React.MouseEvent) => void
}) {
  const cur = t.attendance.status
  return (
    <div
      onClick={onToggle}
      className={`rounded-xl border cursor-pointer select-none transition-colors ${
        isActive
          ? 'bg-white border-sagals shadow-sm'
          : cur === 'present' ? 'bg-green-50 border-green-200'
          : cur === 'absent'  ? 'bg-red-50 border-red-200'
          : 'bg-white border-gray-100'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <Avatar
          participant={t.participant}
          status={cur}
          photo={photo}
          onPhotoClick={photo ? onPhotoClick : undefined}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">
            {participantName(t.participant)}
          </p>
          {(t.participant.companions || t.participant.observations) && (
            <div className="flex items-center gap-2 mt-0.5">
              {t.participant.companions && (
                <span className="text-xs text-amber-600 flex items-center gap-0.5 truncate">
                  <Users size={10} className="shrink-0" />{t.participant.companions}
                </span>
              )}
              {t.participant.observations && (
                <span className="text-xs text-amber-600 flex items-center gap-0.5 truncate">
                  <MessageSquare size={10} className="shrink-0" />{t.participant.observations}
                </span>
              )}
            </div>
          )}
        </div>
        <span className={`text-xs font-medium shrink-0 ${
          cur === 'present' ? 'text-green-700' :
          cur === 'absent'  ? 'text-red-700' : 'text-gray-400'
        }`}>
          {cur === 'present' ? 'Present' : cur === 'absent' ? 'Absent' : 'Pendent'}
        </span>
      </div>

      {isActive && (
        <div
          className="flex gap-2 px-3 pb-3"
          onClick={e => e.stopPropagation()}
        >
          {STATUS_ACTIONS.map(({ status, label, active, idle }) => (
            <button
              key={status}
              onClick={() => onMark(status)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                cur === status ? active : `${idle} bg-white`
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ListPage() {
  useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const accessToken = searchParams.get('t')

  const [listToken, setListToken] = useState<string | null>(null)
  const [buses, setBuses] = useState<Bus[]>([])
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null)
  const [selectedDirection, setSelectedDirection] = useState<'anada' | 'tornada' | null>(null)
  const [trips, setTrips] = useState<TripWithAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modalPhoto, setModalPhoto] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [activeTripId, setActiveTripId] = useState<number | null>(null)
  const [headerH, setHeaderH] = useState(0)
  const headerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (headerRef.current) setHeaderH(headerRef.current.offsetHeight)
  }, [selectedBusId, selectedDirection])

  const [castellerMap, setCastellerMap] = useState<Map<string, number>>(new Map())
  const [photoCache, setPhotoCache] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    if (!accessToken) { setError('Falta el token d\'accés'); setLoading(false); return }
    api.post<{ token: string }>('/api/auth/exchange', { access_token: accessToken }, null)
      .then(res => setListToken(res.token))
      .catch(() => { setError('Enllaç no vàlid o caducat'); setLoading(false) })
  }, [accessToken])

  useEffect(() => {
    if (!listToken) return
    Promise.all([
      api.get<{ data: Bus[] }>('/api/list/buses', listToken),
      api.get<{ data: Casteller[] }>('/api/list/castellers', listToken),
    ]).then(([busRes, castellerRes]) => {
      setBuses(busRes.data)
      const map = new Map<string, number>()
      castellerRes.data.forEach(c => {
        if (c.mote) map.set(c.mote.toLowerCase().trim(), c.id)
      })
      setCastellerMap(map)
      setLoading(false)
    }).catch(() => { setError('Error carregant dades'); setLoading(false) })
  }, [listToken])

  useEffect(() => {
    if (!listToken || selectedBusId === null || selectedDirection === null) return
    setTrips([])
    api.get<{ data: TripWithAttendance[] }>(`/api/list/buses/${selectedBusId}/${selectedDirection}`, listToken)
      .then(res => setTrips(res.data))
  }, [listToken, selectedBusId, selectedDirection])

  useEffect(() => {
    if (!listToken || trips.length === 0 || castellerMap.size === 0) return
    const needed = trips
      .map(t => {
        const key = t.participant.nickname?.toLowerCase().trim()
        return key ? castellerMap.get(key) : undefined
      })
      .filter((id): id is number => id !== undefined && !photoCache.has(id))
      .filter((id, i, arr) => arr.indexOf(id) === i)
    if (needed.length === 0) return
    Promise.all(
      needed.map(id =>
        api.get<{ base64: string }>(`/api/list/profile_pic/${id}`, listToken)
          .then(res => [id, res.base64] as const)
          .catch(() => null)
      )
    ).then(results => {
      const valid = results.filter((r): r is [number, string] => r !== null)
      if (valid.length === 0) return
      setPhotoCache(prev => {
        const next = new Map(prev)
        valid.forEach(([id, base64]) => next.set(id, base64))
        return next
      })
    })
  }, [trips, castellerMap, listToken])

  useEffect(() => {
    if (!listToken) return
    connectSocket(listToken)
    return () => disconnectSocket()
  }, [listToken])

  useEffect(() => {
    if (!listToken || selectedBusId === null || selectedDirection === null) return
    const channel = joinAttendanceChannel(selectedBusId, selectedDirection, (update) => {
      setTrips(prev => prev.map(t =>
        t.trip_id === update.trip_id
          ? { ...t, attendance: { id: null, status: update.status, marked_at: update.marked_at, marked_by: update.marked_by } }
          : t
      ))
    })
    return () => { channel.leave() }
  }, [listToken, selectedBusId, selectedDirection])

  async function handleMark(tripId: number, status: 'present' | 'absent' | 'pendent') {
    if (!listToken) return
    setTrips(prev => prev.map(t =>
      t.trip_id === tripId ? { ...t, attendance: { ...t.attendance, status } } : t
    ))
    try {
      await api.post('/api/list/attendance', { trip_id: tripId, status }, listToken)
    } catch {
      // Channel broadcast will correct state if needed
    }
  }

  function selectBus(bus: Bus, direction: 'anada' | 'tornada') {
    setSelectedBusId(bus.id)
    setSelectedDirection(direction)
  }

  function goBack() {
    setSelectedBusId(null)
    setSelectedDirection(null)
    setTrips([])
    setSearch('')
    setActiveTripId(null)
  }

  function handleSearch(value: string) {
    setSearch(value)
    if (value) {
      const q = value.toLowerCase()
      const hitStatuses = new Set(
        trips
          .filter(t => {
            const { first_name, last_name, last_name2, nickname } = t.participant
            return [first_name, last_name, last_name2, nickname].some(s => s?.toLowerCase().includes(q))
          })
          .map(t => t.attendance.status)
      )
      setCollapsed(prev => {
        const next = new Set(prev)
        hitStatuses.forEach(s => next.delete(s))
        return next
      })
    }
  }

  function getPhoto(participant: TripWithAttendance['participant']): string | undefined {
    const key = participant.nickname?.toLowerCase().trim()
    const id = key ? castellerMap.get(key) : undefined
    return id !== undefined ? photoCache.get(id) : undefined
  }

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <p className="text-red-600 text-sm text-center">{error}</p>
    </div>
  )

  if (loading || !listToken) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
      Carregant...
    </div>
  )

  const filtered = trips.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    const { first_name, last_name, last_name2, nickname } = t.participant
    return [first_name, last_name, last_name2, nickname].some(s => s?.toLowerCase().includes(q))
  })

  const pendents = filtered.filter(t => t.attendance.status === 'pendent')
  const presents = filtered.filter(t => t.attendance.status === 'present')
  const absents  = filtered.filter(t => t.attendance.status === 'absent')

  const totalPresents = trips.filter(t => t.attendance.status === 'present').length

  if (selectedBusId === null) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Passar llista — Sagals d'Osona</h1>
          <p className="text-sm text-gray-500 mb-6">Selecciona el teu bus</p>
          <div className="space-y-3">
            {buses.map(bus => {
              const dirs = bus.direction === 'ambdues'
                ? (['anada', 'tornada'] as const)
                : ([bus.direction] as ('anada' | 'tornada')[])
              return dirs.map(dir => (
                <button
                  key={`${bus.id}-${dir}`}
                  onClick={() => selectBus(bus, dir)}
                  className="w-full bg-white rounded-xl border border-gray-100 p-4 text-left hover:border-sagals-light transition-colors shadow-sm"
                >
                  <p className="font-semibold text-gray-900">{bus.label}</p>
                  <p className="text-sm text-gray-500">{DIR[dir]}</p>
                </button>
              ))
            })}
          </div>
        </div>
      </div>
    )
  }

  const currentBus = buses.find(b => b.id === selectedBusId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header with progress */}
      <div ref={headerRef} className="bg-white border-b border-gray-100 p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <button onClick={goBack} className="text-sm text-gray-500 hover:text-gray-700 mb-2">
            ← Canviar bus
          </button>
          <div className="flex items-center justify-between mb-0.5">
            <h1 className="font-bold text-gray-900">{currentBus?.label}</h1>
            <span className={`text-sm font-semibold tabular-nums ${
              trips.length > 0 && totalPresents === trips.length ? 'text-green-600' : 'text-gray-500'
            }`}>
              {totalPresents} / {trips.length}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-3">{selectedDirection ? DIR[selectedDirection] : ''}</p>
          <input
            type="search"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Cercar..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sagals"
          />
        </div>
      </div>

      {/* Attendance sections */}
      <div className="max-w-lg mx-auto px-4 pb-8">
        {filtered.length === 0 && search && (
          <p className="text-center text-gray-400 py-8 text-sm">Cap resultat per "{search}"</p>
        )}
        {filtered.length === 0 && !search && (
          <p className="text-center text-gray-400 py-8 text-sm">Cap participant</p>
        )}

        {/* Pendents */}
        {pendents.length > 0 && (
          <>
            <SectionHeader
              label="Pendents"
              count={pendents.length}
              color="pendent"
              stickyTop={headerH}
              collapsed={collapsed.has('pendent')}
              onToggle={() => setCollapsed(prev => {
                const next = new Set(prev)
                next.has('pendent') ? next.delete('pendent') : next.add('pendent')
                return next
              })}
            />
            {!collapsed.has('pendent') && (
              <div className="space-y-1.5">
                {pendents.map(t => (
                  <TripRow
                    key={t.trip_id}
                    t={t}
                    photo={getPhoto(t.participant)}
                    isActive={activeTripId === t.trip_id}
                    onToggle={() => setActiveTripId(prev => prev === t.trip_id ? null : t.trip_id)}
                    onMark={(status) => { handleMark(t.trip_id, status); setActiveTripId(null) }}
                    onPhotoClick={(e) => { e.stopPropagation(); setModalPhoto(getPhoto(t.participant)!) }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* All-clear when no search and zero pendents */}
        {!search && pendents.length === 0 && trips.length > 0 && (
          <div className="pt-4 pb-1 px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-500">
              Tothom comptabilitzat ✓
            </p>
          </div>
        )}

        {/* Presents */}
        {presents.length > 0 && (
          <>
            <SectionHeader
              label="Presents"
              count={presents.length}
              color="present"
              stickyTop={headerH}
              collapsed={collapsed.has('present')}
              onToggle={() => setCollapsed(prev => {
                const next = new Set(prev)
                next.has('present') ? next.delete('present') : next.add('present')
                return next
              })}
            />
            {!collapsed.has('present') && (
              <div className="space-y-1.5">
                {presents.map(t => (
                  <TripRow
                    key={t.trip_id}
                    t={t}
                    photo={getPhoto(t.participant)}
                    isActive={activeTripId === t.trip_id}
                    onToggle={() => setActiveTripId(prev => prev === t.trip_id ? null : t.trip_id)}
                    onMark={(status) => { handleMark(t.trip_id, status); setActiveTripId(null) }}
                    onPhotoClick={(e) => { e.stopPropagation(); setModalPhoto(getPhoto(t.participant)!) }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Absents */}
        {absents.length > 0 && (
          <>
            <SectionHeader
              label="Absents"
              count={absents.length}
              color="absent"
              stickyTop={headerH}
              collapsed={collapsed.has('absent')}
              onToggle={() => setCollapsed(prev => {
                const next = new Set(prev)
                next.has('absent') ? next.delete('absent') : next.add('absent')
                return next
              })}
            />
            {!collapsed.has('absent') && (
              <div className="space-y-1.5">
                {absents.map(t => (
                  <TripRow
                    key={t.trip_id}
                    t={t}
                    photo={getPhoto(t.participant)}
                    isActive={activeTripId === t.trip_id}
                    onToggle={() => setActiveTripId(prev => prev === t.trip_id ? null : t.trip_id)}
                    onMark={(status) => { handleMark(t.trip_id, status); setActiveTripId(null) }}
                    onPhotoClick={(e) => { e.stopPropagation(); setModalPhoto(getPhoto(t.participant)!) }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo modal */}
      {modalPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
          onClick={() => setModalPhoto(null)}
        >
          <img
            src={modalPhoto}
            alt=""
            className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
