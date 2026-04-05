import { Fragment, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DocumentLang } from '@/components/DocumentLang'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppointmentsPage } from '@/pages/AppointmentsPage'
import { AuthPage } from '@/pages/AuthPage'
import { BookingPage } from '@/pages/BookingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { ServicesPage } from '@/pages/ServicesPage'
import { StaffPage } from '@/pages/StaffPage'
import { initAuthListener } from '@/store/session'

export default function App() {
  useEffect(() => {
    return initAuthListener()
  }, [])

  return (
    <BrowserRouter>
      <Fragment>
        <DocumentLang />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/book" element={<BookingPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="services" element={<ServicesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Fragment>
    </BrowserRouter>
  )
}
