import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import App from './App.tsx'
import { LandingPage } from './pages/LandingPage.tsx'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<App />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/**
 * Electron loads the built SPA via file:// — BrowserRouter can't route there.
 * HashRouter works for file://; BrowserRouter keeps clean URLs on the web.
 */
export function Root() {
  const useHash = typeof window !== 'undefined' && window.location.protocol === 'file:'
  if (useHash) {
    return (
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    )
  }
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
