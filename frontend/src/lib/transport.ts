import type { TransportMapping, TransportBusEntry } from '../types'

export function resolveParticipantBuses(transportRaw: string, mapping: TransportMapping): TransportBusEntry[] {
  const rule = mapping[transportRaw]
  if (!rule || !rule.usesBus) return []
  return rule.buses
}
