import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import MenuPage from './pages/MenuPage';
import DashboardPage from './pages/DashboardPage';
import AlertsPage from './pages/AlertsPage';
import ProtectedRoute from './components/ProtectedRoute';
import './styles.css';

// Milestone 2: Real router with auth protection.
// Placeholder pages (OrdersPage, etc.) will be implemented in later milestones.
export default function App() {
  return (
    <AuthProvider>
      <div className="app">
        <header className="app-header">
          <nav className="app-nav">
            <nav className="nav-links">
              {/* Nav links will be implemented in later milestones */}
            </nav>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Navigate to="/orders" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <ProtectedRoute>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/menu"
              element={
                <ProtectedRoute allowedRoles={['MANAGER']}>
                  <MenuPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['MANAGER']}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <AlertsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<p>Not found.</p>} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}