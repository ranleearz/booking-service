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
  name: z.string().trim().min(1, 'Укажите имя').max(80, 'Имя слишком длинное'),
  email: z.string().trim().email('Укажите корректный email'),
  password: z.string().min(8, 'Минимум 8 символов').max(72, 'Пароль слишком длинный'),
})

export function RegisterPage() {
  const { user, register } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    document.title = 'Регистрация — Ателье'
  }, [])

  if (user) return <Navigate to={next} replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = schema.safeParse({ name, email, password })
    if (!parsed.success) {
      const nextErrors: { name?: string; email?: string; password?: string } = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'name' || key === 'email' || key === 'password') nextErrors[key] = issue.message
      }
      setFieldErrors(nextErrors)
      return
    }
    setFieldErrors({})
    setError('')
    setPending(true)
    try {
      await register(parsed.data.name, parsed.data.email, parsed.data.password)
      navigate(next)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось зарегистрироваться')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader kicker="Аккаунт" title="Регистрация" text="После регистрации можно сразу выбрать время." />
      <form className="flex flex-col gap-4" onSubmit={(event) => { void submit(event) }}>
        {error ? <Notice>{error}</Notice> : null}
        <Field label="Имя" name="name" autoComplete="name" value={name} error={fieldErrors.name} onChange={(event) => setName(event.target.value)} />
        <Field label="Email" name="email" type="email" autoComplete="email" value={email} error={fieldErrors.email} onChange={(event) => setEmail(event.target.value)} />
        <Field label="Пароль" name="password" type="password" autoComplete="new-password" value={password} error={fieldErrors.password} onChange={(event) => setPassword(event.target.value)} />
        <Button type="submit" disabled={pending}>{pending ? 'Создаём…' : 'Создать аккаунт'}</Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Уже есть аккаунт? <Link to={`/login?next=${encodeURIComponent(next)}`} className="text-ink underline decoration-line underline-offset-4">Войти</Link>
      </p>
    </div>
  )
}
