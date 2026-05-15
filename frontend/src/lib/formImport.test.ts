import { describe, it, expect } from 'vitest'
import { getOptionLabels, getUniqueTransportValues, resolveTransportValue } from '../pages/FormImport'

describe('resolveTransportValue', () => {
  it('trims string values', () => {
    expect(resolveTransportValue('Bus Vic ', {})).toBe('Bus Vic')
    expect(resolveTransportValue('  Anada  ', {})).toBe('Anada')
  })

  it('trims numeric values resolved from option labels', () => {
    const optLabels = { '0': 'Bus Anada ', '1': ' Bus Tornada' }
    expect(resolveTransportValue(0, optLabels)).toBe('Bus Anada')
    expect(resolveTransportValue(1, optLabels)).toBe('Bus Tornada')
  })

  it('trims array values and their resolved labels', () => {
    const optLabels = { '0': 'Anada ', '1': ' Tornada' }
    expect(resolveTransportValue([0, 1], optLabels)).toBe('Anada, Tornada')
  })

  it('trims object (checkbox) values', () => {
    const optLabels = { '0': 'Bus Anada ', '1': ' Bus Tornada ' }
    expect(resolveTransportValue({ '0': 1, '1': 1 }, optLabels)).toBe('Bus Anada, Bus Tornada')
  })

  it('handles single checkbox selection', () => {
    const optLabels = { '0': 'Anada', '1': 'Tornada' }
    expect(resolveTransportValue({ '0': 1 }, optLabels)).toBe('Anada')
  })

  it('ignores false checkbox values', () => {
    const optLabels = { '0': 'Anada', '1': 'Tornada' }
    expect(resolveTransportValue({ '0': true, '1': false }, optLabels)).toBe('Anada')
    expect(resolveTransportValue({ '0': false, '1': true }, optLabels)).toBe('Tornada')
  })

  it('handles checkbox with true values', () => {
    const optLabels = { '0': 'Anada', '1': 'Tornada' }
    expect(resolveTransportValue({ '0': true, '1': true }, optLabels)).toBe('Anada, Tornada')
  })

  it('returns empty string for null/undefined', () => {
    expect(resolveTransportValue(null, {})).toBe('')
    expect(resolveTransportValue(undefined, {})).toBe('')
  })
})

describe('getOptionLabels', () => {
  it('extracts option labels from form elements', () => {
    const elements = [
      {
        id: 'q1',
        type: 'checkbox',
        content: { question: 'Transport', options: ['Anada', 'Tornada'] }
      }
    ]
    expect(getOptionLabels(elements, 'q1')).toEqual({ '0': 'Anada', '1': 'Tornada' })
  })

  it('handles options with price objects', () => {
    const elements = [
      {
        id: 'q1',
        type: 'checkbox',
        content: { question: 'Transport', options: [{ text: 'Option 1', price: 10 }, { text: 'Option 2', price: 20 }] }
      }
    ]
    expect(getOptionLabels(elements, 'q1')).toEqual({ '0': 'Option 1', '1': 'Option 2' })
  })

  it('returns empty object for missing question', () => {
    expect(getOptionLabels([], 'missing')).toEqual({})
  })
})

describe('getUniqueTransportValues', () => {
  it('returns trimmed unique values from responses', () => {
    const elements = [
      {
        id: 'q1',
        type: 'checkbox',
        content: { question: 'Transport', options: ['Anada ', ' Tornada'] }
      }
    ]
    const responses = {
      '1': { q1: { '0': 1 } },
      '2': { q1: 'Bus Vic ' },
      '3': { q1: 0 }
    }
    const result = getUniqueTransportValues(responses, 'q1', elements)
    expect(result).toEqual(['Anada', 'Bus Vic'])
  })

  it('handles multiple checkbox selections', () => {
    const elements = [
      {
        id: 'q1',
        type: 'checkbox',
        content: { question: 'Transport', options: ['Anada', 'Tornada'] }
      }
    ]
    const responses = {
      '1': { q1: { '0': 1, '1': 1 } }
    }
    const result = getUniqueTransportValues(responses, 'q1', elements)
    expect(result).toContain('Anada')
    expect(result).toContain('Tornada')
  })

  it('ignores false checkbox values', () => {
    const elements = [
      {
        id: 'q1',
        type: 'checkbox',
        content: { question: 'Transport', options: ['Anada', 'Tornada', 'No vinc amb bus'] }
      }
    ]
    const responses = {
      '1': { q1: { '0': true, '1': false, '2': false } },
      '2': { q1: { '0': false, '1': false, '2': true } }
    }
    const result = getUniqueTransportValues(responses, 'q1', elements)
    expect(result).toEqual(['Anada', 'No vinc amb bus'])
  })

  it('separates individual options from combined selections', () => {
    const elements = [
      {
        id: 'q1',
        type: 'checkbox',
        content: { question: 'Transport', options: ['Anada', 'Tornada', 'No vinc amb bus'] }
      }
    ]
    const responses = {
      '1': { q1: { '0': true, '1': true } },
      '2': { q1: { '0': true } }
    }
    const result = getUniqueTransportValues(responses, 'q1', elements)
    expect(result.sort()).toEqual(['Anada', 'Tornada'])
  })
})