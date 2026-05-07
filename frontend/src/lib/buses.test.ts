import { describe, it, expect } from 'vitest'
import { addBus, removeBus, updateBus, defaultBus, type BusDraft } from './buses'

describe('addBus', () => {
  it('afegeix un bus amb valors per defecte a la llista', () => {
    const result = addBus([])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ label: '', departure_time: '', direction: 'anada' })
  })

  it('assigna order incremental', () => {
    const list = addBus(addBus([]))
    expect(list[0].order).toBe(0)
    expect(list[1].order).toBe(1)
  })

  it('preserva els busos existents', () => {
    const existing: BusDraft[] = [{ ...defaultBus, label: 'Bus 1', order: 0 }]
    const result = addBus(existing)
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('Bus 1')
  })
})

describe('removeBus', () => {
  it('elimina el bus per índex', () => {
    const list = addBus(addBus([]))
    const result = removeBus(list, 0)
    expect(result).toHaveLength(1)
    expect(result[0].order).toBe(1)
  })

  it('retorna llista buida si no en queda cap', () => {
    const list = addBus([])
    expect(removeBus(list, 0)).toHaveLength(0)
  })
})

describe('updateBus', () => {
  it('actualitza el camp indicat', () => {
    const list = addBus([])
    const result = updateBus(list, 0, { label: 'Bus Vic' })
    expect(result[0].label).toBe('Bus Vic')
  })

  it('no muta la llista original', () => {
    const list = addBus([])
    updateBus(list, 0, { label: 'Bus Vic' })
    expect(list[0].label).toBe('')
  })

  it('actualitza only el camp indicat, preserva la resta', () => {
    const list = addBus([])
    const result = updateBus(list, 0, { label: 'Bus Vic' })
    expect(result[0].direction).toBe('anada')
    expect(result[0].departure_time).toBe('')
  })
})
