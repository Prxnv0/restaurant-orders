import { useState, useEffect } from 'react';
import { fetchDashboard, fetchTodaysOrdersCsv } from '../api';

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Helper to format currency
function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

// Status badge component
function StatusBadge({ status }) {
  const className = `status-badge status-${status.toLowerCase()}`;
  return <span className={className}>{status}</span>;
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const dashboard = await fetchDashboard();
        setData(dashboard);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p className="muted">Loading dashboard…</p>;

  if (error) return <div className="error">{error}</div>;

  const { open_orders, placed_today, served_today, revenue_today, status_breakdown, waiter_breakdown, chart_14d } = data;

  return (
    <div>
      {/* Headline Metrics */}
      <div className="card">
        <h2>Dashboard</h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Metric tiles row */}
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="metric-tile">
              <div className="metric-value">{open_orders}</div>
              <div className="metric-label">Open Orders</div>
            </div>
            <div className="metric-tile">
              <div className="metric-value">{placed_today}</div>
              <div className="metric-label">Placed Today</div>
            </div>
            <div className="metric-tile">
              <div className="metric-value">{served_today}</div>
              <div className="metric-label">Served Today</div>
            </div>
            <div className="metric-tile">
              <div className="metric-value">{formatCurrency(revenue_today)}</div>
              <div className="metric-label">Revenue Today</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="card">
        <h3>Status Breakdown</h3>
        <table>
          <tbody>
            {Object.entries(status_breakdown).map(([status, count]) => (
              <tr key={status}>
                <td><StatusBadge status={status} /> {status}</td>
                <td style={{ textAlign: 'right' }}>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Waiter Breakdown */}
      <div className="card">
        <h3>Waiter Breakdown (Today)</h3>
        <table>
          <thead>
            <tr>
              <th>Waiter</th>
              <th style={{ textAlign: 'right' }}>Orders</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(waiter_breakdown).map(([name, count]) => (
              <tr key={name}>
                <td>{name}</td>
                <td style={{ textAlign: 'right' }}>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 14-Day Chart (labeled table) */}
      <div className="card">
        <h3>Orders Served (Last 14 Days)</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Orders</th>
              <th style={{ textAlign: 'right' }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {chart_14d.map((day) => (
              <tr key={day.date}>
                <td>{day.date}</td>
                <td style={{ textAlign: 'right' }}>{day.served}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(day.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CSV Export */}
      <div className="card">
        <h3>Exports</h3>
        <button
          className="primary"
          onClick={async () => {
            try {
              const csv = await fetchTodaysOrdersCsv();
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const today = new Date();
              a.download = `orders-${formatDate(today)}.csv`;
              document.body.appendChild(a);
              a.click();
              URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } catch (err) {
              alert('Export failed: ' + err.message);
            }
          }}
        >
          Download Today's Orders (CSV)
        </button>
      </div>
    </div>
  );
}