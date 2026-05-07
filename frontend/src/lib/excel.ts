import type { ColumnMapping } from '../types'

export interface ParticipantDraft {
  event: string
  first_name: string
  last_name: string
  last_name2: string
  nickname: string
  transport_raw: string
}

const COLUMN_PATTERNS: Record<keyof ColumnMapping, RegExp> = {
  firstName:  /nom/i,
  lastName:   /cognom/i,
  lastName2:  /segon/i,
  nickname:   /sobrenom|nick/i,
  transport:  /transport/i,
}

export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { firstName: -1, lastName: -1, lastName2: -1, nickname: -1, transport: -1 }

  for (const [key, pattern] of Object.entries(COLUMN_PATTERNS) as [keyof ColumnMapping, RegExp][]) {
    const idx = headers.findIndex(h => pattern.test(h))
    mapping[key] = idx
  }

  // lastName2 ha de venir DESPRÉS de lastName — si el pattern /cognom/ troba el primer cognom,
  // busquem el segon cognom explícitament primer, i el cognom simple com a fallback
  const secondIdx = headers.findIndex(h => /segon\s*cognom/i.test(h))
  const firstLastNameIdx = headers.findIndex(h => /^cognom$/i.test(h) || /primer\s*cognom/i.test(h) || (/cognom/i.test(h) && !/segon/i.test(h)))

  if (secondIdx !== -1) mapping.lastName2 = secondIdx
  if (firstLastNameIdx !== -1) mapping.lastName = firstLastNameIdx

  return mapping
}

export function getUniqueTransportValues(rows: unknown[][], colIndex: number): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    const val = str(row[colIndex])
    if (val) seen.add(val)
  }
  return Array.from(seen)
}

function str(cell: unknown): string {
  if (cell == null) return ''
  return String(cell).trim()
}

export function rowsToParticipants(rows: unknown[][], mapping: ColumnMapping, eventId: string): ParticipantDraft[] {
  return rows
    .filter(row => row.some(cell => str(cell) !== ''))
    .map(row => ({
      event: eventId,
      first_name:    str(row[mapping.firstName]),
      last_name:     str(row[mapping.lastName]),
      last_name2:    str(row[mapping.lastName2]),
      nickname:      str(row[mapping.nickname]),
      transport_raw: str(row[mapping.transport]),
    }))
}
