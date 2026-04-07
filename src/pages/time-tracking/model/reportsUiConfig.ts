/** Верхние вкладки отчётов (своды / детализации). */
export type ReportTypeId = 'time' | 'detailed-time' | 'detailed-expense' | 'contractor' | 'uninvoiced'

/** Второй уровень: разрез таблицы. */
export type ReportGroupId = 'tasks' | 'clients' | 'projects' | 'team'

export const REPORT_TYPES: { id: ReportTypeId; label: string }[] = [
  { id: 'time', label: 'Время' },
  { id: 'detailed-time', label: 'Детальное время' },
  { id: 'detailed-expense', label: 'Детальные расходы' },
  { id: 'contractor', label: 'Подрядчики' },
  { id: 'uninvoiced', label: 'Не выставленные' },
]

export const REPORT_GROUP_IDS: ReportGroupId[] = ['tasks', 'clients', 'projects', 'team']

/** Подписи второго уровня зависят от типа отчёта (одни и те же id, разный смысл среза). */
export function reportGroupLabel(type: ReportTypeId, group: ReportGroupId): string {
  const map: Record<ReportTypeId, Record<ReportGroupId, string>> = {
    time: {
      tasks: 'Задачи',
      clients: 'Клиенты',
      projects: 'Проекты',
      team: 'Команда',
    },
    'detailed-time': {
      tasks: 'Задачи',
      clients: 'Клиенты',
      projects: 'Проекты',
      team: 'Команда',
    },
    'detailed-expense': {
      tasks: 'Категории',
      clients: 'Клиенты',
      projects: 'Проекты',
      team: 'Сотрудники',
    },
    contractor: {
      tasks: 'Виды работ',
      clients: 'Заказчики',
      projects: 'Проекты',
      team: 'Подрядчики',
    },
    uninvoiced: {
      tasks: 'Позиции',
      clients: 'Клиенты',
      projects: 'Проекты',
      team: 'Ответственные',
    },
  }
  return map[type][group]
}

export type ReportSummaryUi = {
  card1Label: string
  /** Единицы первой карточки (свод за период). */
  card1Unit: 'hours' | 'money'
  pieLeftLabel: string
  pieRightLabel: string
  /** Подписи к долям диаграммы: часы или суммы. */
  pieLeftUnit: 'hours' | 'money'
  pieRightUnit: 'hours' | 'money'
  card3Label: string
  card3ShowFixedCheckbox: boolean
  card4Label: string
  /** Четвёртая карточка: деньги, часы или количество строк. */
  card4Unit: 'money' | 'hours' | 'count'
  card4Note?: string
}

export function reportSummaryUi(type: ReportTypeId): ReportSummaryUi {
  switch (type) {
    case 'time':
      return {
        card1Label: 'Всего часов',
        card1Unit: 'hours',
        pieLeftLabel: 'Оплачиваемые',
        pieRightLabel: 'Неоплачиваемые',
        pieLeftUnit: 'hours',
        pieRightUnit: 'hours',
        card3Label: 'Оплачиваемая сумма',
        card3ShowFixedCheckbox: true,
        card4Label: 'Не выставленная сумма',
        card4Unit: 'money',
        card4Note: 'Исключая проекты с фикс. оплатой',
      }
    case 'detailed-time':
      return {
        card1Label: 'Всего часов',
        card1Unit: 'hours',
        pieLeftLabel: 'Оплачиваемые часы',
        pieRightLabel: 'Неоплачиваемые часы',
        pieLeftUnit: 'hours',
        pieRightUnit: 'hours',
        card3Label: 'Оценка по ставкам',
        card3ShowFixedCheckbox: true,
        card4Label: 'Строк в журнале',
        card4Unit: 'count',
        card4Note: 'Каждая запись учёта времени за период',
      }
    case 'detailed-expense':
      return {
        card1Label: 'Сумма расходов',
        card1Unit: 'money',
        pieLeftLabel: 'На клиента / возмещаемые',
        pieRightLabel: 'Внутренние / прочие',
        pieLeftUnit: 'money',
        pieRightUnit: 'money',
        card3Label: 'К возмещению',
        card3ShowFixedCheckbox: false,
        card4Label: 'В обработке',
        card4Unit: 'money',
        card4Note: 'Черновики и на согласовании',
      }
    case 'contractor':
      return {
        card1Label: 'Часы подрядчиков',
        card1Unit: 'hours',
        pieLeftLabel: 'В рамках бюджета',
        pieRightLabel: 'Сверх лимита',
        pieLeftUnit: 'hours',
        pieRightUnit: 'hours',
        card3Label: 'Стоимость работ',
        card3ShowFixedCheckbox: false,
        card4Label: 'К выплате',
        card4Unit: 'money',
        card4Note: 'По договорам за период',
      }
    case 'uninvoiced':
      return {
        card1Label: 'Не выставлено (часы)',
        card1Unit: 'hours',
        pieLeftLabel: 'T&M и почасовка',
        pieRightLabel: 'Расходы на клиента',
        pieLeftUnit: 'hours',
        pieRightUnit: 'money',
        card3Label: 'Сумма к выставлению',
        card3ShowFixedCheckbox: true,
        card4Label: 'Старше 30 дней',
        card4Unit: 'count',
        card4Note: 'Требуют внимания перед закрытием периода',
      }
  }
}

export type ReportTableColumn = { key: string; label: string; className?: string }

export type ReportTableSpec = {
  breakdownHint: string
  columns: ReportTableColumn[]
  emptyText: string
}

