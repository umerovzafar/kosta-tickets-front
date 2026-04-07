import { useEffect, useMemo, useState } from 'react'
import { getUsers, type User } from '@entities/user'
import { vacationScheduleEmployees } from '../lib/vacationScheduleModel'
import { VacationContinuousTable } from './VacationContinuousTable'
import { VacationScheduleSkeleton } from './VacationScheduleSkeleton'
import './VacationScheduleGrid.css'

export function VacationScheduleGrid() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const year = new Date().getFullYear()

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    void getUsers(false)
      .then((list) => {
        if (!cancelled) setUsers(list)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setUsers(null)
          setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить сотрудников')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const employees = useMemo(() => (users ? vacationScheduleEmployees(users) : []), [users])

  return (
    <div className="vac-vsg">
      <p className="vac-vsg__hint">
        Одна таблица на год: ФИО слева закреплено, календарь прокручивается по горизонтали. Главный администратор не
        попадает в список.
      </p>

      {loadError && (
        <p className="vac-vsg__error" role="alert">
          {loadError}
        </p>
      )}

      {!loadError && users === null && <VacationScheduleSkeleton />}

      {users !== null && <VacationContinuousTable year={year} employees={employees} />}
    </div>
  )
}
