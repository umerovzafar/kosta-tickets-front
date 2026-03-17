export const LIMIT = 24

export function canEditInventory(role: string | undefined): boolean {
  if (!role) return false
  const r = role.toLowerCase()
  return r.includes('it') || r.includes('администратор') || r.includes('офис') || r.includes('менеджер') || r.includes('партнер')
}

export function canManageCategories(role: string | undefined): boolean {
  if (!role) return false
  return role.toLowerCase().includes('it')
}
