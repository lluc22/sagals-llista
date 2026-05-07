export type BusDirection = 'anada' | 'tornada' | 'ambdues'

export interface BusDraft {
  label: string
  departure_time: string
  direction: BusDirection
  order: number
}

export const defaultBus: BusDraft = {
  label: '',
  departure_time: '',
  direction: 'ambdues',
  order: 0,
}

export function addBus(list: BusDraft[]): BusDraft[] {
  return [...list, { ...defaultBus, order: list.length }]
}

export function removeBus(list: BusDraft[], index: number): BusDraft[] {
  return list.filter((_, i) => i !== index)
}

export function updateBus(list: BusDraft[], index: number, patch: Partial<BusDraft>): BusDraft[] {
  return list.map((bus, i) => (i === index ? { ...bus, ...patch } : bus))
}
