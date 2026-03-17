import type { ExpenseItem } from '../types'
import { STORAGE_KEY, COMMENTS_STORAGE_KEY } from '../constants'

export function loadExpensesFromStorage(): ExpenseItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveExpensesToStorage(items: ExpenseItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
  }
}

export function loadCommentsFromStorage(): Record<string, string> {
  try {
    const raw = localStorage.getItem(COMMENTS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function saveCommentsToStorage(comments: Record<string, string>): void {
  try {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments))
  } catch {
  }
}
