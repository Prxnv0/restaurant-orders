import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import NewOrderPage from './pages/NewOrderPage';
import MenuPage from './pages/MenuPage';
import DashboardPage from './pages/DashboardPage';
import AlertsPage from './pages/AlertsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import './styles.css';

function NavLinks() {
  const { isAuthenticated, isManager, user, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  return (
    <>
      <nav className="nav-links">
        <button onClick={() => navigate('/orders')}>Orders</button>
        <button onClick={() => navigate('/orders/new')}>+ New</button>
        {isManager && (
          <>
            <button onClick={() => navigate('/menu')}>Menu</button>
            <button onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button onClick={() => navigate('/alerts')}>Alerts</button>
          </>
        )}
      </nav>
      <div className="user-info">
        {user?.name} ({user?.role}){' '}
        <button onClick={logout}>Logout</button>
      </div>
    </>
  );
}

// Milestone 4: Real nav links, orders with new-order creation.
export default function App() {
  return (
    <AuthProvider>
      <div className="app">
        <header className="app-header">
          <nav className="app-nav">
            <NavLinks />
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
              path="/orders/new"
              element={
                <ProtectedRoute>
                  <NewOrderPage />
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