import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import EventSetup from './EventSetup'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}))

const { mockGet, mockPatch, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockPost: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, patch: mockPatch, post: mockPost },
}))

const mockEvent = { id: 1, name: 'Festa Major', slug: 'festa-major', status: 'draft', column_mapping: {}, transport_mapping: {}, access_token: null, inserted_at: '' }
const mockBuses = [{ id: 1, event_id: 1, label: 'Bus 1', direction: 'ambdues', departure_time: '08:00', order: 1 }]

function renderSetup() {
  return render(
    <MemoryRouter initialEntries={['/events/1/setup']}>
      <Routes>
        <Route path="/events/:id/setup" element={<EventSetup />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockImplementation((path: string) => {
    if (path.includes('/buses')) return Promise.resolve({ data: mockBuses })
    return Promise.resolve({ data: mockEvent })
  })
  mockPatch.mockResolvedValue({ data: mockEvent })
  mockPost.mockResolvedValue({ data: [] })
})

describe('EventSetup', () => {
  it('mostra el nom de l\'event i el botó d\'importar', async () => {
    renderSetup()
    await waitFor(() => {
      expect(screen.getByText('Festa Major')).toBeInTheDocument()
    })
    expect(screen.getByText(/importar excel/i)).toBeInTheDocument()
  })

  it('mostra error si es fa submit sense fitxer', async () => {
    renderSetup()
    await waitFor(() => screen.getByText(/importar excel/i))

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => {
      expect(screen.getByText(/selecciona un fitxer/i)).toBeInTheDocument()
    })
  })

  it('mostra el pas de mapeig de columnes després d\'importar un excel vàlid', async () => {
    renderSetup()
    await waitFor(() => screen.getByText(/importar excel/i))

    const csvContent = 'Nom,Cognom,Segon cognom,Sobrenom,Transport\nAbel,Abel,,Abel,Bus anada\n'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText(/mapeig de columnes/i)).toBeInTheDocument()
    })
  })
})
