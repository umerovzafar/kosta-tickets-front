import { getTicketsWsUrl } from '@shared/config'
import type { Ticket, Comment, StatusItem, PriorityItem, TicketsParams } from './model/types'
import { buildTicketsPayload } from './lib/query'

type Pending = { resolve: (value: unknown) => void; reject: (reason: Error) => void }

let ws: WebSocket | null = null
const pending = new Map<string, Pending>()

function getRequestId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function connect(): Promise<WebSocket> {
  const url = getTicketsWsUrl()
  if (!url) return Promise.reject(new Error('Tickets WebSocket URL not configured'))
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.onopen = () => resolve(socket)
    socket.onerror = () => reject(new Error('WebSocket connection failed'))
    socket.onclose = () => {
      ws = null
      pending.forEach(({ reject }) => reject(new Error('WebSocket closed')))
      pending.clear()
    }
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          request_id?: string
          result?: unknown
          error?: string
        }
        const id = msg.request_id
        if (id && pending.has(id)) {
          const p = pending.get(id)!
          pending.delete(id)
          if (msg.error) p.reject(new Error(msg.error))
          else p.resolve(msg.result)
        }
      } catch {
      }
    }
  })
}

async function ensureSocket(): Promise<WebSocket> {
  if (ws?.readyState === WebSocket.OPEN) return ws
  ws = await connect()
  return ws
}

export async function sendRequest<T>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const socket = await ensureSocket()
  const requestId = getRequestId()
  return new Promise<T>((resolve, reject) => {
    pending.set(requestId, {
      resolve: (v) => resolve(v as T),
      reject,
    })
    socket.send(JSON.stringify({ action, payload, request_id: requestId }))
  })
}

export async function listStatusesWs(): Promise<StatusItem[]> {
  return sendRequest<StatusItem[]>('list_statuses', {})
}

export async function listPrioritiesWs(): Promise<PriorityItem[]> {
  return sendRequest<PriorityItem[]>('list_priorities', {})
}

export async function listTicketsWs(params: TicketsParams = {}): Promise<Ticket[]> {
  return sendRequest<Ticket[]>('list_tickets', buildTicketsPayload(params))
}

export async function getTicketWs(ticketUuid: string): Promise<Ticket> {
  return sendRequest<Ticket>('get_ticket', { ticket_uuid: ticketUuid })
}

export async function updateTicketWs(
  ticketUuid: string,
  data: Partial<Pick<Ticket, 'theme' | 'description' | 'attachment_path' | 'status' | 'category' | 'priority'>>
): Promise<Ticket> {
  return sendRequest<Ticket>('update_ticket', { ticket_uuid: ticketUuid, ...data })
}

export async function archiveTicketWs(ticketUuid: string, isArchived = true): Promise<Ticket> {
  return sendRequest<Ticket>('archive_ticket', { ticket_uuid: ticketUuid, is_archived: isArchived })
}

export async function listCommentsWs(ticketUuid: string): Promise<Comment[]> {
  return sendRequest<Comment[]>('list_comments', { ticket_uuid: ticketUuid })
}

export async function addCommentWs(ticketUuid: string, userId: number, content: string): Promise<Comment> {
  return sendRequest<Comment>('add_comment', { ticket_uuid: ticketUuid, user_id: userId, content })
}

export async function editCommentWs(commentId: number, content: string): Promise<Comment> {
  return sendRequest<Comment>('edit_comment', { comment_id: commentId, content })
}

export async function deleteCommentWs(commentId: number): Promise<{ deleted: boolean }> {
  return sendRequest<{ deleted: boolean }>('delete_comment', { comment_id: commentId })
}

export function closeTicketsWs(): void {
  if (ws) {
    ws.close()
    ws = null
  }
  pending.clear()
}
