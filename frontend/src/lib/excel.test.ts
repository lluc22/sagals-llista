import { describe, it, expect } from 'vitest'
import { detectColumns, getUniqueTransportValues, rowsToParticipants } from './excel'
import type { ColumnMapping } from '../types'

const HEADERS = ['Nom', 'Cognom', 'Segon cognom', 'Sobrenom', 'Transport', 'Dinar', 'Aspectes']
const ROWS = [
  ['Abel', 'Abel', '', 'Abel', 'Autobus anada i tornada post actuació', 'No', ''],
  ['Agnès', 'Camps', 'Martinez', 'Agnès', 'Vaig amb el meu propi transport', 'Sí', ''],
  ['Ramon', 'Altarriba', '', 'Altarriba', 'Autobus anada i tornada post actuació', 'No', ''],
]

describe('detectColumns', () => {
  it('detecta les columnes per nom de capçalera', () => {
    const mapping = detectColumns(HEADERS)
    expect(mapping.firstName).toBe(0)
    expect(mapping.lastName).toBe(1)
    expect(mapping.lastName2).toBe(2)
    expect(mapping.nickname).toBe(3)
    expect(mapping.transport).toBe(4)
  })

  it('detecta variacions de capçalera (case insensitive)', () => {
    const headers = ['NOM', 'COGNOM', 'SEGON COGNOM', 'SOBRENOM', 'TRANSPORT']
    const mapping = detectColumns(headers)
    expect(mapping.firstName).toBe(0)
    expect(mapping.transport).toBe(4)
  })

  it('retorna -1 per columnes no trobades', () => {
    const mapping = detectColumns(['Foo', 'Bar'])
    expect(mapping.firstName).toBe(-1)
    expect(mapping.transport).toBe(-1)
  })

  it('detecta capçaleres parcials (conté la paraula)', () => {
    const headers = ['Primer nom', 'Primer cognom', 'Segon cognom', 'Nick', 'Tipus transport']
    const mapping = detectColumns(headers)
    expect(mapping.firstName).toBe(0)
    expect(mapping.transport).toBe(4)
  })
})

describe('getUniqueTransportValues', () => {
  it('retorna valors únics de la columna de transport', () => {
    const values = getUniqueTransportValues(ROWS, 4)
    expect(values).toHaveLength(2)
    expect(values).toContain('Autobus anada i tornada post actuació')
    expect(values).toContain('Vaig amb el meu propi transport')
  })

  it('ignora valors buits', () => {
    const rows = [['Abel', ''], ['Agnès', ''], ['Ramon', 'Bus']]
    const values = getUniqueTransportValues(rows, 1)
    expect(values).toHaveLength(1)
    expect(values).toContain('Bus')
  })
})

describe('rowsToParticipants', () => {
  const mapping: ColumnMapping = { firstName: 0, lastName: 1, lastName2: 2, nickname: 3, transport: 4 }

  it('converteix files en participants', () => {
    const participants = rowsToParticipants(ROWS, mapping, 'evt123')
    expect(participants).toHaveLength(3)
    expect(participants[0]).toMatchObject({
      first_name: 'Abel',
      last_name: 'Abel',
      last_name2: '',
      nickname: 'Abel',
      transport_raw: 'Autobus anada i tornada post actuació',
      event: 'evt123',
    })
  })

  it('salta files completament buides', () => {
    const rowsWithEmpty = [...ROWS, ['', '', '', '', '', '', '']]
    const participants = rowsToParticipants(rowsWithEmpty, mapping, 'evt123')
    expect(participants).toHaveLength(3)
  })

  it('converteix cel·les numèriques a string (xlsx sense raw:false)', () => {
    const rowsWithNumbers = [[42, 'Serra', '', 'Pau', 'Bus 1']]
    const participants = rowsToParticipants(rowsWithNumbers, mapping, 'evt1')
    expect(participants[0].first_name).toBe('42')
  })

  it('ignora cel·les null i undefined', () => {
    const rowsWithNulls = [[null, 'Vila', undefined, '', 'Bus 1']]
    const participants = rowsToParticipants(rowsWithNulls, mapping, 'evt1')
    expect(participants[0].first_name).toBe('')
    expect(participants[0].last_name2).toBe('')
  })
})
