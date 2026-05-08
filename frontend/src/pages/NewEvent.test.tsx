import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NewEvent from './NewEvent'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}))

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: { post: mockPost },
}))

function renderNewEvent() {
  return render(
    <MemoryRouter initialEntries={['/events/new']}>
      <Routes>
        <Route path="/events/new" element={<NewEvent />} />
        <Route path="/events/new-from-form" element={<div>New from form</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NewEvent', () => {
  it('mostra el formulari bàsic', () => {
    renderNewEvent()
    expect(screen.getByPlaceholderText(/Festa Major/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Data/i)).toBeInTheDocument()
  })

  it('torna enrere amb el botó fletxa', async () => {
    renderNewEvent()
    const backBtn = screen.getAllByRole('button').find(b => b.querySelector('svg'))
    if (backBtn) fireEvent.click(backBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('navega a importar des de formulari', async () => {
    renderNewEvent()
    fireEvent.click(screen.getByRole('button', { name: /importar des de formulari/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/events/new-from-form')
  })

  it('afegir bus mostra el camp etiqueta', async () => {
    renderNewEvent()
    await userEvent.click(screen.getByText(/Afegir bus/i))
    expect(screen.getByPlaceholderText(/Bus 1/i)).toBeInTheDocument()
  })

  it('eliminar bus treu el bus de la llista', async () => {
    renderNewEvent()
    await userEvent.click(screen.getByText(/Afegir bus/i))
    expect(screen.getByText('Bus 1')).toBeInTheDocument()

    fireEvent.click(document.querySelector('[data-testid="remove-bus-0"]')!)
    expect(screen.queryByText('Bus 1')).not.toBeInTheDocument()
  })

  it('canviar etiqueta del bus', async () => {
    renderNewEvent()
    await userEvent.click(screen.getByText(/Afegir bus/i))
    const labelInput = screen.getByPlaceholderText(/Bus 1/i)
    await userEvent.type(labelInput, 'Bus Vic')
    expect(labelInput).toHaveValue('Bus Vic')
  })

  it('canviar hora de sortida del bus', async () => {
    renderNewEvent()
    await userEvent.click(screen.getByText(/Afegir bus/i))
    const inputs = document.querySelectorAll('input[type="time"]')
    fireEvent.change(inputs[0], { target: { value: '08:00' } })
    expect((inputs[0] as HTMLInputElement).value).toBe('08:00')
  })

  it('canviar direcció del bus', async () => {
    renderNewEvent()
    await userEvent.click(screen.getByText(/Afegir bus/i))
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'tornada' } })
    expect(selects[0]).toHaveValue('tornada')
  })

  it('submit sense busos mostra error', async () => {
    renderNewEvent()
    await userEvent.type(screen.getByPlaceholderText(/Festa Major/i), 'Vic 2025')
    await userEvent.type(screen.getByLabelText(/Data/i), '2025-06-01')

    fireEvent.submit(screen.getByRole('button', { name: /Crear/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/almenys un bus/i)).toBeInTheDocument()
    })
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('submit correcte crida post i navega a setup', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 123 } })
    mockPost.mockResolvedValueOnce({ data: { id: 1 } })

    renderNewEvent()
    await userEvent.type(screen.getByPlaceholderText(/Festa Major/i), 'Vic 2025')
    await userEvent.type(screen.getByLabelText(/Data/i), '2025-06-01')
    await userEvent.click(screen.getByText(/Afegir bus/i))
    await userEvent.type(screen.getByPlaceholderText(/Bus 1/i), 'Bus Vic')

    fireEvent.submit(screen.getByRole('button', { name: /Crear/i }).closest('form')!)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events/123/setup')
    })
  })

  it('submit amb error mostra missatge d\'error', async () => {
    mockPost.mockRejectedValueOnce({ status: 422, data: { errors: { name: ['ja existeix'] } } })

    renderNewEvent()
    await userEvent.type(screen.getByPlaceholderText(/Festa Major/i), 'Vic 2025')
    await userEvent.type(screen.getByLabelText(/Data/i), '2025-06-01')
    await userEvent.click(screen.getByText(/Afegir bus/i))

    fireEvent.submit(screen.getByRole('button', { name: /Crear/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })

  it('submit amb error genèric mostra missatge', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'))

    renderNewEvent()
    await userEvent.type(screen.getByPlaceholderText(/Festa Major/i), 'Vic 2025')
    await userEvent.type(screen.getByLabelText(/Data/i), '2025-06-01')
    await userEvent.click(screen.getByText(/Afegir bus/i))

    fireEvent.submit(screen.getByRole('button', { name: /Crear/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it('retry amb conflicte de slug', async () => {
    const slugError = { status: 422, data: { errors: { slug: ['ja existeix'] } } }
    mockPost.mockRejectedValueOnce(slugError)
    mockPost.mockResolvedValueOnce({ data: { id: 456 } })
    mockPost.mockResolvedValueOnce({ data: { id: 1 } })

    renderNewEvent()
    await userEvent.type(screen.getByPlaceholderText(/Festa Major/i), 'Vic 2025')
    await userEvent.type(screen.getByLabelText(/Data/i), '2025-06-01')
    await userEvent.click(screen.getByText(/Afegir bus/i))

    fireEvent.submit(screen.getByRole('button', { name: /Crear/i }).closest('form')!)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events/456/setup')
    })
  })

  it('mostra estat de guardant durant submit', async () => {
    let resolvePost: (value: unknown) => void
    mockPost.mockImplementation(() => new Promise(resolve => { resolvePost = resolve }))

    renderNewEvent()
    await userEvent.type(screen.getByPlaceholderText(/Festa Major/i), 'Vic 2025')
    await userEvent.type(screen.getByLabelText(/Data/i), '2025-06-01')
    await userEvent.click(screen.getByText(/Afegir bus/i))

    fireEvent.submit(screen.getByRole('button', { name: /Crear/i }).closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/guardant/i)).toBeInTheDocument()
    })
    resolvePost!({ data: { id: 1 } })
  })
})