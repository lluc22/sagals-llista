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

const mockEvent = { id: 1, name: 'Festa Major', slug: 'festa-major', status: 'draft', column_mapping: {}, transport_mapping: {}, access_token: null, inserted_at: '', date: '2025-06-01', form_id: null, form_mapping: null }
const mockBuses = [
  { id: 1, event_id: 1, label: 'Bus Vic', direction: 'anada', departure_time: '08:00', order: 1 },
  { id: 2, event_id: 1, label: 'Bus Girona', direction: 'tornada', departure_time: '18:00', order: 2 },
]

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

describe('EventSetup - import step', () => {
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

  it('mostra error per fitxer buit', async () => {
    renderSetup()
    await waitFor(() => screen.getByText(/importar excel/i))
    const csvContent = 'Nom,Cognom\n'
    const file = new File([csvContent], 'empty.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await waitFor(() => {
      expect(screen.getByText(/fitxer sembla buit/i)).toBeInTheDocument()
    })
  })
})

describe('EventSetup - column step', () => {
  async function goToColumnStep() {
    renderSetup()
    await waitFor(() => screen.getByText(/importar excel/i))
    const csvContent = 'Nom,Cognom,Segon cognom,Sobrenom,Transport,Observacions,Acompanyants\nPau,Serra,Mas,Mates,Bus Vic,Necesita ajuda,2\n'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await waitFor(() => screen.getByText(/mapeig de columnes/i))
  }

  it('mostra les columnes detectades', async () => {
    await goToColumnStep()
    expect(screen.getAllByText('Nom').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cognom').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Transport').length).toBeGreaterThan(0)
  })

  it('mostra previsualització de files', async () => {
    await goToColumnStep()
    expect(screen.getByText(/pau/i)).toBeInTheDocument()
  })

  it('pot tornar al pas d\'importar', async () => {
    await goToColumnStep()
    fireEvent.click(screen.getByRole('button', { name: /enrere/i }))
    await waitFor(() => {
      expect(screen.getByText(/importar excel/i)).toBeInTheDocument()
    })
  })

  it('avança al pas de transport', async () => {
    await goToColumnStep()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => {
      expect(screen.getByText(/mapeig de transport/i)).toBeInTheDocument()
    })
  })
})

describe('EventSetup - transport step', () => {
  async function goToTransportStep() {
    renderSetup()
    await waitFor(() => screen.getByText(/importar excel/i))
    const csvContent = 'Nom,Cognom,Segon cognom,Sobrenom,Transport\nPau,Serra,Mas,Mates,Bus Vic\nAnna,Vila,,Anna,Propi\n'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await waitFor(() => screen.getByText(/mapeig de columnes/i))
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    await waitFor(() => screen.getByText(/mapeig de transport/i))
  }

  it('mostra els valors de transport únics', async () => {
    await goToTransportStep()
    expect(screen.getByText('Bus Vic')).toBeInTheDocument()
    expect(screen.getByText('Propi')).toBeInTheDocument()
  })

  it('pot tornar al pas de columnes', async () => {
    await goToTransportStep()
    fireEvent.click(screen.getByRole('button', { name: /enrere/i }))
    await waitFor(() => {
      expect(screen.getByText(/mapeig de columnes/i)).toBeInTheDocument()
    })
  })

  it('guarda i navega a admin', async () => {
    await goToTransportStep()
    fireEvent.click(screen.getByRole('button', { name: /importar participants/i }))
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/api/events/1', expect.objectContaining({
        column_mapping: expect.any(Object),
        transport_mapping: expect.any(Object),
      }))
      expect(mockPost).toHaveBeenCalledWith('/api/events/1/participants/import', expect.objectContaining({
        rows: expect.any(Array),
        column_mapping: expect.any(Object),
        transport_mapping: expect.any(Object),
      }))
      expect(mockNavigate).toHaveBeenCalledWith('/events/1/admin')
    })
  })

  it('mostra error si falla el guardat', async () => {
    mockPatch.mockRejectedValueOnce(new Error('fail'))
    await goToTransportStep()
    fireEvent.click(screen.getByRole('button', { name: /importar participants/i }))
    await waitFor(() => {
      expect(screen.getByText(/error en guardar/i)).toBeInTheDocument()
    })
  })

  it('pot marcar el checkbox de va amb bus', async () => {
    await goToTransportStep()
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0]).toBeChecked()
  })
})