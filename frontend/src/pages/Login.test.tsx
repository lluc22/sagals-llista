import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}))

const { mockPost, mockSetAdminToken } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockSetAdminToken: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  api: { post: mockPost },
  setAdminToken: mockSetAdminToken,
}))

function renderLogin() {
  return render(<MemoryRouter><Login /></MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

describe('Login', () => {
  it('mostra els camps email i contrasenya', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contrasenya/i)).toBeInTheDocument()
  })

  it('navega a / quan les credencials són correctes', async () => {
    mockPost.mockResolvedValueOnce({ token: 'tok123' })
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'admin@sagals.cat')
    await userEvent.type(screen.getByLabelText(/contrasenya/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('mostra error quan les credencials són incorrectes', async () => {
    mockPost.mockRejectedValueOnce(new Error('unauthorized'))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'admin@sagals.cat')
    await userEvent.type(screen.getByLabelText(/contrasenya/i), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText(/email o contrasenya incorrectes/i)).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('desactiva el botó mentre carrega', async () => {
    mockPost.mockImplementationOnce(() => new Promise(() => {}))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'admin@sagals.cat')
    await userEvent.type(screen.getByLabelText(/contrasenya/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(screen.getByRole('button', { name: /entrant/i })).toBeDisabled()
  })
})
