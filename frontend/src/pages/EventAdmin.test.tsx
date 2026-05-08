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
  status: 'draft', column_mapping: {}, transport_mapping: {}, access_token: null as string | null, form_id: null, inserted_at: '',
}
const activeEvent = { ...draftEvent, status: 'active', access_token: 'tok123' }
const activeEventWithForm = { ...activeEvent, form_id: 42 }
const buses = [
  { id: 1, event_id: 1, label: 'Bus Vic',    direction: 'anada', departure_time: '08:00', order: 1 },
  { id: 2, event_id: 1, label: 'Bus Manlleu', direction: 'anada',   departure_time: '09:00', order: 2 },
]
const participants = [
  { id: 1, event_id: 1, first_name: 'Anna', last_name: 'Vila',  last_name2: '', nickname: '', transport_raw: 'Bus', companions: '', observations: '', reviewed: false, trips: [{ id: 1, bus_id: 1, direction: 'anada' }] },
  { id: 2, event_id: 1, first_name: 'Pau',  last_name: 'Serra', last_name2: '', nickname: '', transport_raw: 'Bus', companions: '', observations: '', reviewed: false, trips: [{ id: 2, bus_id: 1, direction: 'anada' }] },
  { id: 3, event_id: 1, first_name: 'Joan', last_name: 'Pla',   last_name2: '', nickname: '', transport_raw: 'Propi', companions: '', observations: '', reviewed: false, trips: [] },
]
const participantsWithAttention = [
  { id: 1, event_id: 1, first_name: 'Anna', last_name: 'Vila',  last_name2: '', nickname: '', transport_raw: 'Bus', companions: '2 acompanyants', observations: '', reviewed: false, trips: [{ id: 1, bus_id: 1, direction: 'anada' }] },
  { id: 2, event_id: 1, first_name: 'Pau',  last_name: 'Serra', last_name2: '', nickname: '', transport_raw: 'Bus', companions: '', observations: 'Necessitia seient', reviewed: false, trips: [{ id: 2, bus_id: 1, direction: 'anada' }] },
  { id: 3, event_id: 1, first_name: 'Joan', last_name: 'Pla',   last_name2: '', nickname: '', transport_raw: 'Propi', companions: '', observations: '', reviewed: false, trips: [] },
]
const participantsWithNickname = [
  { id: 1, event_id: 1, first_name: 'Anna', last_name: 'Vila',  last_name2: '', nickname: 'Anita', transport_raw: 'Bus', companions: '', observations: '', reviewed: false, trips: [{ id: 1, bus_id: 1, direction: 'anada' }] },
]

