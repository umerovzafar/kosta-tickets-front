import { apiFetch } from '@shared/api'
import type { User, MicrosoftUser } from './model/types'

export async function getMe(): Promise<User> {
  const res = await apiFetch('/api/v1/users/me')
  if (res.status === 401) throw new Error('Не авторизован')
  if (!res.ok) throw new Error('Не удалось загрузить профиль')
  return res.json()
}

export async function getUser(id: number): Promise<User> {
  const res = await apiFetch(`/api/v1/users/${id}`)
  if (res.status === 401) throw new Error('Не авторизован')
  if (res.status === 403) throw new Error('Доступ запрещён')
  if (res.status === 404) throw new Error('Пользователь не найден')
  if (!res.ok) throw new Error('Не удалось загрузить пользователя')
  return res.json()
}

export async function getUsers(includeArchived = false): Promise<User[]> {
  const params = new URLSearchParams()
  params.set('include_archived', String(includeArchived))

  const res = await apiFetch(`/api/v1/users?${params.toString()}`)

  if (res.status === 401) throw new Error('Не авторизован')
  if (res.status === 403) throw new Error('Доступ запрещён (нужна роль Администратор)')
  if (!res.ok) throw new Error('Не удалось загрузить пользователей')

  return res.json()
}

export async function setUserRole(userId: number, role: string): Promise<User> {
  const res = await apiFetch(`/api/v1/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })

  if (res.status === 401) throw new Error('Не авторизован')
  if (res.status === 403) throw new Error('Доступ запрещён (нужна роль Администратор)')
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err as { detail?: string } | null)?.detail ?? 'Не удалось изменить роль')
  }

  return res.json()
}

export async function setUserBlocked(userId: number, isBlocked: boolean): Promise<User> {
  const res = await apiFetch(`/api/v1/users/${userId}/block`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_blocked: isBlocked }),
  })

  if (res.status === 401) throw new Error('Не авторизован')
  if (res.status === 403) throw new Error('Доступ запрещён (нужна роль Администратор)')
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err as { detail?: string } | null)?.detail ?? 'Не удалось изменить блокировку')
  }

  return res.json()
}

export async function setUserArchived(userId: number, isArchived: boolean): Promise<User> {
  const res = await apiFetch(`/api/v1/users/${userId}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_archived: isArchived }),
  })

  if (res.status === 401) throw new Error('Не авторизован')
  if (res.status === 403) throw new Error('Доступ запрещён (нужна роль Администратор)')
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err as { detail?: string } | null)?.detail ?? 'Не удалось изменить архивный статус')
  }

  return res.json()
}

export async function setTimeTrackingRole(
  userId: number,
  timeTrackingRole: 'user' | 'manager' | null,
): Promise<User> {
  const res = await apiFetch(`/api/v1/users/${userId}/time-tracking-role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ time_tracking_role: timeTrackingRole }),
  })

  if (res.status === 400) throw new Error('Недопустимое значение роли учёта времени')
  if (res.status === 401) throw new Error('Не авторизован')
  if (res.status === 403) throw new Error('Доступ запрещён')
  if (res.status === 404) throw new Error('Пользователь не найден')
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err as { detail?: string } | null)?.detail ?? 'Не удалось изменить роль учёта времени')
  }

  return res.json()
}

export async function setUserPosition(userId: number, position: string | null): Promise<User> {
  const res = await apiFetch(`/api/v1/users/${userId}/position`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position: position ?? null }),
  })

  if (res.status === 401) throw new Error('Не авторизован')
  if (res.status === 403) throw new Error('Доступ запрещён')
  if (res.status === 404) throw new Error('Пользователь не найден')
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err as { detail?: string } | null)?.detail ?? 'Не удалось изменить должность')
  }

  return res.json()
}

export async function uploadDesktopBackground(file: File): Promise<User> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiFetch('/api/v1/users/me/desktop-background', {
    method: 'POST',
    body: formData,
  })
  if (res.status === 400) throw new Error('Неверный формат или размер файла (максимум 5 МБ, форматы: jpg, png, gif, webp)')
  if (res.status === 401) throw new Error('Не авторизован')
  if (!res.ok) throw new Error('Не удалось загрузить фон')
  return res.json()
}

export async function deleteDesktopBackground(): Promise<User> {
  const res = await apiFetch('/api/v1/users/me/desktop-background', {
    method: 'DELETE',
  })
  if (res.status === 401) throw new Error('Не авторизован')
  if (!res.ok) throw new Error('Не удалось удалить фон')
  return res.json()
}


export async function getMicrosoftUsers(): Promise<MicrosoftUser[]> {
  const res = await apiFetch('/api/v1/users/microsoft')

  if (res.status === 401) throw new Error('Не авторизован')
  if (res.status === 403) throw new Error('Токены Microsoft Graph не найдены — войдите через Microsoft')
  if (!res.ok) throw new Error('Не удалось загрузить пользователей Microsoft')

  return res.json()
}
