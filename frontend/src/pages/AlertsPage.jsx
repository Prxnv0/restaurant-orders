import { useState, useEffect } from 'react';
import { fetchAlerts, dismissAlert } from '../api';

export default function AlertsPage() {
  const [data, setData] = useState({ alerts: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dismissing, setDismissing] = useState(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAlerts();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDismiss(alertId) {
    setDismissing((prev) => new Set([...prev, alertId]));
    try {
      await dismissAlert(alertId);
      // Optimistically remove from list
      setData((prev) => ({
        ...prev,
        alerts: prev.alerts.filter((a) => a.id !== alertId),
        count: prev.count - 1,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }

  if (loading) return <p className="muted">Loading alerts…</p>;

  if (error) return <div className="error">{error}</div>;

  const { alerts, count } = data;

  return (
    <div>
      <div className="card">
        <h2>Alerts <span className="muted">({count})</span></h2>

        {alerts.length === 0 && (
          <p className="muted">No active slow-order alerts.</p>
        )}

        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="alert-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid #e5e5e5',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <strong>Order {alert.order_id.slice(0, 8)}</strong>
                <span>Table: {alert.table_number}</span>
                <span>
                  <StatusBadge status={alert.status} />
                </span>
                <span className="muted">Age: {alert.age_minutes} min</span>
                {alert.last_dismissed_at && (
                  <span className="muted">
                    Last dismissed: {new Date(alert.last_dismissed_at).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="muted" style={{ fontSize: '12px' }}>
                Triggered: {new Date(alert.triggered_at).toLocaleString()}
              </div>
            </div>
            <button
              className="danger"
              disabled={dismissing.has(alert.id)}
              onClick={() => handleDismiss(alert.id)}
            >
              {dismissing.has(alert.id) ? 'Dismissing…' : 'Dismiss'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const className = `status-badge status-${status.toLowerCase()}`;
  return <span className={className}>{status}</span>;
}