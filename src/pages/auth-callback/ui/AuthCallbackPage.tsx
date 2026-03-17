import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setAccessToken } from '@shared/lib'
import { routes } from '@shared/config'

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const error = searchParams.get('error')
    const token = searchParams.get('access_token')

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
  }, [searchParams, navigate])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'inherit' }}>
      Выполняется вход...
    </div>
  )
}
