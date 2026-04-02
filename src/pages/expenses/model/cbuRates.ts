/**
 * Курсы валют ЦБ Республики Узбекистан (JSON).
 *
 * Актуальные курсы (текущий день): https://cbu.uz/ru/arkhiv-kursov-valyut/json/
 * Архив за дату: …/json/all/YYYY-MM-DD/
 *
 * В продакшене при ошибке CORS задайте VITE_CBU_ORIGIN на URL прокси того же origin
 * (например /cbu-json) и проксируйте на https://cbu.uz
 */

/** Базовый путь JSON API (без завершающего слэша). */
export const CBU_JSON_BASE_PATH = '/ru/arkhiv-kursov-valyut/json'

export interface CbuJsonRow {
  id: number
  Ccy: string
  Nominal: string
  Rate: string
  Date: string
}

export interface CbuParsed {
  /** Дата курса в формате ЦБ (например 02.04.2026) */
  rateDateRu: string
  /** Сколько UZS за 1 USD */
  uzsPerUsd: number
  /** Сколько UZS за единицу валюты (Rate / Nominal) */
  uzsPerUnit: Map<string, number>
}

function getCbuOrigin(): string {
  const v = import.meta.env.VITE_CBU_ORIGIN as string | undefined
  if (v?.trim()) return v.replace(/\/$/, '')
  return import.meta.env.DEV ? '/cbu-json' : 'https://cbu.uz'
}

function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function parseCbuRows(rows: CbuJsonRow[]): CbuParsed {
  const uzsPerUnit = new Map<string, number>()
  for (const r of rows) {
    const nom = parseNum(r.Nominal)
    const rate = parseNum(r.Rate)
    if (!Number.isFinite(nom) || nom <= 0 || !Number.isFinite(rate) || rate <= 0) continue
    uzsPerUnit.set(r.Ccy, rate / nom)
  }
  const uzsUsd = uzsPerUnit.get('USD')
  if (uzsUsd == null || uzsUsd <= 0) {
    throw new Error('В ответе ЦБ нет курса USD')
  }
  const usdRow = rows.find(r => r.Ccy === 'USD')
  return {
    rateDateRu: usdRow?.Date ?? '',
    uzsPerUsd: uzsUsd,
    uzsPerUnit,
  }
}

/** Сколько единиц валюты `ccy` за 1 USD (для пересчёта суммы в USD). */
export function foreignUnitsPerUsd(parsed: CbuParsed, ccy: string): number | undefined {
  if (ccy === 'USD') return 1
  const uzsX = parsed.uzsPerUnit.get(ccy)
  if (uzsX == null || uzsX <= 0) return undefined
  return parsed.uzsPerUsd / uzsX
}

async function fetchCbuRowsFrom(url: string): Promise<CbuJsonRow[]> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const rows = (await res.json()) as CbuJsonRow[]
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('пустой список курсов')
  }
  return rows
}

/** Курсы на текущий день (ответ ЦБ с https://cbu.uz/ru/arkhiv-kursov-valyut/json/). */
export async function fetchCbuLatestParsed(): Promise<CbuParsed> {
  const base = getCbuOrigin()
  const url = `${base}${CBU_JSON_BASE_PATH}/`
  try {
    return parseCbuRows(await fetchCbuRowsFrom(url))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`ЦБ РУз (${url}): ${msg}`)
  }
}

/**
 * Курсы на выбранную дату (архив), при ошибке — запрос актуального JSON с /json/.
 */
export async function fetchCbuParsedForDate(isoDate: string): Promise<CbuParsed> {
  const base = getCbuOrigin()
  const datedUrl = `${base}${CBU_JSON_BASE_PATH}/all/${isoDate}/`
  const latestUrl = `${base}${CBU_JSON_BASE_PATH}/`

  try {
    return parseCbuRows(await fetchCbuRowsFrom(datedUrl))
  } catch (first) {
    const msg1 = first instanceof Error ? first.message : String(first)
    try {
      return parseCbuRows(await fetchCbuRowsFrom(latestUrl))
    } catch (second) {
      const msg2 = second instanceof Error ? second.message : String(second)
      throw new Error(
        `ЦБ РУз: архив за ${isoDate} — ${msg1}; запрос ${latestUrl} — ${msg2}`,
      )
    }
  }
}
