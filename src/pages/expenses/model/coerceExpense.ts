import type { ExpenseRequest } from './types'
import { normalizeCreatedBy } from './expenseAuthor'

function pickNumericField(x: Record<string, unknown>, camel: string, snake: string): unknown {
  if (camel in x && x[camel] !== undefined && x[camel] !== null) return x[camel]
  if (snake in x && x[snake] !== undefined && x[snake] !== null) return x[snake]
  return x[camel] ?? x[snake]
}

/**
 * Денежные поля с API: число, строка (Decimal в JSON), MongoDB {$numberDecimal}, обёртки с .value.
 */
export function asExpenseNumber(v: unknown, fallback = 0, depth = 0): number {
  if (depth > 6) return fallback
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'bigint') {
    const x = Number(v)
    return Number.isFinite(x) ? x : fallback
  }
  if (typeof v === 'string') {
    const t = v.trim().replace(/\u00a0/g, '').replace(/\s/g, '')
    if (t === '' || t === 'null' || t === 'undefined') return fallback
    const x = parseFloat(t.replace(',', '.'))
    return Number.isFinite(x) ? x : fallback
  }
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('$numberDecimal' in o) return asExpenseNumber(o.$numberDecimal, fallback, depth + 1)
    if ('value' in o && (typeof o.value === 'string' || typeof o.value === 'number' || typeof o.value === 'bigint'))
      return asExpenseNumber(o.value, fallback, depth + 1)
    const maybe = Number(v as unknown as number)
    if (Number.isFinite(maybe)) return maybe
  }
  return fallback
}

export function normalizeExpenseRequest(r: ExpenseRequest): ExpenseRequest {
  const x = r as unknown as Record<string, unknown>
  const createdByUserId = Math.trunc(
    asExpenseNumber(pickNumericField(x, 'createdByUserId', 'created_by_user_id'), r.createdByUserId ?? 0),
  )
  const createdBy = normalizeCreatedBy(x.createdBy ?? x.created_by, createdByUserId)
  return {
    ...r,
    createdByUserId: Number.isFinite(createdByUserId) ? createdByUserId : r.createdByUserId,
    createdBy,
    amountUzs: asExpenseNumber(pickNumericField(x, 'amountUzs', 'amount_uzs')),
    exchangeRate: asExpenseNumber(pickNumericField(x, 'exchangeRate', 'exchange_rate')),
    equivalentAmount: asExpenseNumber(pickNumericField(x, 'equivalentAmount', 'equivalent_amount')),
  }
}

/**
 * Фрагмент « (NN.NN $)» для эквивалента в USD.
 * На вход: уже число или объект заявки (camelCase / snake_case) — без вызова .toFixed у «сырых» значений с API.
 */
export function formatEquivalentUsdParen(rowOrAmount: unknown): string {
  try {
    let raw: unknown = rowOrAmount
    if (rowOrAmount !== null && typeof rowOrAmount === 'object') {
      const o = rowOrAmount as Record<string, unknown>
      if ('equivalentAmount' in o || 'equivalent_amount' in o) {
        raw = pickNumericField(o, 'equivalentAmount', 'equivalent_amount')
      }
    }
    const n = asExpenseNumber(raw)
    if (!Number.isFinite(n) || n <= 0) return ''
    return ` (${n.toFixed(2)} $)`
  } catch {
    return ''
  }
}