function setup(event = draftEvent, parts = participants, bs = buses) {
  mockGet.mockImplementation((path: string) => {
    if (path.includes('/participants')) return Promise.resolve({ data: parts })
    if (path.includes('/buses'))        return Promise.resolve({ data: bs })
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
    await waitFor(() => screen.getByRole('button', { name: /^activar$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^activar$/i }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/events/1/activate'))
    await waitFor(() => expect(screen.getByText(/actiu/i)).toBeInTheDocument())
  })

  it('desactiva l\'event actiu', async () => {
    setup(activeEvent)
    mockPost.mockResolvedValue({ data: draftEvent })
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /^desactivar/i }))
    fireEvent.click(screen.getByRole('button', { name: /^desactivar/i }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/events/1/deactivate'))
  })

  it('elimina l\'event amb confirmació', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Festa Major'))
    fireEvent.click(screen.getByRole('button', { name: /eliminar actuació/i }))
    await waitFor(() => screen.getByText('Segur?'))
    fireEvent.click(screen.getByText('Sí'))
    await waitFor(() => expect(mockDel).toHaveBeenCalledWith('/api/events/1'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('cancel·la eliminació de l\'event', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Festa Major'))
    fireEvent.click(screen.getByRole('button', { name: /eliminar actuació/i }))
    await waitFor(() => screen.getByText('Segur?'))
    fireEvent.click(screen.getByText('No'))
    expect(mockDel).not.toHaveBeenCalled()
  })

  it('torna enrere amb el botó fletxa', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Festa Major'))
    const backBtn = screen.getAllByRole('button').find(b => b.querySelector('[data-lucid="arrow-left"]') || b.textContent === '')
    if (backBtn) fireEvent.click(backBtn)
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

  it('mostra botons Des de Excel i Des de formulari quan no hi ha participants', async () => {
    setup(draftEvent, [])
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: /des de excel/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /des de formulari/i })).toBeInTheDocument()
  })

  it('navega a setup quan es clica Des de Excel', async () => {
    setup(draftEvent, [])
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /des de excel/i }))
    fireEvent.click(screen.getByRole('button', { name: /des de excel/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/events/1/setup')
  })

  it('navega a import-form quan es clica Des de formulari', async () => {
    setup(draftEvent, [])
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /des de formulari/i }))
    fireEvent.click(screen.getByRole('button', { name: /des de formulari/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/events/1/import-form')
  })

  it('mostra botó esborrar participants quan hi ha participants', async () => {
    setup()
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: /esborrar participants/i })).toBeInTheDocument())
  })

  it('esborrar participants mostra confirmació inline', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /esborrar participants/i }))
    fireEvent.click(screen.getByRole('button', { name: /esborrar participants/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument())
  })

  it('confirmar esborrar participants esborra tots els participants', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /esborrar participants/i }))
    fireEvent.click(screen.getByRole('button', { name: /esborrar participants/i }))
    await waitFor(() => screen.getByRole('button', { name: /confirmar/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(mockDel).toHaveBeenCalledTimes(3))
  })

  it('cancel·la esborrar participants', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /esborrar participants/i }))
    fireEvent.click(screen.getByRole('button', { name: /esborrar participants/i }))
    await waitFor(() => screen.getByText(/s'esborraran/i))
    const cancelBtns = screen.getAllByRole('button', { name: /cancel·lar/i })
    fireEvent.click(cancelBtns[0])
    await waitFor(() => expect(screen.queryByText(/s'esborraran/i)).not.toBeInTheDocument())
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

  it('cancel·la edició participant', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    fireEvent.click(screen.getByRole('button', { name: 'Editar Anna Vila' }))
    await waitFor(() => screen.getByDisplayValue('Anna'))
    const cancelBtns = screen.getAllByRole('button', { name: /cancel·lar/i })
    fireEvent.click(cancelBtns[0])
    await waitFor(() => expect(screen.queryByDisplayValue('Anna')).not.toBeInTheDocument())
  })

  it('mostra sobrenom si el participant en té', async () => {
    setup(draftEvent, participantsWithNickname)
    renderAdmin()
    await waitFor(() => expect(screen.getByText('Anita')).toBeInTheDocument())
    expect(screen.getByText(/\(Anna Vila\)/)).toBeInTheDocument()
  })

  it('afegir participant mostra formulari', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    fireEvent.click(screen.getByRole('button', { name: /afegir$/i }))
    await waitFor(() => screen.getByPlaceholderText('Nom *'))
    expect(screen.getByPlaceholderText('Cognom')).toBeInTheDocument()
  })

  it('afegir participant amb nom desar crida post', async () => {
    setup()
    mockPost.mockResolvedValue({ data: { id: 10, event_id: 1, first_name: 'Marc', last_name: '', last_name2: '', nickname: '', companions: '', observations: '', reviewed: false, transport_raw: '', trips: [] } })
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    fireEvent.click(screen.getByRole('button', { name: /afegir$/i }))
    await waitFor(() => screen.getByPlaceholderText('Nom *'))
    await userEvent.type(screen.getByPlaceholderText('Nom *'), 'Marc')
    fireEvent.click(screen.getAllByRole('button', { name: /desar/i }).find(b => b.closest('[class*="bg-sagals-light"]'))!)
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/events/1/participants', expect.objectContaining({ first_name: 'Marc' })))
  })

  it('afegir participant amb trips crida post i patch', async () => {
    setup()
    mockPost.mockResolvedValue({ data: { id: 10, event_id: 1, first_name: 'Marc', last_name: '', last_name2: '', nickname: '', companions: '', observations: '', reviewed: false, transport_raw: '', trips: [] } })
    mockPatch.mockResolvedValue({ data: { id: 10, event_id: 1, first_name: 'Marc', last_name: '', last_name2: '', nickname: '', companions: '', observations: '', reviewed: false, transport_raw: '', trips: [{ bus_id: 1, direction: 'anada' }] } })
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    fireEvent.click(screen.getByRole('button', { name: /afegir$/i }))
    await waitFor(() => screen.getByPlaceholderText('Nom *'))
    await userEvent.type(screen.getByPlaceholderText('Nom *'), 'Marc')
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getAllByRole('button', { name: /desar/i }).find(b => b.closest('[class*="bg-sagals-light"]'))!)
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/events/1/participants', expect.objectContaining({ first_name: 'Marc' })))
  })

  it('cancel·la afegir participant', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    fireEvent.click(screen.getByRole('button', { name: /afegir$/i }))
    await waitFor(() => screen.getByPlaceholderText('Nom *'))
    const cancelBtns = screen.getAllByRole('button', { name: /cancel·lar/i })
    fireEvent.click(cancelBtns.find(b => b.closest('[class*="bg-sagals-light"]'))!)
    await waitFor(() => expect(screen.queryByPlaceholderText('Nom *')).not.toBeInTheDocument())
  })

  it('desar participant deshabilitat si no hi ha nom', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    fireEvent.click(screen.getByRole('button', { name: /afegir$/i }))
    await waitFor(() => screen.getByPlaceholderText('Nom *'))
    const saveBtn = screen.getAllByRole('button', { name: /desar/i }).find(b => b.closest('[class*="bg-sagals-light"]'))
    expect(saveBtn).toBeDisabled()
  })

  it('cerca participants per nom', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    const searchInput = screen.getByPlaceholderText('Cercar...')
    await userEvent.type(searchInput, 'Anna')
    await waitFor(() => expect(screen.getByText('Anna Vila')).toBeInTheDocument())
    expect(screen.queryByText('Pau Serra')).not.toBeInTheDocument()
  })

  it('mostra missatge si la cerca no dona resultats', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Anna Vila'))
    const searchInput = screen.getByPlaceholderText('Cercar...')
    await userEvent.type(searchInput, 'xyz')
    await waitFor(() => expect(screen.getByText(/cap resultat/i)).toBeInTheDocument())
  })

  it('mostra botó sincronitzar quan hi ha participants i form_id', async () => {
    setup(activeEventWithForm, participants)
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: /sincronitzar/i })).toBeInTheDocument())
  })

  it('sincronitzar mostra confirmació', async () => {
    setup(activeEventWithForm, participants)
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /sincronitzar/i }))
    fireEvent.click(screen.getByRole('button', { name: /sincronitzar/i }))
    await waitFor(() => screen.getByText(/es tornaran a importar/i))
  })

  it('confirmar sincronitzar esborra i navega', async () => {
    setup(activeEventWithForm, participants)
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /sincronitzar/i }))
    fireEvent.click(screen.getByRole('button', { name: /sincronitzar/i }))
    await waitFor(() => screen.getByText(/es tornaran a importar/i))
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(mockDel).toHaveBeenCalled())
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/events/1/import-form'))
  })

  it('cancel·la sincronitzar', async () => {
    setup(activeEventWithForm, participants)
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /sincronitzar/i }))
    fireEvent.click(screen.getByRole('button', { name: /sincronitzar/i }))
    await waitFor(() => screen.getByText(/es tornaran a importar/i))
    const cancelBtns = screen.getAllByRole('button', { name: /cancel·lar/i })
    fireEvent.click(cancelBtns[cancelBtns.length - 1])
    await waitFor(() => expect(screen.queryByText(/es tornaran a importar/i)).not.toBeInTheDocument())
  })

  it('toggle reviewed en participant amb atenció', async () => {
    setup(draftEvent, participantsWithAttention)
    mockPatch.mockResolvedValue({ data: { ...participantsWithAttention[1], reviewed: true } })
    renderAdmin()
    await waitFor(() => screen.getByText(/atenció/i))
    const reviewBtn = screen.getAllByTitle('Marcar com a revisat')[0]
    fireEvent.click(reviewBtn)
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/participants/2', { reviewed: true }))
  })

  it('mostra secció atenció quan hi ha participants amb atenció', async () => {
    setup(draftEvent, participantsWithAttention)
    renderAdmin()
    await waitFor(() => screen.getByText(/atenció/i))
  })

  it('mostra acompanyants i observacions dels participants', async () => {
    setup(draftEvent, participantsWithAttention)
    renderAdmin()
    await waitFor(() => screen.getByText(/atenció/i))
    expect(screen.getAllByText('2 acompanyants').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Necessitia seient').length).toBeGreaterThan(0)
  })

  it('mostra secció transport propi per participants sense bus', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Joan Pla'))
    expect(screen.getByText('Transport propi')).toBeInTheDocument()
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

  it('cancel·la edició bus', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByRole('button', { name: 'Editar Bus Vic' }))
    await waitFor(() => screen.getByDisplayValue('Bus Vic'))
    const cancelBtns = screen.getAllByRole('button', { name: /cancel·lar/i })
    fireEvent.click(cancelBtns[cancelBtns.length - 1])
    await waitFor(() => expect(screen.queryByDisplayValue('Bus Vic')).not.toBeInTheDocument())
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
    mockPost.mockResolvedValue({ data: { id: 3, event_id: 1, label: 'Bus Nou', direction: 'anada', departure_time: '', order: 3 } })
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /afegir bus/i }))
    fireEvent.click(screen.getByRole('button', { name: /afegir bus/i }))
    await waitFor(() => screen.getByPlaceholderText(/Bus 1/i))
    await userEvent.type(screen.getByPlaceholderText(/Bus 1/i), 'Bus Nou')
    fireEvent.click(screen.getByRole('button', { name: /desar/i }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/events/1/buses', expect.objectContaining({ label: 'Bus Nou' })))
    await waitFor(() => expect(screen.getByText('Bus Nou')).toBeInTheDocument())
  })

  it('afegir bus deshabilitat si no hi ha etiqueta', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /afegir bus/i }))
    fireEvent.click(screen.getByRole('button', { name: /afegir bus/i }))
    await waitFor(() => screen.getByPlaceholderText(/Bus 1/i))
    const saveBtn = screen.getAllByRole('button', { name: /desar/i }).find(b => b.closest('[class*="bg-sagals-light"]'))
    expect(saveBtn).toBeDisabled()
  })

  it('cancel·la afegir bus', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /afegir bus/i }))
    fireEvent.click(screen.getByRole('button', { name: /afegir bus/i }))
    await waitFor(() => screen.getByPlaceholderText(/Bus 1/i))
    const cancelBtns = screen.getAllByRole('button', { name: /cancel·lar/i })
    fireEvent.click(cancelBtns[cancelBtns.length - 1])
    await waitFor(() => expect(screen.queryByPlaceholderText(/Bus 1/i)).not.toBeInTheDocument())
  })

  it('canvia direcció del bus en edició', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByRole('button', { name: 'Editar Bus Vic' }))
    await waitFor(() => screen.getByDisplayValue('Bus Vic'))
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'tornada' } })
    fireEvent.click(screen.getByRole('button', { name: /desar/i }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/buses/1', expect.objectContaining({ direction: 'tornada' })))
  })

  it('canvia hora de sortida del bus en edició', async () => {
    setup()
    renderAdmin()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByRole('button', { name: 'Editar Bus Vic' }))
    await waitFor(() => screen.getByDisplayValue('Bus Vic'))
    const timeInputs = screen.getAllByDisplayValue('08:00')
    fireEvent.change(timeInputs[0], { target: { value: '10:00' } })
    fireEvent.click(screen.getByRole('button', { name: /desar/i }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/buses/1', expect.objectContaining({ departure_time: '10:00' })))
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

  it('copia l\'enllaç al porta-retalls', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    setup(activeEvent)
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /copiar/i }))
    fireEvent.click(screen.getByRole('button', { name: /copiar/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Copiat!')).toBeInTheDocument())
  })

  it('comparteix amb navigator.share si està disponible', async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { share: shareFn })
    setup(activeEvent)
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /compartir/i }))
    fireEvent.click(screen.getByRole('button', { name: /compartir/i }))
    await waitFor(() => expect(shareFn).toHaveBeenCalled())
  })

  it('copia si navigator.share no està disponible', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText }, share: undefined })
    setup(activeEvent)
    renderAdmin()
    await waitFor(() => screen.getByRole('button', { name: /compartir/i }))
    fireEvent.click(screen.getByRole('button', { name: /compartir/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
  })

  it('obre l\'enllaç de la llista', async () => {
    setup(activeEvent)
    renderAdmin()
    await waitFor(() => screen.getByRole('link', { name: /obrir/i }))
    const link = screen.getByRole('link', { name: /obrir/i })
    expect(link).toHaveAttribute('href')
  })
})

