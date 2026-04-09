import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAccessToken } from '@shared/lib'
import { routes } from '@shared/config'

function parseCallbackParams(): { token: string | null; error: string | null } {
  const hash = window.location.hash.replace(/^#/, '')
  if (hash) {
    const hashParams = new URLSearchParams(hash)
    const token = hashParams.get('access_token')
    const error = hashParams.get('error')
    if (token || error) return { token, error }
  }
  const searchParams = new URLSearchParams(window.location.search)
  return {
    token: searchParams.get('access_token'),
    error: searchParams.get('error'),
  }
}

/**
 * OAuth callback: gateway редиректит с `#access_token=…` (или SPA на другом хосте — мост `/auth/callback` на gateway).
 * Токен сохраняется в localStorage — так же ожидает статический мост в gateway/spa_auth_callback.py.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const { token, error } = parseCallbackParams()

    if (error) {
      navigate(`${routes.login}?error=${encodeURIComponent(error)}`, { replace: true })
      return
    }

    if (token) {
      setAccessToken(token)
      window.history.replaceState({}, document.title, window.location.pathname)
      navigate(routes.home, { replace: true })
    } else {
      navigate(routes.login, { replace: true })
    }
  }, [navigate])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'inherit' }}>
      Выполняется вход...
    </div>
  )
}
