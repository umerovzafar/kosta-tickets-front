import type { ExpenseAmountCurrency } from './types'

export function needsForeignUsdRate(c: ExpenseAmountCurrency): boolean {
  return c === 'RUB' || c === 'GBP' || c === 'EUR'
}

/** USD equivalent for display (amount ÷ UZS/USD path or direct USD / via cross-rate). */
export function computeUsdEquivalent(
  currency: ExpenseAmountCurrency,
  amountStr: string,
  uzsPerUsdStr: string,
  foreignPerUsdStr: string,
): number | null {
  const amt = parseFloat(amountStr)
  const uzsPerUsd = parseFloat(uzsPerUsdStr)
  if (!amt || !uzsPerUsd || uzsPerUsd <= 0) return null
  if (currency === 'UZS') return amt / uzsPerUsd
  if (currency === 'USD') return amt
  const fx = parseFloat(foreignPerUsdStr)
  if (!fx || fx <= 0) return null
  return amt / fx
}

/** Value stored in API as amountUzs (always in сумах). */
export function computeAmountUzsForApi(
  currency: ExpenseAmountCurrency,
  amountStr: string,
  uzsPerUsdStr: string,
  foreignPerUsdStr: string,
): number {
  const amt = parseFloat(amountStr)
  const uzsPerUsd = parseFloat(uzsPerUsdStr)
  if (!amt || !uzsPerUsd || uzsPerUsd <= 0) return 0
  if (currency === 'UZS') return amt
  if (currency === 'USD') return amt * uzsPerUsd
  const fx = parseFloat(foreignPerUsdStr)
  if (!fx || fx <= 0) return 0
  return (amt / fx) * uzsPerUsd
}
