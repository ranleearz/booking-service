import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { Layout, RequireAdmin, RequireAuth } from '../components/Layout'
import { AdminBookingsPage } from '../pages/admin/AdminBookingsPage'
import { AdminServicesPage } from '../pages/admin/AdminServicesPage'
import { AdminSpecialistsPage } from '../pages/admin/AdminSpecialistsPage'
import { BookingsPage } from '../pages/BookingsPage'
import { CatalogPage } from '../pages/CatalogPage'
import { LoginPage } from '../pages/LoginPage'
import { NotificationsPage } from '../pages/NotificationsPage'
import { RegisterPage } from '../pages/RegisterPage'
import { ServicePage } from '../pages/ServicePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<CatalogPage />} />
              <Route path="services/:id" element={<ServicePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="bookings" element={<RequireAuth><BookingsPage /></RequireAuth>} />
              <Route path="notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
              <Route path="admin/bookings" element={<RequireAdmin><AdminBookingsPage /></RequireAdmin>} />
              <Route path="admin/services" element={<RequireAdmin><AdminServicesPage /></RequireAdmin>} />
              <Route path="admin/specialists" element={<RequireAdmin><AdminSpecialistsPage /></RequireAdmin>} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
