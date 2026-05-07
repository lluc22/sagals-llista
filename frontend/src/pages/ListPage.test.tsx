import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ListPage from './ListPage'

const { mockChannel } = vi.hoisted(() => ({
  mockChannel: { on: vi.fn(), join: vi.fn().mockReturnThis(), leave: vi.fn() },
}))
vi.mock('../lib/socket', () => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  joinAttendanceChannel: vi.fn().mockReturnValue(mockChannel),
}))

const { mockPost, mockGet } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet:  vi.fn(),
}))
vi.mock('../lib/api', () => ({
  api: { post: mockPost, get: mockGet },
}))

const buses = [
  { id: 1, label: 'Bus Vic', direction: 'anada', departure_time: '08:00', order: 1 },
]

const castellers = [
  { id: 306, mote: 'Mates' },
  { id: 307, mote: 'Coll'  },
]

const trips = [
  {
    trip_id: 1,
    participant: { id: 1, first_name: 'Andreu', last_name: 'Huguet', last_name2: 'Segarra', nickname: 'Mates' },
    attendance: { id: 1, status: 'pendent', marked_at: null, marked_by: null },
  },
  {
    trip_id: 2,
    participant: { id: 2, first_name: 'Marc', last_name: 'Coll', last_name2: '', nickname: '' },
    attendance: { id: 2, status: 'pendent', marked_at: null, marked_by: null },
  },
]

function setupMocks() {
  mockPost.mockResolvedValue({ token: 'list-jwt' })
  mockGet.mockImplementation((path: string) => {
    if (path.includes('/castellers'))     return Promise.resolve({ data: castellers })
    if (path.includes('/buses/1/anada'))  return Promise.resolve({ data: trips })
    if (path.includes('/profile_pic/306')) return Promise.resolve({ base64: 'data:image/jpeg;base64,abc' })
    if (path.includes('/buses'))          return Promise.resolve({ data: buses })
    return Promise.resolve({ data: [] })
  })
}

function renderListPage() {
  return render(
    <MemoryRouter initialEntries={['/list/festa?t=access-token']}>
      <Routes>
        <Route path="/list/:slug" element={<ListPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockChannel.on.mockClear()
  mockChannel.join.mockClear()
  mockChannel.leave.mockClear()
})

describe('ListPage - selector de bus', () => {
  it('mostra el selector de busos després de carregar', async () => {
    setupMocks()
    renderListPage()
    await waitFor(() => expect(screen.getByText('Bus Vic')).toBeInTheDocument())
    expect(screen.getByText('Anada')).toBeInTheDocument()
  })

  it('mostra error si falta el token', async () => {
    render(
      <MemoryRouter initialEntries={['/list/festa']}>
        <Routes>
          <Route path="/list/:slug" element={<ListPage />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText(/falta el token/i)).toBeInTheDocument())
  })
})

describe('ListPage - format del nom', () => {
  async function openBusList() {
    setupMocks()
    renderListPage()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByText('Bus Vic'))
    await waitFor(() => screen.getByText(/Mates/))
  }

  it('mostra sobrenom i nom complet entre parèntesis', async () => {
    await openBusList()
    expect(screen.getByText('Mates (Andreu Huguet Segarra)')).toBeInTheDocument()
  })

  it('mostra nom complet si no hi ha sobrenom', async () => {
    await openBusList()
    expect(screen.getByText('Marc Coll')).toBeInTheDocument()
  })
})

describe('ListPage - fotos', () => {
  it('mostra la foto del casteller quan hi ha correspondència', async () => {
    setupMocks()
    renderListPage()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByText('Bus Vic'))
    await waitFor(() => screen.getByText('Mates (Andreu Huguet Segarra)'))

    await waitFor(() => {
      const imgs = screen.getAllByAltText('')
      const photo = imgs.find(img => img.getAttribute('src') === 'data:image/jpeg;base64,abc')
      expect(photo).toBeTruthy()
    })
  })

  it('demana la foto amb el token de llista', async () => {
    setupMocks()
    renderListPage()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByText('Bus Vic'))
    await waitFor(() => screen.getByText(/Mates/))

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/list/profile_pic/306', 'list-jwt')
    )
  })

  it('no mostra foto per participants sense correspondència', async () => {
    setupMocks()
    renderListPage()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByText('Bus Vic'))
    await waitFor(() => screen.getByText('Marc Coll'))

    // Give time for any potential photo load
    await new Promise(r => setTimeout(r, 50))

    // Marc Coll (no nickname match) should not trigger a profile_pic fetch
    const picCalls = mockGet.mock.calls.filter(c => String(c[0]).includes('profile_pic/307'))
    expect(picCalls.length).toBe(0)
  })
})
