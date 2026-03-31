import type { ExpenseRequest, ExpenseRequestExpenseType, ExpenseRequestStatus } from './types'

const STORAGE_KEY = 'expense-requests-v2'
const LEGACY_STORAGE_KEY = 'expense-requests-v1'
const COUNTER_KEY_PREFIX = 'expense-requests-seq-'

function yearCounterKey(): string {
  return `${COUNTER_KEY_PREFIX}${new Date().getFullYear()}`
}

export function nextRequestNumber(): string {
  if (typeof window === 'undefined') return `REQ-${new Date().getFullYear()}-00001`
  const y = new Date().getFullYear()
  const key = yearCounterKey()
  const n = (parseInt(localStorage.getItem(key) || '0', 10) || 0) + 1
  localStorage.setItem(key, String(n))
  return `REQ-${y}-${String(n).padStart(5, '0')}`
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

/** Приводит сохранённые JSON и старый формат v1 к актуальной модели */
export function normalizeExpenseRequest(raw: unknown): ExpenseRequest | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null

  if (typeof raw.requestNumber === 'string' && typeof raw.initiator === 'string') {
    const expenseType: ExpenseRequestExpenseType =
      raw.expenseType === 'non_reimbursable' ? 'non_reimbursable' : 'reimbursable'
    const status: ExpenseRequestStatus =
      raw.status === 'draft' || raw.status === 'pending' || raw.status === 'approved' || raw.status === 'rejected'
        ? raw.status
        : 'pending'
    const attachments = Array.isArray(raw.attachments)
      ? raw.attachments.filter((a): a is string => typeof a === 'string')
      : []
    return {
      id: raw.id,
      requestNumber: raw.requestNumber,
      requestDate: typeof raw.requestDate === 'string' ? raw.requestDate : new Date().toISOString().slice(0, 10),
      initiator: raw.initiator,
      department: typeof raw.department === 'string' ? raw.department : '—',
      budgetItem: typeof raw.budgetItem === 'string' ? raw.budgetItem : '—',
      counterparty: typeof raw.counterparty === 'string' ? raw.counterparty : '—',
      amount: typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? raw.amount : 0,
      currency: typeof raw.currency === 'string' ? raw.currency : 'UZS',
      description: typeof raw.description === 'string' ? raw.description : '',
      expenseOrPaymentDate:
        typeof raw.expenseOrPaymentDate === 'string'
          ? raw.expenseOrPaymentDate
          : typeof raw.requestDate === 'string'
            ? raw.requestDate
            : new Date().toISOString().slice(0, 10),
      attachments,
      expenseType,
      status,
      rejectionReason: typeof raw.rejectionReason === 'string' ? raw.rejectionReason : undefined,
    }
  }

  // v1: createdAt, authorName, title, category
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString().slice(0, 10)
  const authorName = typeof raw.authorName === 'string' ? raw.authorName : '—'
  const title = typeof raw.title === 'string' ? raw.title : ''
  const category = typeof raw.category === 'string' ? raw.category : 'Прочее'
  const amount = typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? raw.amount : 0
  const currency = typeof raw.currency === 'string' ? raw.currency : 'UZS'
  const status: ExpenseRequestStatus =
    raw.status === 'draft' || raw.status === 'pending' || raw.status === 'approved' || raw.status === 'rejected'
      ? raw.status
      : 'pending'

  return {
    id: raw.id,
    requestNumber: `REQ-MIGR-${raw.id}`,
    requestDate: createdAt,
    initiator: authorName,
    department: '—',
    budgetItem: category,
    counterparty: '—',
    amount,
    currency,
    description: title,
    expenseOrPaymentDate: createdAt,
    attachments: [],
    expenseType: 'reimbursable',
    status,
    rejectionReason: typeof raw.rejectionReason === 'string' ? raw.rejectionReason : undefined,
  }
}

