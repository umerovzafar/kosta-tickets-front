import type { ExpenseItem } from '../types'
import { STORAGE_KEY } from '../constants'

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
