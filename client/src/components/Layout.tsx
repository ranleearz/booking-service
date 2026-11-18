import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { api } from '../api/http'
import { useAuth } from '../auth/AuthContext'

export function Layout() {
  const { user, ready, logout } = useAuth()
  const location = useLocation()
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api<{ unread: number }>('/api/notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 30_000,
  })
  const servicesActive = location.pathname === '/' || location.pathname.startsWith('/services')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 py-5">
          <Link to="/" className="font-serif text-4xl leading-none tracking-tight">Ателье</Link>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link to="/" className={servicesActive ? 'text-accent' : 'text-ink'}>Услуги</Link>
            {user?.role === 'client' ? (
              <NavLink to="/bookings" className={({ isActive }) => isActive ? 'text-accent' : 'text-ink'}>Мои записи</NavLink>
            ) : null}
            {user?.role === 'admin' ? (
              <>
                <NavLink to="/admin/bookings" className={({ isActive }) => isActive ? 'text-accent' : 'text-ink'}>Записи</NavLink>
                <NavLink to="/admin/services" className={({ isActive }) => isActive ? 'text-accent' : 'text-ink'}>Каталог</NavLink>
                <NavLink to="/admin/specialists" className={({ isActive }) => isActive ? 'text-accent' : 'text-ink'}>Специалисты</NavLink>
              </>
            ) : null}
            {user ? (
              <NavLink to="/notifications" className={({ isActive }) => isActive ? 'text-accent' : 'text-ink'}>
                Уведомления
                {unread.data && unread.data.unread > 0 ? (
                  <span className="ml-2 inline-flex min-w-5 justify-center bg-accent px-1.5 py-0.5 text-xs text-white">{unread.data.unread}</span>
                ) : null}
              </NavLink>
            ) : null}
            {ready && user ? (
              <>
                <span className="text-muted">{user.name}</span>
                <button type="button" className="text-ink underline decoration-line underline-offset-4" onClick={() => { void logout() }}>Выйти</button>
              </>
            ) : null}
            {ready && !user ? (
              <Link to="/login" className="text-ink underline decoration-line underline-offset-4">Войти</Link>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        {ready ? <Outlet /> : <p className="text-muted">Загрузка…</p>}
      </main>
      <footer className="mt-8 border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-3 px-5 py-6 text-sm text-muted">
          <p>Ателье, Большая Никитская, 12</p>
          <p>Ежедневно по записи</p>
        </div>
      </footer>
    </div>
  )
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return children
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <RequireAuth>{children}</RequireAuth>
  if (user.role !== 'admin') return <p>Этот раздел только для администратора.</p>
  return children
}
