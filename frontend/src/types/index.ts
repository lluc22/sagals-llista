export interface Event {
  id: number
  name: string
  date: string
  slug: string
  status: 'draft' | 'active' | 'closed'
  access_token: string | null
  column_mapping: ColumnMapping
  transport_mapping: TransportMapping
  inserted_at: string
}

export interface ColumnMapping {
  firstName: number
  lastName: number
  lastName2: number
  nickname: number
  transport: number
  observations: number
  companions: number
}

export interface TransportBusEntry {
  busId: number
  direction: 'anada' | 'tornada' | 'ambdues'
}

export interface TransportMapping {
  [rawValue: string]: {
    usesBus: boolean
    buses: TransportBusEntry[]
  }
}

export interface Bus {
  id: number
  event_id: number
  label: string
  departure_time: string
  direction: 'anada' | 'tornada' | 'ambdues'
  order: number
}

export interface ParticipantTrip {
  id: number
  bus_id: number
  direction: 'anada' | 'tornada'
}

export interface Participant {
  id: number
  event_id: number
  first_name: string
  last_name: string
  last_name2: string
  nickname: string
  transport_raw: string
  observations: string
  companions: string
  reviewed: boolean
  trips: ParticipantTrip[]
}

export interface AttendanceRecord {
  id: number | null
  status: 'pendent' | 'present' | 'absent'
  marked_at: string | null
  marked_by: string | null
}

export interface TripWithAttendance {
  trip_id: number
  participant: {
    id: number
    first_name: string
    last_name: string
    last_name2: string
    nickname: string
  }
  attendance: AttendanceRecord
}
