import { apiFetch } from '@shared/api'
import { getAccessToken } from '@shared/lib'
import { getApiBaseUrl, getTicketsWsUrl } from '@shared/config'
import type { Ticket, Comment, StatusItem, PriorityItem, TicketsParams } from './model/types'
import { buildTicketsPayload } from './lib/query'
import { BASE } from './lib/constants'

type PendingEntry = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
}

const PENDING_TIMEOUT_MS = 30_000

let ws: WebSocket | null = null
let lastConnectToken: string | null = null
const pending = new Map<string, PendingEntry>()
const pushHandlers = new Set<(msg: Record<string, unknown>) => void>()

function getRequestId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function rejectAllPending(reason: Error): void {
  for (const [, entry] of pending) {
    clearTimeout(entry.timeoutId)
    entry.reject(reason)
  }
  pending.clear()
}

/** GET /api/v1/tickets/ws-url — без авторизации; см. TICKETS_FRONTEND.md */
async function resolveWsBaseUrl(): Promise<string> {
  try {
    const res = await apiFetch(`${BASE}/ws-url`, { skipAuth: true })
    if (res.ok) {
      const data = (await res.json()) as { url?: string }
      if (typeof data.url === 'string' && data.url.trim()) return data.url.trim()
    }
  } catch {
  }
  const fallback = getTicketsWsUrl()
  if (!fallback) throw new Error('Tickets WebSocket URL not configured')
  return fallback
}

function appendTokenToWsUrl(baseUrl: string, token: string): string {
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}token=${encodeURIComponent(token)}`
}

function connect(token: string): Promise<WebSocket> {
  return resolveWsBaseUrl()
    .then(
      (base) =>
        new Promise<WebSocket>((resolve, reject) => {
          const url = appendTokenToWsUrl(base, token)
          const socket = new WebSocket(url)
          socket.onopen = () => resolve(socket)
          socket.onerror = () => reject(new Error('WebSocket connection failed'))
          socket.onclose = () => {
            if (ws !== socket) return
            ws = null
            lastConnectToken = null
            rejectAllPending(new Error('WebSocket closed'))
          }
          socket.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data as string) as Record<string, unknown> & {
                request_id?: string
                result?: unknown
                error?: string
                push?: boolean
              }

              if (msg.push === true && pushHandlers.size > 0) {
                for (const h of pushHandlers) {
                  try {
                    h(msg)
                  } catch {
                  }
                }
                return
              }

              const id = msg.request_id
              if (typeof id === 'string' && pending.has(id)) {
                const p = pending.get(id)!
                pending.delete(id)
                clearTimeout(p.timeoutId)
                if (msg != null && typeof msg.error === 'string' && msg.error) p.reject(new Error(msg.error))
                else p.resolve(msg.result)
              }
            } catch {
            }
          }
        }),
    )
}

async function ensureSocket(): Promise<WebSocket> {
  const token = getAccessToken()?.trim()
  if (!token) throw new Error('Нет токена авторизации для WebSocket')

  if (ws?.readyState === WebSocket.OPEN && lastConnectToken === token) return ws

  if (ws) {
    try {
      ws.close()
    } catch {
    }
    ws = null
    rejectAllPending(new Error('WebSocket переподключается'))
  }

  ws = await connect(token)
  lastConnectToken = token
  return ws
}

/**
 * Открывает WebSocket (токен в query — как в TICKETS_FRONTEND.md), чтобы доходили push-события.
 */
export async function connectTicketsWsWhenReady(): Promise<void> {
  if (!getApiBaseUrl()) return
  if (!getAccessToken()?.trim()) return
  try {
    await ensureSocket()
  } catch {
  }
}

/**
 * Подписка на push: `{ "push": true, "event": "...", "ticket_uuid": "...", ... }` (см. TICKETS_FRONTEND.md).
 */
export function subscribeTicketsWsPush(handler: (msg: Record<string, unknown>) => void): () => void {
  pushHandlers.add(handler)
  return () => {
    pushHandlers.delete(handler)
  }
}

/**
 * RPC по WS: только `request_id`, `action`, `payload` — без `token` в теле (авторизация через query при connect).
 */
export async function sendRequest<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const token = getAccessToken()?.trim()
  if (!token) return Promise.reject(new Error('Нет токена авторизации для WebSocket'))

  const socket = await ensureSocket()
  const requestId = getRequestId()
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (pending.delete(requestId)) {
        reject(new Error('Таймаут запроса к WebSocket заявок'))
      }
    }, PENDING_TIMEOUT_MS)

    pending.set(requestId, {
      resolve: (v) => resolve(v as T),
      reject,
      timeoutId,
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
  data: Partial<Pick<Ticket, 'theme' | 'description' | 'attachment_path' | 'status' | 'category' | 'priority'>>,
): Promise<Ticket> {
  return sendRequest<Ticket>('update_ticket', { ticket_uuid: ticketUuid, ...data })
}

export async function archiveTicketWs(ticketUuid: string, isArchived = true): Promise<Ticket> {
  return sendRequest<Ticket>('archive_ticket', { ticket_uuid: ticketUuid, is_archived: isArchived })
}

export async function listCommentsWs(ticketUuid: string): Promise<Comment[]> {
  return sendRequest<Comment[]>('list_comments', { ticket_uuid: ticketUuid })
}

/** user_id подставляет gateway из токена — в payload не передаём (TICKETS_FRONTEND.md). */
export async function addCommentWs(ticketUuid: string, content: string): Promise<Comment> {
  return sendRequest<Comment>('add_comment', { ticket_uuid: ticketUuid, content })
}

export async function editCommentWs(commentId: number, content: string): Promise<Comment> {
  return sendRequest<Comment>('edit_comment', { comment_id: commentId, content })
}

export async function deleteCommentWs(commentId: number): Promise<{ deleted: boolean }> {
  return sendRequest<{ deleted: boolean }>('delete_comment', { comment_id: commentId })
}

export function closeTicketsWs(): void {
  lastConnectToken = null
  if (ws) {
    try {
      ws.close()
    } catch {
    }
    ws = null
  }
  rejectAllPending(new Error('WebSocket closed'))
}
