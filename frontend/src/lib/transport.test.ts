import { describe, it, expect } from 'vitest'
import { resolveParticipantBuses } from './transport'
import type { TransportMapping } from '../types'

const mapping: TransportMapping = {
  'Bus anada i tornada': {
    usesBus: true,
    buses: [
      { busId: 'bus1', direction: 'anada' },
      { busId: 'bus2', direction: 'tornada' },
    ],
  },
  'Bus anada': {
    usesBus: true,
    buses: [{ busId: 'bus1', direction: 'anada' }],
  },
  'Propi': {
    usesBus: false,
    buses: [],
  },
}

describe('resolveParticipantBuses', () => {
  it('retorna múltiples entrades per a un valor amb múltiples busos', () => {
    const result = resolveParticipantBuses('Bus anada i tornada', mapping)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ busId: 'bus1', direction: 'anada' })
    expect(result[1]).toEqual({ busId: 'bus2', direction: 'tornada' })
  })

  it('retorna una entrada per a un valor amb un sol bus', () => {
    const result = resolveParticipantBuses('Bus anada', mapping)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ busId: 'bus1', direction: 'anada' })
  })

  it('retorna array buit per a transport propi', () => {
    const result = resolveParticipantBuses('Propi', mapping)
    expect(result).toHaveLength(0)
  })

  it('retorna array buit per a valors no trobats al mapping', () => {
    const result = resolveParticipantBuses('Valor desconegut', mapping)
    expect(result).toHaveLength(0)
  })
})
