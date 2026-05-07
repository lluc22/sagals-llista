import { Socket, Channel } from 'phoenix'

const BASE_WS = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/^http/, 'ws')

let socket: Socket | null = null

export function connectSocket(token: string): Socket {
  socket = new Socket(`${BASE_WS}/socket`, { params: { token } })
  socket.connect()
  return socket
}

export function joinAttendanceChannel(
  busId: number,
  direction: string,
  onUpdate: (payload: AttendanceUpdate) => void
): Channel {
  if (!socket) throw new Error('Socket not connected')
  const channel = socket.channel(`attendance:${busId}:${direction}`, {})
  channel.on('update', onUpdate)
  channel.join()
  return channel
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export interface AttendanceUpdate {
  trip_id: number
  status: 'pendent' | 'present' | 'absent'
  marked_at: string | null
  marked_by: string | null
}
