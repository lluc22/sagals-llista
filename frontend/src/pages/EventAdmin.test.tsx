import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import EventAdmin from './EventAdmin'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}))

const { mockGet, mockPost, mockPatch, mockDel } = vi.hoisted(() => ({
  mockGet:  vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
  mockDel:  vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: { get: mockGet, post: mockPost, patch: mockPatch, del: mockDel },
}))

const draftEvent = {
  id: 1, name: 'Festa Major', slug: 'festa-major', date: '2025-06-01',
  status: 'draft', column_mapping: {}, transport_mapping: {}, access_token: null as string | null, inserted_at: '',
}
const activeEvent = { ...draftEvent, status: 'active', access_token: 'tok123' }
const buses = [
  { id: 1, event_id: 1, label: 'Bus Vic',    direction: 'ambdues', departure_time: '08:00', order: 1 },
  { id: 2, event_id: 1, label: 'Bus Manlleu', direction: 'anada',   departure_time: '09:00', order: 2 },
]
const participants = [
  { id: 1, event_id: 1, first_name: 'Anna', last_name: 'Vila',  last_name2: '', nickname: '', transport_raw: 'Bus',   trips: [{ id: 1, bus_id: 1, direction: 'ambdues' }] },
  { id: 2, event_id: 1, first_name: 'Pau',  last_name: 'Serra', last_name2: '', nickname: '', transport_raw: 'Bus',   trips: [{ id: 2, bus_id: 1, direction: 'anada' }] },
  { id: 3, event_id: 1, first_name: 'Joan', last_name: 'Pla',   last_name2: '', nickname: '', transport_raw: 'Propi', trips: [] },
]

function setup(event = draftEvent, parts = participants) {
  mockGet.mockImplementation((path: string) => {
    if (path.includes('/participants')) return Promise.resolve({ data: parts })
    if (path.includes('/buses'))        return Promise.resolve({ data: buses })
    return Promise.resolve({ data: event })
  })
}

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/events/1/admin']}>
      <Routes>
        <Route path="/events/:id/admin" element={<EventAdmin />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPost.mockResolvedValue({ data: {} })
  mockPatch.mockResolvedValue({ data: {} })
  mockDel.mockResolvedValue(undefined)
})

describe('EventAdmin - capçalera', () => {
  it('mostra el nom, la data i l\'estat', async () => {
    setup()
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Festa Major')).toBeInTheDocument())
    expect(screen.getByText('1 de juny del 2025')).toBeInTheDocument()
    expect(screen.getByText(/esborrany/i)).toBeInTheDocument()
  })

  it('activa l\'event i actualitza l\'estat', async () => {
    setup()
    mockPost.mockResolvedValue({ data: activeEvent })
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /activar actuació/i }))
    fireEvent.click(screen.getByRole('button', { name: /activar actuació/i }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/events/1/activate'))
    await waitFor(() => expect(screen.getByText(/actiu/i)).toBeInTheDocument())
  })
})

describe('EventAdmin - participants', () => {
  it('mostra la llista de participants', async () => {
    setup()
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Anna Vila')).toBeInTheDocument())
    expect(screen.getByText('Pau Serra')).toBeInTheDocument()
    expect(screen.getByText('Joan Pla')).toBeInTheDocument()
  })

  it('mostra CTA importar quan no hi ha participants', async () => {
    setup(draftEvent, [])
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: /importar participants/i })).toBeInTheDocument())
  })

  it('navega a setup quan es clica importar', async () => {
    setup(draftEvent, [])
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /importar participants/i }))
    fireEvent.click(screen.getByRole('button', { name: /importar participants/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/events/1/setup')
  })

  it('mostra botó reimportar quan hi ha participants', async () => {
    setup()
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: /reimportar/i })).toBeInTheDocument())
  })

  it('reimportar mostra confirmació inline', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /reimportar/i }))
    fireEvent.click(screen.getByRole('button', { name: /reimportar/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument())
  })

  it('confirmar reimportar esborra tots els participants i navega a setup', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /reimportar/i }))
    fireEvent.click(screen.getByRole('button', { name: /reimportar/i }))
    await waitFor(() => screen.getByRole('button', { name: /confirmar/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(mockDel).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/events/1/setup'))
  })

  it('elimina un participant per aria-label', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Anna Vila' }))
    await waitFor(() => expect(mockDel).toHaveBeenCalledWith('/api/participants/1'))
    await waitFor(() => expect(screen.queryByText('Anna Vila')).not.toBeInTheDocument())
  })

  it('editar participant mostra el formulari inline', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    fireEvent.click(screen.getByRole('button', { name: 'Editar Anna Vila' }))
    await waitFor(() => expect(screen.getByDisplayValue('Anna')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Vila')).toBeInTheDocument()
  })

  it('desar edició participant crida patch', async () => {
    setup()
    mockPatch.mockResolvedValue({ data: { ...participants[0] } })
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    fireEvent.click(screen.getByRole('button', { name: 'Editar Anna Vila' }))
    await waitFor(() => screen.getByDisplayValue('Anna'))
    fireEvent.click(screen.getByRole('button', { name: /desar/i }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/participants/1', expect.objectContaining({ first_name: 'Anna' })))
  })
})

describe('EventAdmin - busos', () => {
  it('mostra els busos amb etiqueta i hora', async () => {
    setup()
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Bus Vic')).toBeInTheDocument())
    expect(screen.getByText('Bus Manlleu')).toBeInTheDocument()
  })

  it('editar bus mostra camps inline', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByRole('button', { name: 'Editar Bus Vic' }))
    await waitFor(() => expect(screen.getByDisplayValue('Bus Vic')).toBeInTheDocument())
  })

  it('desar edició bus crida patch', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByRole('button', { name: 'Editar Bus Vic' }))
    await waitFor(() => screen.getByDisplayValue('Bus Vic'))
    fireEvent.click(screen.getByRole('button', { name: /desar/i }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/buses/1', expect.objectContaining({ label: 'Bus Vic' })))
  })

  it('eliminar bus crida del', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Bus Vic' }))
    await waitFor(() => expect(mockDel).toHaveBeenCalledWith('/api/buses/1'))
  })

  it('afegir bus crida post i afegeix a la llista', async () => {
    setup()
    mockPost.mockResolvedValue({ data: { id: 3, event_id: 1, label: 'Bus Nou', direction: 'ambdues', departure_time: '', order: 3 } })
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /afegir bus/i }))
    fireEvent.click(screen.getByRole('button', { name: /afegir bus/i }))
    await waitFor(() => screen.getByPlaceholderText(/Bus 1/i))
    await userEvent.type(screen.getByPlaceholderText(/Bus 1/i), 'Bus Nou')
    fireEvent.click(screen.getByRole('button', { name: /desar/i }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/events/1/buses', expect.objectContaining({ label: 'Bus Nou' })))
    await waitFor(() => expect(screen.getByText('Bus Nou')).toBeInTheDocument())
  })
})

describe('EventAdmin - compartir', () => {
  it('mostra l\'enllaç de compartir quan l\'event és actiu', async () => {
    setup(activeEvent)
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument())
  })

  it('no mostra l\'enllaç quan l\'event és esborrany', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Festa Major'))
    expect(screen.queryByText(/copiar/i)).not.toBeInTheDocument()
  })
})