export function reportTableSpec(type: ReportTypeId, group: ReportGroupId): ReportTableSpec {
  const g = group
  if (type === 'time') {
    const byGroup: Record<ReportGroupId, Omit<ReportTableSpec, 'columns'> & { columns: ReportTableColumn[] }> = {
      tasks: {
        breakdownHint: 'Разбивка по задачам, отсортированная по часам.',
        columns: [
          { key: 'name', label: 'Название' },
          { key: 'hours', label: 'Часы', className: 'tt-reports__th--sortable' },
          { key: 'billable', label: 'Оплачиваемые часы' },
        ],
        emptyText: 'Нет данных за выбранный период. После появления API отчётов здесь будет сводка по времени.',
      },
      clients: {
        breakdownHint: 'Сводка по клиентам: часы и оплачиваемая доля.',
        columns: [
          { key: 'name', label: 'Клиент' },
          { key: 'hours', label: 'Часы' },
          { key: 'billable', label: 'Оплачиваемые часы' },
        ],
        emptyText: 'Нет данных по клиентам за период.',
      },
      projects: {
        breakdownHint: 'Сводка по проектам справочника учёта времени.',
        columns: [
          { key: 'name', label: 'Проект' },
          { key: 'code', label: 'Код' },
          { key: 'hours', label: 'Часы' },
          { key: 'billable', label: 'Оплачиваемые' },
        ],
        emptyText: 'Нет данных по проектам за период.',
      },
      team: {
        breakdownHint: 'Загрузка команды: часы по сотрудникам.',
        columns: [
          { key: 'name', label: 'Сотрудник' },
          { key: 'hours', label: 'Часы' },
          { key: 'billable', label: 'Оплачиваемые' },
        ],
        emptyText: 'Нет данных по команде за период.',
      },
    }
    return byGroup[g]
  }

  if (type === 'detailed-time') {
    const baseCols: ReportTableColumn[] = [
      { key: 'date', label: 'Дата' },
      { key: 'user', label: 'Сотрудник' },
      { key: 'project', label: 'Проект' },
      { key: 'task', label: 'Задача / описание' },
      { key: 'hours', label: 'Часы' },
      { key: 'bill', label: 'Оплач.' },
    ]
    const hints: Record<ReportGroupId, string> = {
      tasks: 'Каждая строка — запись учёта времени; срез по задаче или описанию.',
      clients: 'Строки сгруппированы по клиенту проекта.',
      projects: 'Детализация в разрезе проектов.',
      team: 'Журнал по сотрудникам за период.',
    }
    return {
      breakdownHint: hints[g],
      columns: baseCols,
      emptyText:
        'Журнал пуст. Подключение к API детальных отчётов запланировано: здесь появятся все списания времени с фильтрами и экспортом.',
    }
  }

  if (type === 'detailed-expense') {
    const cols: ReportTableColumn[] = [
      { key: 'date', label: 'Дата' },
      { key: 'project', label: 'Проект' },
      { key: 'type', label: 'Тип / категория' },
      { key: 'amount', label: 'Сумма' },
      { key: 'cur', label: 'Вал.' },
      { key: 'status', label: 'Статус' },
      { key: 'author', label: 'Автор' },
    ]
    const hints: Record<ReportGroupId, string> = {
      tasks: 'Расходы по категориям (как в заявках и справочниках).',
      clients: 'Расходы в привязке к клиентам проектов.',
      projects: 'Детализация по проектам.',
      team: 'Кто подал расходы и на какую сумму.',
    }
    return { breakdownHint: hints[g], columns: cols, emptyText: 'Нет строк расходов за период (данные с модуля заявок / TT).' }
  }

  if (type === 'contractor') {
    const cols: ReportTableColumn[] = [
      { key: 'contractor', label: 'Подрядчик' },
      { key: 'project', label: 'Проект' },
      { key: 'role', label: 'Вид работ' },
      { key: 'hours', label: 'Часы' },
      { key: 'rate', label: 'Ставка' },
      { key: 'amount', label: 'Сумма' },
    ]
    const hints: Record<ReportGroupId, string> = {
      tasks: 'Учёт подрядных работ по видам деятельности.',
      clients: 'Распределение подрядных часов по заказчикам.',
      projects: 'Сколько приходится на каждый проект.',
      team: 'Список подрядных исполнителей и их вклад.',
    }
    return {
      breakdownHint: hints[g],
      columns: cols,
      emptyText: 'Блок подрядчиков: после интеграции с договорами и учётом здесь появятся часы и суммы к выплате.',
    }
  }

  // uninvoiced
  const cols: ReportTableColumn[] = [
    { key: 'item', label: 'Позиция' },
    { key: 'client', label: 'Клиент' },
    { key: 'project', label: 'Проект' },
    { key: 'kind', label: 'Тип' },
    { key: 'amount', label: 'Сумма' },
    { key: 'since', label: 'С даты' },
  ]
  const hints: Record<ReportGroupId, string> = {
    tasks: 'Все не выставленные позиции: часы и расходы, ожидающие счёт.',
    clients: 'Сводка не выставленного по клиентам.',
    projects: 'По проектам: что ещё не попало в инвойс.',
    team: 'Кто отвечает за выставление по строкам.',
  }
  return {
    breakdownHint: hints[g],
    columns: cols,
    emptyText: 'Всё выставлено или данных за период нет. Свод «не выставлено» будет строиться из учёта времени и расходов.',
  }
}
