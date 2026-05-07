const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const ADMIN_TOKEN_KEY = 'sagals_admin_token'

export function getAdminToken() { return localStorage.getItem(ADMIN_TOKEN_KEY) }
export function setAdminToken(t: string) { localStorage.setItem(ADMIN_TOKEN_KEY, t) }
export function clearAdminToken() { localStorage.removeItem(ADMIN_TOKEN_KEY) }
export function isAuthenticated() { return !!getAdminToken() }

async function request<T>(method: string, path: string, body?: unknown, token?: string | null): Promise<T> {
  const authToken = token !== undefined ? token : getAdminToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  if (res.status === 401 && authToken && authToken === getAdminToken()) {
    clearAdminToken()
    window.location.href = '/login'
  }
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Request failed'), { status: res.status, data })
  return data
}

export const api = {
  get:   <T>(path: string, token?: string | null) => request<T>('GET', path, undefined, token),
  post:  <T>(path: string, body?: unknown, token?: string | null) => request<T>('POST', path, body, token),
  put:   <T>(path: string, body?: unknown, token?: string | null) => request<T>('PUT', path, body, token),
  patch: <T>(path: string, body?: unknown, token?: string | null) => request<T>('PATCH', path, body, token),
  del:   (path: string, token?: string | null) => request<void>('DELETE', path, undefined, token),
}
