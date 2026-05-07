import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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
    <MemoryRouter>
      <NewEvent />
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
    mockPost.mockResolvedValueOnce({ data: { id: 123 } }) // event
    mockPost.mockResolvedValueOnce({ data: { id: 1 } })   // bus

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
})
