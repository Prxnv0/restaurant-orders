import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const { ok, message } = await login(email.trim(), password);
    setSubmitting(false);
    if (ok) {
      navigate('/orders');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card card">
        <h1>Restaurant Orders</h1>
        <p className="muted">Sign in to continue</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={submitting}
            />
          </div>

          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="muted" style={{ marginTop: '16px', fontSize: '12px' }}>
          <p>Demo credentials:</p>
          <p>Manager: <code>manager@busy-demo.com</code> / <code>Demo123!</code></p>
          <p>Waiter: <code>waiter1@busy-demo.com</code> / <code>Demo123!</code></p>
        </div>
      </div>
    </div>
  );
}