import { closeTicketsWs } from '@entities/ticket/ticketsWs'
import { resetNotificationsClient } from '@entities/notifications/wsClient'
import { getAzureLogoutUrl, getAzureLoginUrl } from '@shared/config'

const TOKEN_KEY = 'access_token'

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken())
}

export function logout(): void {
  try {
    closeTicketsWs()
  } catch {
    /* ignore */
  }
  try {
    resetNotificationsClient()
  } catch {
    /* ignore */
  }
  removeAccessToken()

  const azureLogoutUrl = getAzureLogoutUrl()
  if (azureLogoutUrl) {
    window.location.href = azureLogoutUrl
  } else {
    window.location.href = getAzureLoginUrl() || '/'
  }
}
