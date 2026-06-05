export interface User {
  id: number
  email: string
}

export interface Event {
  id: number
  name: string
  date: string
  slug: string
  status: 'draft' | 'active' | 'closed'
  access_token: string | null
  column_mapping: ColumnMapping
  transport_mapping: TransportMapping
  form_id: number | null
  form_mapping: FormMapping | null
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
  direction: 'anada' | 'tornada'
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
  direction: 'anada' | 'tornada'
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
    observations: string
    companions: string
  }
  attendance: AttendanceRecord
}

export interface FormMapping {
  transport_question_id: string
  observations_question_id: string | null
  companions_question_id: string | null
  transport_option_mapping: Record<string, { bus_id: number; direction: 'anada' | 'tornada' }[]>
}

export interface TenimaletaForm {
  title?: string
  description?: string
  elements: TenimaletaElement[]
  order: string[]
  required: boolean
  hidden: boolean
  openingDate: string | null
  closingDate: string | null
  new: boolean
}

export interface TenimaletaElement {
  id: string
  type: string
  content: {
    question: string
    options: string[] | { text: string; price: number; limit?: string | null }[]
  }
  required: boolean
  isComprovant: boolean
  showIf?: { questionId: string; optionId: string | number } | null
}

export interface TenimaletaCasteller {
  id: number
  nom: string
  cognom: string
  segon_cognom: string | null
  mote: string
  hidden: number
  canalla: number
  casteller: number
  soci: number
}

export interface TenimaletaCalendarEvent {
  id: string
  title: string
  start: string
  end: string
}

export interface TenimaletaFormResponse {
  mote: string
  createdAt: string
  [questionId: string]: string | number | string[] | number[] | Record<string, unknown> | undefined
}
