import { describe, it, expect } from 'vitest'
import { normalize } from './search'

describe('normalize', () => {
  it('lowercases text', () => {
    expect(normalize('Adrià')).toBe('adria')
  })

  it('strips accents', () => {
    expect(normalize('Adrià García')).toBe('adria garcia')
    expect(normalize('Cèlia Espinós')).toBe('celia espinos')
    expect(normalize('Oriol Hernàndez')).toBe('oriol hernandez')
    expect(normalize('Núria Pérez')).toBe('nuria perez')
    expect(normalize('Domènec')).toBe('domenec')
    expect(normalize('Sònia')).toBe('sonia')
    expect(normalize('Magalí')).toBe('magali')
    expect(normalize('Eulàlia')).toBe('eulalia')
  })

  it('strips ela geminada middle dot', () => {
    expect(normalize('Lluc Bové')).toBe('lluc bove')
    expect(normalize('cel·la')).toBe('cella')
  })

  it('replacesª with a', () => {
    expect(normalize('Anna Mª')).toBe('anna ma')
  })

  it('handles uppercase names', () => {
    expect(normalize('CRISTINA GILABERT')).toBe('cristina gilabert')
    expect(normalize('GUIM PRAT')).toBe('guim prat')
  })

  it('is case insensitive', () => {
    expect(normalize('Adrià')).toBe(normalize('ADRIA'))
    expect(normalize('Cèlia')).toBe(normalize('CELIA'))
  })

  it('is symmetric: searching with accents matches names with accents', () => {
    expect(normalize('Adrià').includes(normalize('adria'))).toBe(true)
    expect(normalize('Núria Pérez').includes(normalize('nuria'))).toBe(true)
    expect(normalize('Cèlia').includes(normalize('celia'))).toBe(true)
  })
})