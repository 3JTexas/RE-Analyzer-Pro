import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppShell } from './components/layout/AppShell'
import { LoginPage }      from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { PropertiesPage } from './pages/PropertiesPage'
import { PropertyPage }   from './pages/PropertyPage'
import { ScenarioPage }   from './pages/ScenarioPage'
import { DemoPage }       from './pages/DemoPage'
import { PipelinePage }   from './pages/PipelinePage'
import { Spinner }        from './components/ui'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f7f4] px-6 text-center">
          <div className="text-4xl mb-4">⚠</div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-4 max-w-md">{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium bg-[#1a1a2e] text-white rounded-sm hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors">
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
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
          <Route path="/property/:id/pipeline" element={
            <ProtectedRoute><PipelinePage /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
