export function getPriorityTagClass(priority: string): string {
  const p = priority?.toLowerCase() || ''
  if (p.includes('высокий') || p.includes('критический')) return 'home-tickets__priority--high'
  if (p.includes('средний')) return 'home-tickets__priority--medium'
  if (p.includes('низкий')) return 'home-tickets__priority--low'
  return 'home-tickets__priority--medium'
}

export function getStatusTagClass(status: string): string {
  const s = status?.toLowerCase() || ''
  if (s.includes('закрыт')) return 'closed'
  if (s.includes('в работе')) return 'in-progress'
  if (s.includes('согласован')) return 'approval'
  if (s.includes('невозможно')) return 'impossible'
  return 'open'
}

export const TICKET_CATEGORIES = [
  'Техника',
  'Сеть',
  'Программное обеспечение',
  'Оборудование',
  'Доступы',
  'Общее',
] as const

export function isITRole(role: string | undefined): boolean {
  if (!role) return false
  return role.toLowerCase().includes('it')
}
