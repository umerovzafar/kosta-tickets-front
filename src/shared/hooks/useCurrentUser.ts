import { useState, useEffect } from 'react'
import { getMe } from '@entities/user'
import type { User } from '@entities/user'

let cachedUser: User | null = null
let cachedError: Error | null = null
let inFlight: Promise<void> | null = null

export function setCachedUser(user: User | null, error?: Error | null): void {
  cachedUser = user
  cachedError = error ?? null
}

async function ensureUserLoaded() {
  if (cachedUser || cachedError) return
  if (inFlight) return inFlight
  inFlight = getMe()
    .then((data) => {
      cachedUser = data
      cachedError = null
    })
    .catch((err) => {
      cachedError = err instanceof Error ? err : new Error(String(err))
      cachedUser = null
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

export function useCurrentUser(): {
  user: User | null
  loading: boolean
  error: Error | null
} {
  const [user, setUser] = useState<User | null>(cachedUser)
  const [loading, setLoading] = useState(!cachedUser && !cachedError)
  const [error, setError] = useState<Error | null>(cachedError)

  useEffect(() => {
    let cancelled = false

    if (cachedUser || cachedError) {
      setUser(cachedUser)
      setError(cachedError)
      setLoading(false)
      return () => {}
    }

    setLoading(true)
    setError(null)

    ensureUserLoaded()?.then(() => {
      if (cancelled) return
      setUser(cachedUser)
      setError(cachedError)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { user, loading, error }
}