const DEMO: ExpenseRequest[] = [
  {
    id: 'demo-1',
    requestNumber: 'REQ-2026-00001',
    requestDate: '2026-03-26',
    initiator: 'Иванов А.',
    department: 'Юридический отдел',
    budgetItem: 'Офисные расходы',
    counterparty: 'ООО «Канцтовары»',
    amount: 4500,
    currency: 'UZS',
    description: 'Канцтовары для офиса',
    expenseOrPaymentDate: '2026-03-28',
    attachments: ['счёт.pdf'],
    expenseType: 'reimbursable',
    status: 'pending',
  },
  {
    id: 'demo-2',
    requestNumber: 'REQ-2026-00002',
    requestDate: '2026-03-25',
    initiator: 'Петрова М.',
    department: 'Командировки',
    budgetItem: 'Транспорт и проживание',
    counterparty: 'Авиакомпания',
    amount: 1280000,
    currency: 'UZS',
    description: 'Билеты на командировку',
    expenseOrPaymentDate: '2026-03-30',
    attachments: [],
    expenseType: 'reimbursable',
    status: 'approved',
  },
  {
    id: 'demo-3',
    requestNumber: 'REQ-2026-00003',
    requestDate: '2026-03-24',
    initiator: 'Сидоров К.',
    department: 'IT',
    budgetItem: 'ПО и сервисы',
    counterparty: 'SaaS-провайдер',
    amount: 990000,
    currency: 'UZS',
    description: 'Годовая подписка',
    expenseOrPaymentDate: '2026-04-01',
    attachments: ['договор.pdf'],
    expenseType: 'non_reimbursable',
    status: 'pending',
  },
  {
    id: 'demo-4',
    requestNumber: 'REQ-2026-00004',
    requestDate: '2026-03-22',
    initiator: 'Иванов А.',
    department: 'Юридический отдел',
    budgetItem: 'Представительские',
    counterparty: 'Ресторан',
    amount: 320000,
    currency: 'UZS',
    description: 'Обед с клиентом',
    expenseOrPaymentDate: '2026-03-22',
    attachments: ['чек.jpg'],
    expenseType: 'reimbursable',
    status: 'rejected',
    rejectionReason: 'Превышен лимит представительских расходов по регламенту.',
  },
]

function parse(raw: string | null): ExpenseRequest[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.map(normalizeExpenseRequest).filter((x): x is ExpenseRequest => x !== null)
  } catch {
    return []
  }
}

function migrateLegacyV1(): ExpenseRequest[] {
  if (typeof window === 'undefined') return []
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacy) return []
  const list = parse(legacy)
  localStorage.removeItem(LEGACY_STORAGE_KEY)
  return list
}

export function loadExpenseRequests(): ExpenseRequest[] {
  if (typeof window === 'undefined') return DEMO
  const fromV2 = parse(localStorage.getItem(STORAGE_KEY))
  const migrated = migrateLegacyV1()
  if (migrated.length > 0) {
    const merged = [...migrated, ...fromV2.filter((x) => !migrated.some((m) => m.id === x.id))]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    return merged
  }
  if (fromV2.length === 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO))
    syncCounterFromDemo()
    return [...DEMO]
  }
  return fromV2
}

function syncCounterFromDemo(): void {
  const y = new Date().getFullYear()
  const key = `${COUNTER_KEY_PREFIX}${y}`
  const max = DEMO.reduce((acc, r) => {
    const m = /^REQ-\d{4}-(\d+)$/.exec(r.requestNumber)
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc
  }, 0)
  if (max > 0) localStorage.setItem(key, String(max))
}

export function saveExpenseRequests(requests: ExpenseRequest[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
}

export type NewExpenseRequestInput = Omit<ExpenseRequest, 'id' | 'requestNumber' | 'status'> & {
  status?: ExpenseRequestStatus
}

export function appendExpenseRequest(input: NewExpenseRequestInput): ExpenseRequest {
  const list = loadExpenseRequests()
  const requestNumber = nextRequestNumber()
  const req: ExpenseRequest = {
    ...input,
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    requestNumber,
    status: input.status ?? 'pending',
  }
  list.push(req)
  saveExpenseRequests(list)
  return req
}

export function setExpenseRequestStatus(
  id: string,
  status: ExpenseRequestStatus,
  options?: { rejectionReason?: string },
): ExpenseRequest | null {
  const list = loadExpenseRequests()
  const i = list.findIndex((r) => r.id === id)
  if (i < 0) return null
  const prev = list[i]
  let rejectionReason: string | undefined
  if (status === 'rejected') {
    rejectionReason = options?.rejectionReason?.trim() || undefined
  } else {
    rejectionReason = undefined
  }
  const next: ExpenseRequest = { ...prev, status, rejectionReason }
  list[i] = next
  saveExpenseRequests(list)
  return next
}
