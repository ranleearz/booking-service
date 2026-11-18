import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Notice, PageHeader } from '../components/PageHeader'
import { safeNext } from '../lib/navigation'

const schema = z.object({
  email: z.string().trim().email('Укажите корректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
})

export function LoginPage() {
  const { user, login } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    document.title = 'Вход — Ателье'
  }, [])

  if (user) return <Navigate to={next} replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = schema.safeParse({ email, password })
    if (!parsed.success) {
      const nextErrors: { email?: string; password?: string } = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'email' || key === 'password') nextErrors[key] = issue.message
      }
      setFieldErrors(nextErrors)
      return
    }
    setFieldErrors({})
    setError('')
    setPending(true)
    try {
      await login(parsed.data.email, parsed.data.password)
      navigate(next)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось войти')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader kicker="Аккаунт" title="Вход" text="Клиенты регистрируются сами. Админ входит по выданной учётке." />
      <form className="flex flex-col gap-4" onSubmit={(event) => { void submit(event) }}>
        {error ? <Notice>{error}</Notice> : null}
        <Field label="Email" name="email" type="email" autoComplete="email" value={email} error={fieldErrors.email} onChange={(event) => setEmail(event.target.value)} />
        <Field label="Пароль" name="password" type="password" autoComplete="current-password" value={password} error={fieldErrors.password} onChange={(event) => setPassword(event.target.value)} />
        <Button type="submit" disabled={pending}>{pending ? 'Входим…' : 'Войти'}</Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Нет аккаунта? <Link to={`/register?next=${encodeURIComponent(next)}`} className="text-ink underline decoration-line underline-offset-4">Зарегистрироваться</Link>
      </p>
    </div>
  )
}