describe('EventAdmin - seccions', () => {
  const manyParts = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1, event_id: 1, first_name: `P${i}`, last_name: 'Test', last_name2: '', nickname: '',
    transport_raw: 'Propi', companions: '', observations: '', reviewed: false, trips: [],
  }))

  it('mostra botó mostra tots quan la secció té més de 6 participants', async () => {
    setup(draftEvent, manyParts)
    renderAdmin()
    await waitFor(() => screen.getByText('Mostra tots (8)'))
    fireEvent.click(screen.getByText('Mostra tots (8)'))
    await waitFor(() => screen.getByText('Amaga'))
  })

  it('amaga secció expandida', async () => {
    setup(draftEvent, manyParts)
    renderAdmin()
    await waitFor(() => screen.getByText('Mostra tots (8)'))
    fireEvent.click(screen.getByText('Mostra tots (8)'))
    await waitFor(() => screen.getByText('Amaga'))
    fireEvent.click(screen.getByText('Amaga'))
    await waitFor(() => screen.getByText('Mostra tots (8)'))
  })
})

describe('EventAdmin - atenció i revisats', () => {
  it('collapsa i expandeix la secció atenció', async () => {
    setup(draftEvent, participantsWithAttention)
    renderAdmin()
    await waitFor(() => screen.getByText(/atenció/i))
    const toggleBtn = screen.getByRole('button', { name: '' })
    fireEvent.click(toggleBtn)
  })

  it('mostra secció revisats amb toggle', async () => {
    const reviewedParts = participantsWithAttention.map(p => ({ ...p, reviewed: true }))
    setup(draftEvent, reviewedParts)
    renderAdmin()
    await waitFor(() => screen.getByText(/revisats/i))
    fireEvent.click(screen.getByRole('button', { name: /revisats/i }))
  })

  it('desmarca participant com a revisat', async () => {
    const reviewedParts = participantsWithAttention.map(p => ({ ...p, reviewed: true }))
    mockPatch.mockResolvedValue({ data: { ...participantsWithAttention[1], reviewed: false } })
    setup(draftEvent, reviewedParts)
    renderAdmin()
    await waitFor(() => screen.getByText(/revisats/i))
    fireEvent.click(screen.getByRole('button', { name: /revisats/i }))
    await waitFor(() => screen.getAllByTitle('Desmarcar'))
    fireEvent.click(screen.getAllByTitle('Desmarcar')[0])
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/participants/2', { reviewed: false }))
  })
})
