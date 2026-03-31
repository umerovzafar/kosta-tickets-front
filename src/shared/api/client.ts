import { getApiBaseUrl, getAzureLoginUrl } from '@shared/config'
import { getAccessToken, removeAccessToken } from '@shared/lib'

type RequestInitAuth = RequestInit & { skipAuth?: boolean }

export async function apiFetch(
  path: string,
  init: RequestInitAuth = {},
): Promise<Response> {
  const baseUrl = getApiBaseUrl()
  const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const { skipAuth, ...rest } = init
  const headers = new Headers(rest.headers)
  if (!skipAuth) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const response = await fetch(url, { ...rest, headers })
  if (response.status === 401) {
    removeAccessToken()
    window.location.href = getAzureLoginUrl()
    return response
  }
  return response
}

export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl()
  return path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Fetches a media file from /api/v1/media/{path} with Authorization header
 * and returns a temporary blob URL. The caller is responsible for calling
 * URL.revokeObjectURL() when the URL is no longer needed.
 */
export async function fetchMediaBlob(mediaPath: string): Promise<string> {
  const path = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath
  const res = await apiFetch(`/api/v1/media/${path}`)
  if (!res.ok) throw new Error(`Media load failed (${res.status})`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

const MEDIA_API_PREFIX = '/api/v1/media/'

/** Из полного или относительного URL извлекает путь после `/api/v1/media/` для {@link fetchMediaBlob}. */
export function getMediaPathFromMediaUrl(url: string): string | null {
  const t = url.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t)
      const p = u.pathname
      const idx = p.indexOf(MEDIA_API_PREFIX)
      if (idx >= 0) return p.slice(idx + MEDIA_API_PREFIX.length)
    } catch {
      return null
    }
    return null
  }
  const path = t.startsWith('/') ? t : `/${t}`
  const idx = path.indexOf(MEDIA_API_PREFIX)
  if (idx >= 0) return path.slice(idx + MEDIA_API_PREFIX.length)
  const normalized = path.replace(/^\/+/, '')
  if (normalized.startsWith('api/v1/media/')) return normalized.slice('api/v1/media/'.length)
  return null
}

/**
 * Загружает файл с Authorization и возвращает временный blob URL для показа в &lt;img&gt; (или в новой вкладке).
 * Обычный открытый URL на /api/v1/media/… без токена даёт 401.
 * Вызывающий обязан вызвать URL.revokeObjectURL() после использования.
 */
export async function createAuthenticatedMediaBlobUrl(urlOrPath: string): Promise<string> {
  const mediaPath = getMediaPathFromMediaUrl(urlOrPath)
  if (mediaPath) {
    return fetchMediaBlob(mediaPath)
  }
  const p = urlOrPath.trim()
  const path = /^https?:\/\//i.test(p) ? p : p.startsWith('/') ? p : `/${p}`
  const res = await apiFetch(path)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `Не удалось загрузить файл (${res.status})`
    try {
      const j = JSON.parse(text) as { detail?: string }
      if (typeof j.detail === 'string') msg = j.detail
    } catch {
      if (text) msg = text
    }
    throw new Error(msg)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
