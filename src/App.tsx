import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppShell } from './components/layout/AppShell'
import { LoginPage }      from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { PropertiesPage } from './pages/PropertiesPage'
import { PropertyPage }   from './pages/PropertyPage'
import { ScenarioPage }   from './pages/ScenarioPage'
import { DemoPage }       from './pages/DemoPage'
import { Spinner }        from './components/ui'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<AppShell />}>
          {/* Demo — no auth required */}
          <Route path="/demo" element={<DemoPage />} />

          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute><PropertiesPage /></ProtectedRoute>
          } />
          <Route path="/property/:id" element={
            <ProtectedRoute><PropertyPage /></ProtectedRoute>
          } />
          <Route path="/scenario/:id" element={
            <ProtectedRoute><ScenarioPage /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
