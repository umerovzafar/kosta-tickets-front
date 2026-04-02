import ExcelJS from 'exceljs'
import type { ExpenseRequest, ExpenseType, ExpenseStatus, PaymentMethod } from '../model/types'
import { STATUS_META, TYPE_META, REIMBURSABLE_META, PAYMENT_META } from '../model/constants'
import { asExpenseNumber } from '../model/coerceExpense'
import { formatExpenseAuthorExport } from '../model/expenseAuthor'

// ─── Types ───────────────────────────────────────────────

export interface ReportConfig {
  title: string
  dateFrom: string         // YYYY-MM-DD, empty = no limit
  dateTo: string           // YYYY-MM-DD, empty = no limit
  selectedTypes: ExpenseType[]    // empty = all
  selectedStatuses: ExpenseStatus[] // empty = all
  /** Пусто = все способы */
  selectedPaymentMethods: PaymentMethod[]
  reimbursable: 'all' | 'reimbursable' | 'non_reimbursable'
}

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  title: 'Отчёт по расходам компании',
  dateFrom: '',
  dateTo: '',
  selectedTypes: [],
  selectedStatuses: [],
  selectedPaymentMethods: [],
  reimbursable: 'all',
}

// ─── Helpers ─────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function todayStr(): string {
  return fmtDate(new Date().toISOString().slice(0, 10))
}

function applyFilters(requests: ExpenseRequest[], cfg: ReportConfig): ExpenseRequest[] {
  return requests.filter(r => {
    if (cfg.dateFrom && r.expenseDate < cfg.dateFrom) return false
    if (cfg.dateTo   && r.expenseDate > cfg.dateTo)   return false
    if (cfg.selectedTypes.length   && !cfg.selectedTypes.includes(r.expenseType as ExpenseType)) return false
    if (cfg.selectedStatuses.length && !cfg.selectedStatuses.includes(r.status)) return false
    if (cfg.selectedPaymentMethods.length) {
      const pm = r.paymentMethod as string | null | undefined
      if (pm == null || pm === '' || !cfg.selectedPaymentMethods.includes(pm as PaymentMethod)) return false
    }
    if (cfg.reimbursable === 'reimbursable'     && !r.isReimbursable) return false
    if (cfg.reimbursable === 'non_reimbursable' && r.isReimbursable)  return false
    return true
  })
}

// ─── Styling helpers ─────────────────────────────────────

// ExcelJS Color helper — argb-only variant (compatible at runtime)
type AC = { argb: string }

const C_NAVY: AC = { argb: 'FF1E293B' }
const C_HEADER: AC = { argb: 'FF334155' }
const C_ACCENT: AC = { argb: 'FF4F46E5' }
const C_WHITE: AC = { argb: 'FFFFFFFF' }
const C_MUTED: AC = { argb: 'FF64748B' }
const C_ROW_ODD: AC = { argb: 'FFFFFFFF' }
const C_ROW_EVEN: AC = { argb: 'FFF8FAFC' }
const C_TOTAL: AC = { argb: 'FFEEF2F9' }
const C_BORDER: AC = { argb: 'FFE2E8F0' }
const C_BORDER_DARK: AC = { argb: 'FF94A3B8' }

function solid(color: AC): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: color as ExcelJS.Color }
}

function border(color: AC = C_BORDER): Partial<ExcelJS.Borders> {
  const s: ExcelJS.BorderStyle = 'thin'
  const c = color as ExcelJS.Color
  return { top: { style: s, color: c }, bottom: { style: s, color: c }, left: { style: s, color: c }, right: { style: s, color: c } }
}

function font(opts: Omit<Partial<ExcelJS.Font>, 'wrapText'> & { color?: AC } = {}): Partial<ExcelJS.Font> {
  const { color, ...rest } = opts
  return { name: 'Calibri', size: 9, ...(color ? { color: color as ExcelJS.Color } : {}), ...rest }
}

// ─── Main export ─────────────────────────────────────────

