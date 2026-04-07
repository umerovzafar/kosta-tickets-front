import type { User } from '@entities/user'

export type TodoBoardUsers = {
  byId: Map<number, User>
  list: User[]
  loading: boolean
  error: string | null
}

export function buildTodoUserByIdMap(users: readonly User[]): Map<number, User> {
  const m = new Map<number, User>()
  for (const u of users) m.set(u.id, u)
  return m
}

/** Отображаемое имя пользователя из каталога (без «#id»). */
export function todoUserPickLabel(u: User): string {
  return u.display_name?.trim() || u.email || `Участник №${u.id}`
}

export function todoInitialFromDisplayLabel(label: string): string {
  for (const ch of label.trim()) {
    if (/[\p{L}]/u.test(ch)) return ch.toUpperCase()
  }
  const t = label.trim()
  return t ? t[0]!.toUpperCase() : '?'
}

export function todoUserPickInitial(u: User): string {
  return todoInitialFromDisplayLabel(todoUserPickLabel(u))
}

/** Имя участника по id; если в каталоге нет — нейтральная подпись без решётки. */
export function todoParticipantLabel(userById: ReadonlyMap<number, User>, uid: number): string {
  const u = userById.get(uid)
  if (u) return todoUserPickLabel(u)
  return `Участник №${uid}`
}
