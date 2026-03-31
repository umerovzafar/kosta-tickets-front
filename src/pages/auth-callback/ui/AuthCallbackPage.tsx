import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAccessToken } from '@shared/lib'
import { routes } from '@shared/config'

function parseCallbackParams(): { token: string | null; error: string | null } {
  // Token is passed in hash fragment to avoid it appearing in server logs/history
  const hash = window.location.hash.replace(/^#/, '')
  if (hash) {
    const hashParams = new URLSearchParams(hash)
    const token = hashParams.get('access_token')
    const error = hashParams.get('error')
    if (token || error) return { token, error }
  }
  // Fallback for backwards compatibility
  const searchParams = new URLSearchParams(window.location.search)
  return {
    token: searchParams.get('access_token'),
    error: searchParams.get('error'),
  }
}

export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const { token, error } = parseCallbackParams()

    if (error) {
      navigate(`${routes.login}?error=${error}`, { replace: true })
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
