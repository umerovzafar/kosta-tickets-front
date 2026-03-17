import { getAzureLogoutUrl, getAdminLoginUrl, getAzureLoginUrl } from '@shared/config'

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
  removeAccessToken()
  const azureLogoutUrl = getAzureLogoutUrl()
  if (azureLogoutUrl) {
    window.location.href = azureLogoutUrl
  } else {
    window.location.href = getAzureLoginUrl() || '/'
  }
}

export interface AdminLoginResult {
  access_token: string
  token_type: string
}

export async function adminLogin(
  username: string,
  password: string,
): Promise<AdminLoginResult> {
  const url = getAdminLoginUrl()
  if (!url) throw new Error('API URL не настроен')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (response.status === 401) {
    throw new Error('Неверный логин или пароль')
  }

  if (response.status === 502) {
    throw new Error('Сервис авторизации недоступен')
  }

  if (!response.ok) {
    throw new Error(`Ошибка входа (${response.status})`)
  }

  return response.json() as Promise<AdminLoginResult>
}
