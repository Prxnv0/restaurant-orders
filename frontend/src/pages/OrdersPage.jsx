import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOrders, createOrder } from '../api';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];
const SORT_OPTIONS = [
  { value: 'placed_at', label: 'Placed Time' },
  { value: 'status', label: 'Status' },
  { value: 'table_number', label: 'Table Number' },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user, isManager } = useAuth();

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [waiterFilter, setWaiterFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('placed_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit,
        sort: sortBy,
        order: sortDir,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (waiterFilter.trim()) params.waiter = waiterFilter.trim();
      if (dateFilter) params.date = dateFilter;
      if (isManager) params.include_archived = true;
      const data = await fetchOrders(params);
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, waiterFilter, dateFilter, sortBy, sortDir, page, limit, isManager]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, waiterFilter, dateFilter, sortBy, sortDir]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Orders</h2>
        <button onClick={() => navigate('/orders/new')}>+ New Order</button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search table..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 160, padding: '0.4rem' }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.4rem' }}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
          {isManager && (
            <input
              type="text"
              placeholder="Waiter (id or email)..."
              value={waiterFilter}
              onChange={(e) => setWaiterFilter(e.target.value)}
              style={{ padding: '0.4rem', width: 180 }}
            />
          )}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ padding: '0.4rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>Sort:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '0.3rem' }}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} style={{ padding: '0.3rem' }}>
            <option value="desc">Newest / Z–A / 9–1</option>
            <option value="asc">Oldest / A–Z / 1–9</option>
          </select>
          {(search || statusFilter || waiterFilter || dateFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setWaiterFilter(''); setDateFilter(''); }}
              style={{ fontSize: '0.8rem', background: '#6c757d' }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Orders table ───────────────────────────────────────────── */}
      {loading && <p>Loading orders…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && orders.length === 0 && (
        <p className="muted">No orders found.</p>
      )}
      {!loading && orders.length > 0 && (
        <>
          <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
            Showing {orders.length} of {total} order{total !== 1 ? 's' : ''} total
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Table</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Waiter</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <td style={{ padding: '0.5rem' }}>{order.tableNumber}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <span className={`status-badge status-${order.status?.toLowerCase()}`}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    {order.primaryWaiterId === user?.id ? 'You' : '—'}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Pagination ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <span>
              Page {page} of {totalPages || 1} ({total} total)
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
