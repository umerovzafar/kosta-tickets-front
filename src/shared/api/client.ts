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
