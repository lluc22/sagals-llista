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
  { id: 2, label: 'Bus Vic Tornada', direction: 'tornada', departure_time: '18:00', order: 2 },
]

const castellers = [
  { id: 306, mote: 'Mates' },
  { id: 307, mote: 'Coll' },
]

const tripsPendent = [
  {
    trip_id: 1,
    participant: { id: 1, first_name: 'Andreu', last_name: 'Huguet', last_name2: 'Segarra', nickname: 'Mates', companions: '', observations: '' },
    attendance: { id: 1, status: 'pendent', marked_at: null, marked_by: null },
  },
  {
    trip_id: 2,
    participant: { id: 2, first_name: 'Marc', last_name: 'Coll', last_name2: '', nickname: '', companions: '', observations: '' },
    attendance: { id: 2, status: 'pendent', marked_at: null, marked_by: null },
  },
]

const tripsMixed = [
  {
    trip_id: 1,
    participant: { id: 1, first_name: 'Andreu', last_name: 'Huguet', last_name2: 'Segarra', nickname: 'Mates', companions: '', observations: '' },
    attendance: { id: 1, status: 'present', marked_at: null, marked_by: null },
  },
  {
    trip_id: 2,
    participant: { id: 2, first_name: 'Marc', last_name: 'Coll', last_name2: '', nickname: '', companions: '', observations: '' },
    attendance: { id: 2, status: 'absent', marked_at: null, marked_by: null },
  },
  {
    trip_id: 3,
    participant: { id: 3, first_name: 'Joana', last_name: 'Pla', last_name2: '', nickname: '', companions: '2 acompanyants', observations: '' },
    attendance: { id: 3, status: 'pendent', marked_at: null, marked_by: null },
  },
]

function setupMocks(tripData = tripsPendent) {
  mockPost.mockResolvedValue({ token: 'list-jwt' })
  mockGet.mockImplementation((path: string) => {
    if (path.includes('/castellers'))     return Promise.resolve({ data: castellers })
    if (path.includes('/buses/1/anada'))  return Promise.resolve({ data: tripData })
    if (path.includes('/buses/2/tornada')) return Promise.resolve({ data: tripData })
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
    expect(screen.getByText('Tornada')).toBeInTheDocument()
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

  it('mostra error si el token és invàlid', async () => {
    mockPost.mockRejectedValueOnce(new Error('invalid'))
    mockGet.mockImplementation((path: string) => {
      if (path.includes('/buses')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    render(
      <MemoryRouter initialEntries={['/list/festa?t=bad-token']}>
        <Routes>
          <Route path="/list/:slug" element={<ListPage />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText(/no vàlid/i)).toBeInTheDocument())
  })

  it('mostra error si fallen les dades del bus', async () => {
    mockPost.mockResolvedValue({ token: 'list-jwt' })
    mockGet.mockRejectedValueOnce(new Error('network error'))
    renderListPage()
    await waitFor(() => expect(screen.getByText(/error carregant/i)).toBeInTheDocument())
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

    await new Promise(r => setTimeout(r, 50))

    const picCalls = mockGet.mock.calls.filter(c => String(c[0]).includes('profile_pic/307'))
    expect(picCalls.length).toBe(0)
  })
})

describe('ListPage - assistència', () => {
  async function openTripList(tripData = tripsPendent) {
    setupMocks(tripData)
    renderListPage()
    await waitFor(() => screen.getByText('Bus Vic'))
    fireEvent.click(screen.getByText('Bus Vic'))
    await waitFor(() => screen.getByText(/Mates/))
  }

  it('mostra Pendent per a participants no marcats', async () => {
    await openTripList()
    expect(screen.getAllByText('Pendent').length).toBeGreaterThan(0)
  })

  it('mostra barra de cerca', async () => {
    await openTripList()
    expect(screen.getByPlaceholderText(/cercar/i)).toBeInTheDocument()
  })

  it('filtra participants per nom', async () => {
    await openTripList()
    const search = screen.getByPlaceholderText(/cercar/i)
    fireEvent.change(search, { target: { value: 'Andreu' } })
    await waitFor(() => {
      expect(screen.getByText(/Mates.*Andreu/)).toBeInTheDocument()
    })
  })

  it('clica enrere torna al selector de busos', async () => {
    await openTripList()
    fireEvent.click(screen.getByText(/canviar bus/i))
    await waitFor(() => {
      expect(screen.getByText('Bus Vic')).toBeInTheDocument()
    })
  })

  it('mostra secció Present quan hi ha participants presents', async () => {
    await openTripList(tripsMixed)
    await waitFor(() => expect(screen.getByText(/Presents/)).toBeInTheDocument())
  })

  it('mostra secció Absent quan hi ha participants absents', async () => {
    await openTripList(tripsMixed)
    await waitFor(() => expect(screen.getByText(/Absents/)).toBeInTheDocument())
  })

  it('mostra participants amb acompanyants', async () => {
    await openTripList(tripsMixed)
    await waitFor(() => expect(screen.getByText('2 acompanyants')).toBeInTheDocument())
  })

  it('col·lapsa secció pendent', async () => {
    await openTripList()
    const pendentHeaders = screen.getAllByText(/Pendents/)
    fireEvent.click(pendentHeaders[0])
  })

  it('mostra contador de presents al header', async () => {
    await openTripList(tripsMixed)
    await waitFor(() => expect(screen.getByText(/1\s*\/\s*3/)).toBeInTheDocument())
  })

  it('mostra missatge quan no hi ha resultats de cerca', async () => {
    await openTripList()
    const search = screen.getByPlaceholderText(/cercar/i)
    fireEvent.change(search, { target: { value: 'xyznonexistent' } })
    await waitFor(() => expect(screen.getByText(/cap resultat/i)).toBeInTheDocument())
  })

  it('mostra Tothom comptabilitzat quan no hi ha pendents', async () => {
    const allPresent = tripsMixed.map(t => ({ ...t, attendance: { ...t.attendance, status: 'present' as const } }))
    await openTripList(allPresent)
    await waitFor(() => expect(screen.getByText(/tothom comptabilitzat/i)).toBeInTheDocument())
  })

  it('marca participant com a present', async () => {
    mockPost.mockResolvedValue({})
    await openTripList()
    const nameEl = screen.getByText('Mates (Andreu Huguet Segarra)')
    fireEvent.click(nameEl.closest('[class]')!)
    await waitFor(() => {
      const presentBtn = screen.queryAllByRole('button').find(b => b.textContent?.trim() === 'Present')
      if (presentBtn) fireEvent.click(presentBtn)
    })
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/list/attendance', expect.objectContaining({ status: 'present' }), 'list-jwt'))
  })
})