export async function exportExpensesToExcel(
  allRequests: ExpenseRequest[],
  config: ReportConfig,
): Promise<void> {
  const data = applyFilters(allRequests, config)

  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Kosta Legal'
  wb.created  = new Date()
  wb.modified = new Date()

  // ════════════════════════════════════════════════════════
  // SHEET 1 – MAIN REPORT
  // ════════════════════════════════════════════════════════
  const ws = wb.addWorksheet('Отчёт (Report)', {
    pageSetup: {
      paperSize: 9,          // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }],
    properties: { tabColor: C_ACCENT },
  })

  const LAST_COL = 'O'

  ws.columns = [
    { width: 6 },   // A №
    { width: 46 },  // B Description
    { width: 28 },  // C Author
    { width: 14 },  // D Expense date
    { width: 14 },  // E Payment due
    { width: 20 },  // F Type
    { width: 16 },  // G Reimbursable
    { width: 18 },  // H UZS amount
    { width: 16 },  // I Rate UZS/USD
    { width: 18 },  // J Equiv USD
    { width: 20 },  // K Status
    { width: 18 },  // L Payment
    { width: 22 },  // M Project
    { width: 26 },  // N Vendor
    { width: 36 },  // O Comment
  ]

  // ── Row 1: Document title ──────────────────────────────
  ws.mergeCells(`A1:${LAST_COL}1`)
  ws.getRow(1).height = 36
  const titleCell = ws.getCell('A1')
  titleCell.value  = `${config.title.toUpperCase()}`
  titleCell.font   = font({ bold: true, size: 14, color: C_WHITE })
  titleCell.fill   = solid(C_NAVY)
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  // ── Row 2: English subtitle ────────────────────────────
  ws.mergeCells(`A2:${LAST_COL}2`)
  ws.getRow(2).height = 16
  const subtitleCell = ws.getCell('A2')
  subtitleCell.value = 'COMPANY EXPENSE REPORT'
  subtitleCell.font  = font({ size: 9, italic: true, color: { argb: 'FFB0BEC5' } })
  subtitleCell.fill  = solid(C_NAVY)
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  // ── Row 3: Meta ────────────────────────────────────────
  ws.mergeCells('A3:F3')
  ws.mergeCells(`G3:${LAST_COL}3`)
  ws.getRow(3).height = 18
  const fromLabel = config.dateFrom ? fmtDate(config.dateFrom) : '—'
  const toLabel   = config.dateTo   ? fmtDate(config.dateTo)   : todayStr()
  const metaCell = ws.getCell('A3')
  metaCell.value = `Период / Period: ${fromLabel} — ${toLabel}    |    Записей / Records: ${data.length}`
  metaCell.font  = font({ size: 9, italic: true, color: C_MUTED })
  metaCell.alignment = { vertical: 'middle', indent: 1 }
  metaCell.fill  = solid({ argb: 'FFF1F5F9' })
  const genCell = ws.getCell('G3')
  genCell.value = `Сформирован / Generated: ${todayStr()}`
  genCell.font  = font({ size: 9, italic: true, color: C_MUTED })
  genCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }
  genCell.fill  = solid({ argb: 'FFF1F5F9' })

  // ── Row 4: spacer ──────────────────────────────────────
  ws.getRow(4).height = 4
  ws.mergeCells(`A4:${LAST_COL}4`)
  ws.getCell('A4').fill = solid({ argb: 'FFF1F5F9' })

  // ── Row 5: Column headers (bilingual) ─────────────────
  const HDR_ROW = 5
  const DATA_ROW_START = 6
  const COL_HEADERS = [
    { ru: '№',                 en: 'No.',                                   align: 'center' },
    { ru: 'Описание расхода',  en: 'Description of the expense',            align: 'left'   },
    { ru: 'Автор',             en: 'Author / Submitter',                    align: 'left'   },
    { ru: 'Дата расхода',      en: 'Date of incurred expense',               align: 'center' },
    { ru: 'Срок оплаты',      en: 'Payment due date',                       align: 'center' },
    { ru: 'Тип расхода',       en: 'Expense type',                          align: 'center' },
    { ru: 'Возмещение',        en: 'Reimbursable / Non-reimbursable',        align: 'center' },
    { ru: 'Сумма в сумах',     en: 'Amount in UZS',                         align: 'right'  },
    { ru: 'Курс UZS / USD',    en: 'UZS per 1 USD (official rate)',          align: 'right'  },
    { ru: 'Эквивалент, USD',   en: 'Equivalent amount, USD',                 align: 'right' },
    { ru: 'Статус',            en: 'Status',                                align: 'center' },
    { ru: 'Способ оплаты',     en: 'Payment method',                        align: 'center' },
    { ru: 'Проект',            en: 'Project',                               align: 'left'   },
    { ru: 'Контрагент',        en: 'Vendor / counterparty',                  align: 'left'   },
    { ru: 'Комментарий',       en: 'Comment',                               align: 'left'   },
  ] as const

  ws.getRow(HDR_ROW).height = 44
  COL_HEADERS.forEach((h, i) => {
    const cell = ws.getRow(HDR_ROW).getCell(i + 1)
    cell.value = `${h.ru}\n${h.en}`
    cell.font  = font({ bold: true, size: 8.5, color: C_WHITE })
    cell.fill  = solid(C_HEADER)
    cell.alignment = { horizontal: h.align as ExcelJS.Alignment['horizontal'], vertical: 'middle', wrapText: true }
    cell.border = {
      top:    { style: 'thin',   color: { argb: 'FF475569' } as ExcelJS.Color },
      bottom: { style: 'medium', color: C_ACCENT as ExcelJS.Color },
      left:   { style: 'thin',   color: { argb: 'FF475569' } as ExcelJS.Color },
      right:  { style: 'thin',   color: { argb: 'FF475569' } as ExcelJS.Color },
    }
  })

  // Auto-filter on header row
  ws.autoFilter = `A${HDR_ROW}:${LAST_COL}${HDR_ROW}`

  // ── Data rows ──────────────────────────────────────────
  data.forEach((r, i) => {
    const rowNum = DATA_ROW_START + i
    const row = ws.getRow(rowNum)
    row.height = 17

    const bgColor = i % 2 === 0 ? C_ROW_ODD : C_ROW_EVEN
    const brd = border()

    const reimbKey = r.isReimbursable ? 'reimbursable' : 'non_reimbursable'
    const payDue = r.paymentDeadline ? fmtDate(r.paymentDeadline.slice(0, 10)) : '—'
    const values: (string | number)[] = [
      i + 1,
      r.description,
      formatExpenseAuthorExport(r),
      fmtDate(r.expenseDate),
      payDue,
      TYPE_META[r.expenseType as ExpenseType]?.label ?? r.expenseType,
      REIMBURSABLE_META[reimbKey].label,
      asExpenseNumber(r.amountUzs as unknown),
      asExpenseNumber(r.exchangeRate as unknown),
      asExpenseNumber(r.equivalentAmount as unknown),
      STATUS_META[r.status]?.label ?? r.status,
      r.paymentMethod && PAYMENT_META[r.paymentMethod as PaymentMethod] ? PAYMENT_META[r.paymentMethod as PaymentMethod].label : '',
      r.projectId ?? '',
      r.vendor ?? '',
      r.comment ?? '',
    ]

    const aligns: ExcelJS.Alignment['horizontal'][] = [
      'center', 'left', 'left', 'center', 'center', 'center', 'center', 'right', 'right', 'right', 'center', 'center', 'left', 'left', 'left',
    ]

    values.forEach((val, ci) => {
      const cell = row.getCell(ci + 1)
      cell.value  = val
      cell.font   = font()
      cell.fill   = solid(bgColor)
      cell.border = brd
      cell.alignment = { horizontal: aligns[ci], vertical: 'middle' }
    })

    // Number formats (UZS / rate / USD)
    row.getCell(8).numFmt = '#,##0'
    row.getCell(9).numFmt = '#,##0'
    row.getCell(10).numFmt = '#,##0.00'
  })

  // ── Totals row ─────────────────────────────────────────
  const TOTAL_ROW = DATA_ROW_START + data.length
  const totalRow = ws.getRow(TOTAL_ROW)
  totalRow.height = 20

  const brdTotal = border(C_BORDER_DARK)
  const totalFont = font({ bold: true, size: 9 })

  ws.mergeCells(`A${TOTAL_ROW}:F${TOTAL_ROW}`)
  const labelCell2 = totalRow.getCell(1)
  labelCell2.value = `ИТОГО / TOTAL  (${data.length} записей / records)`
  labelCell2.font  = totalFont
  labelCell2.fill  = solid(C_TOTAL)
  labelCell2.border = brdTotal
  labelCell2.alignment = { horizontal: 'center', vertical: 'middle' }

  // UZS total (column H)
  const uzsCell = totalRow.getCell(8)
  uzsCell.value  = { formula: `SUM(H${DATA_ROW_START}:H${TOTAL_ROW - 1})` }
  uzsCell.numFmt = '#,##0 "UZS"'
  uzsCell.font   = totalFont
  uzsCell.fill   = solid(C_TOTAL)
  uzsCell.border = brdTotal
  uzsCell.alignment = { horizontal: 'right', vertical: 'middle' }

  // Rate cell (empty)
  const rateCell = totalRow.getCell(9)
  rateCell.fill  = solid(C_TOTAL)
  rateCell.border = brdTotal

  // Equiv total (column J)
  const equivCell = totalRow.getCell(10)
  equivCell.value  = { formula: `SUM(J${DATA_ROW_START}:J${TOTAL_ROW - 1})` }
  equivCell.numFmt = '#,##0.00 "USD"'
  equivCell.font   = totalFont
  equivCell.fill   = solid(C_TOTAL)
  equivCell.border = brdTotal
  equivCell.alignment = { horizontal: 'right', vertical: 'middle' }

  // Empty trailing cells (status … comment)
  for (let c = 11; c <= 15; c++) {
    const cell = totalRow.getCell(c)
    cell.fill   = solid(C_TOTAL)
    cell.border = brdTotal
  }

  // ── Print header / footer ──────────────────────────────
  ws.headerFooter.oddHeader  = `&C&B${config.title}`
  ws.headerFooter.oddFooter  = `&LKosta Legal&C&P / &N&R${todayStr()}`

  // ════════════════════════════════════════════════════════
  // SHEET 2 – SUMMARY
  // ════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('Сводка (Summary)', {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: 'FF0891B2' } },
  })

  ws2.columns = [{ width: 28 }, { width: 12 }, { width: 18 }, { width: 18 }]

  function addSummaryTable(
    startRow: number,
    titleRu: string,
    titleEn: string,
    rows: { label: string; count: number; uzs: number; equiv: number }[],
  ) {
    // Title
    ws2.mergeCells(`A${startRow}:D${startRow}`)
    const tc = ws2.getCell(`A${startRow}`)
    tc.value = `${titleRu} / ${titleEn}`
    tc.font  = font({ bold: true, size: 10, color: C_WHITE })
    tc.fill  = solid(C_HEADER)
    tc.alignment = { horizontal: 'center', vertical: 'middle', indent: 1 }
    ws2.getRow(startRow).height = 22

    // Headers
    const hdr = ws2.getRow(startRow + 1)
    hdr.height = 18
    const hdrLabels = ['Категория / Category', 'Кол-во / Count', 'Сумма, UZS / Amount, UZS', 'Экв., USD / Equiv., USD']
    hdrLabels.forEach((l, i) => {
      const c = hdr.getCell(i + 1)
      c.value = l
      c.font  = font({ bold: true, size: 8.5, color: C_WHITE })
      c.fill  = solid({ argb: 'FF475569' })
      c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle', indent: 1 }
      c.border = border()
    })

    // Data
    rows.forEach((r, i) => {
      const row = ws2.getRow(startRow + 2 + i)
      row.height = 16
      const bgColor = i % 2 === 0 ? C_ROW_ODD : C_ROW_EVEN
      const cells = [r.label, r.count, r.uzs, r.equiv]
      cells.forEach((v, ci) => {
        const cell = row.getCell(ci + 1)
        cell.value = v
        cell.font  = font()
        cell.fill  = solid(bgColor)
        cell.border = border()
        cell.alignment = { horizontal: ci === 0 ? 'left' : 'right', vertical: 'middle', indent: ci === 0 ? 1 : 0 }
        if (ci === 2) cell.numFmt = '#,##0'
        if (ci === 3) cell.numFmt = '#,##0.00'
      })
    })

    // Totals line
    const tRow = ws2.getRow(startRow + 2 + rows.length)
    tRow.height = 18
    const totFont = font({ bold: true })
    const totBrd = border(C_BORDER_DARK)
    ;[
      'Итого / Total',
      rows.reduce((s, r) => s + r.count, 0),
      rows.reduce((s, r) => s + r.uzs, 0),
      rows.reduce((s, r) => s + r.equiv, 0),
    ].forEach((v, ci) => {
      const cell = tRow.getCell(ci + 1)
      cell.value = v
      cell.font  = totFont
      cell.fill  = solid(C_TOTAL)
      cell.border = totBrd
      cell.alignment = { horizontal: ci === 0 ? 'center' : 'right', vertical: 'middle' }
      if (ci === 2) cell.numFmt = '#,##0'
      if (ci === 3) cell.numFmt = '#,##0.00'
    })

    return startRow + 2 + rows.length + 2 // next start row (+2 gap)
  }

  // By type
  const byType = (Object.keys(TYPE_META) as ExpenseType[]).map(t => {
    const subset = data.filter(r => r.expenseType === t)
    return {
      label: `${TYPE_META[t].label} / ${TYPE_META[t].label}`,
      count: subset.length,
      uzs: subset.reduce((s, r) => s + asExpenseNumber(r.amountUzs as unknown), 0),
      equiv: subset.reduce((s, r) => s + asExpenseNumber(r.equivalentAmount as unknown), 0),
    }
  }).filter(r => r.count > 0)

  // By status
  const byStatus = (Object.keys(STATUS_META) as ExpenseStatus[]).map(s => {
    const subset = data.filter(r => r.status === s)
    return {
      label: STATUS_META[s].label,
      count: subset.length,
      uzs: subset.reduce((acc, r) => acc + asExpenseNumber(r.amountUzs as unknown), 0),
      equiv: subset.reduce((acc, r) => acc + asExpenseNumber(r.equivalentAmount as unknown), 0),
    }
  }).filter(r => r.count > 0)

  // By reimbursable
  const byReimb = [
    { key: true,  label: REIMBURSABLE_META['reimbursable'].label },
    { key: false, label: REIMBURSABLE_META['non_reimbursable'].label },
  ].map(({ key, label }) => {
    const subset = data.filter(r => r.isReimbursable === key)
    return {
      label,
      count: subset.length,
      uzs: subset.reduce((s, r) => s + asExpenseNumber(r.amountUzs as unknown), 0),
      equiv: subset.reduce((s, r) => s + asExpenseNumber(r.equivalentAmount as unknown), 0),
    }
  }).filter(r => r.count > 0)

  // Add summary title
  ws2.mergeCells('A1:D1')
  ws2.getRow(1).height = 30
  const s2title = ws2.getCell('A1')
  s2title.value = 'СВОДКА ПО РАСХОДАМ / EXPENSE SUMMARY'
  s2title.font  = font({ bold: true, size: 12, color: C_WHITE })
  s2title.fill  = solid(C_NAVY)
  s2title.alignment = { horizontal: 'center', vertical: 'middle' }

  ws2.getRow(2).height = 4

  let nextRow = 3
  nextRow = addSummaryTable(nextRow, 'По типу расхода', 'By expense type', byType)
  nextRow = addSummaryTable(nextRow, 'По статусу', 'By status', byStatus)
  addSummaryTable(nextRow, 'По возмещаемости', 'By reimbursable type', byReimb)

  // ════════════════════════════════════════════════════════
  // DOWNLOAD
  // ════════════════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const dateStr = new Date().toISOString().slice(0, 10)
  a.download = `expense-report-${dateStr}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
