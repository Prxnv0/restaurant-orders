import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchOrder,
  fetchMenu,
  addOrderLine,
  changeOrderStatus,
  voidOrderLine,
  addCollaborator,
  removeCollaborator,
} from '../api';
import { useAuth } from '../context/AuthContext';

// Next statuses from the state machine (declared server-side; synced here)
const NEXT_STATUSES = {
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['SERVED'],
  SERVED: [],
  CANCELLED: [],
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Menu items / add line
  const [menuItems, setMenuItems] = useState([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [addingLine, setAddingLine] = useState(false);
  const [addError, setAddError] = useState('');

  // Collaborators
  const [collabEmail, setCollabEmail] = useState('');
  const [addingCollab, setAddingCollab] = useState(false);
  const [collabError, setCollabError] = useState('');
  const [collabSuccess, setCollabSuccess] = useState('');

  // Status change
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  // Void line
  const [voidingLineId, setVoidingLineId] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');

  // ── Load order ───────────────────────────────────────────────────────
  const loadOrder = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchOrder(id);
      setOrder(data.order);
    } catch (err) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const data = await fetchMenu('available');
      setMenuItems(data.items || []);
    } catch (err) {
      console.error('Failed to load menu items', err);
    }
  };

  useEffect(() => {
    loadOrder();
    loadMenuItems();
  }, [id]);

  // ── Auth helpers ────────────────────────────────────────────────────
  const isPrimary = order && user && order.primaryWaiterId === user.id;
  const isManager = user && user.role === 'MANAGER';
  const canManageCollaborators = isPrimary || isManager;
  const canAddLines = order && order.status !== 'SERVED' && order.status !== 'CANCELLED';
  const orderIsArchived = !!order?.archivedAt;

  // ── Status change ────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    setStatusError('');
    setStatusLoading(true);
    try {
      await changeOrderStatus(id, newStatus);
      await loadOrder();
    } catch (err) {
      setStatusError(err.message || 'Failed to change status');
    } finally {
      setStatusLoading(false);
    }
  };

  // ── Add line ────────────────────────────────────────────────────────
  const handleAddLine = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddingLine(true);
    try {
      await addOrderLine(id, {
        menu_item_id: selectedMenuItem,
        quantity: parseInt(quantity, 10),
        special_instructions: specialInstructions.trim() || null,
      });
      setSelectedMenuItem('');
      setQuantity(1);
      setSpecialInstructions('');
      await loadOrder();
    } catch (err) {
      setAddError(err.message || 'Failed to add line');
    } finally {
      setAddingLine(false);
    }
  };

  // ── Void line ──────────────────────────────────────────────────────
  const handleVoidLine = async (lineId) => {
    setVoidError('');
    try {
      await voidOrderLine(id, lineId, voidReason.trim());
      setVoidingLineId(null);
      setVoidReason('');
      await loadOrder();
    } catch (err) {
      setVoidError(err.message || 'Failed to void line');
    }
  };

  // ── Add collaborator ────────────────────────────────────────────────
  const handleAddCollab = async (e) => {
    e.preventDefault();
    if (!collabEmail.trim()) return;
    setCollabError('');
    setCollabSuccess('');
    setAddingCollab(true);
    try {
      await addCollaborator(id, collabEmail.trim());
      setCollabEmail('');
      setCollabSuccess('Collaborator added.');
      await loadOrder();
    } catch (err) {
      setCollabError(err.message || 'Failed to add collaborator');
    } finally {
      setAddingCollab(false);
    }
  };

  // ── Remove collaborator ─────────────────────────────────────────────
  const handleRemoveCollab = async (waiterId) => {
    try {
      await removeCollaborator(id, waiterId);
      await loadOrder();
    } catch (err) {
      setCollabError(err.message || 'Failed to remove collaborator');
    }
  };

  if (loading) return <div className="card"><p>Loading order…</p></div>;
  if (error) return <div className="card"><p style={{ color: 'red' }}>{error}</p></div>;
  if (!order) return <div className="card"><p>Order not found.</p></div>;

  const nextStatuses = NEXT_STATUSES[order.status] || [];

  return (
    <div className="card">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Order #{order.tableNumber}</h2>
        <button onClick={() => navigate('/orders')} style={{ background: '#6c757d' }}>← Back</button>
      </div>

      {/* ── Order meta ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <strong>Status</strong>
          <br />
          <span className={`status-badge status-${order.status?.toLowerCase()}`}>
            {order.status}
          </span>
        </div>
        <div>
          <strong>Table</strong>
          <br />{order.tableNumber}
        </div>
        <div>
          <strong>Primary Waiter</strong>
          <br />{order.primaryWaiter?.name || '—'}
        </div>
        <div>
          <strong>Placed</strong>
          <br />{new Date(order.createdAt).toLocaleString()}
        </div>
        {order.archivedAt && (
          <div>
            <strong>Archived</strong>
            <br />{new Date(order.archivedAt).toLocaleString()}
          </div>
        )}
        {order.servedAt && (
          <div>
            <strong>Served</strong>
            <br />{new Date(order.servedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* ── Status change buttons ────────────────────────────────────── */}
      {!orderIsArchived && nextStatuses.length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {statusError && <p style={{ color: 'red', margin: 0 }}>{statusError}</p>}
          <span style={{ marginRight: '0.25rem' }}>Change status to:</span>
          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={statusLoading}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Collaborators ───────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <strong>Primary Waiter:</strong> {order.primaryWaiter?.name || '—'}
        </div>
        <div style={{ marginTop: '0.25rem' }}>
          <strong>Collaborators:</strong>{' '}
          {order.collaborators?.length > 0
            ? order.collaborators.map((c) => (
                <span key={c.waiter.id} style={{ marginRight: '0.5rem' }}>
                  {c.waiter.name}
                  {canManageCollaborators && (
                    <button
                      onClick={() => handleRemoveCollab(c.waiter.id)}
                      style={{
                        marginLeft: '0.25rem',
                        fontSize: '0.7rem',
                        padding: '0.05rem 0.3rem',
                        background: '#dc3545',
                      }}
                      title="Remove collaborator"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))
            : <span className="muted">None</span>}
        </div>

        {/* Add collaborator form */}
        {canManageCollaborators && (
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="Collaborator email..."
              value={collabEmail}
              onChange={(e) => {
                setCollabEmail(e.target.value);
                setCollabError('');
                setCollabSuccess('');
              }}
              style={{ width: 240 }}
            />
            <button onClick={handleAddCollab} disabled={addingCollab || !collabEmail.trim()}>
              {addingCollab ? 'Adding...' : 'Add Collaborator'}
            </button>
            {collabError && (
              <span style={{ color: 'red', fontSize: '0.85rem' }}>{collabError}</span>
            )}
            {collabSuccess && (
              <span style={{ color: 'green', fontSize: '0.85rem' }}>{collabSuccess}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Lines table ─────────────────────────────────────────────── */}
      <h3>Order Lines</h3>
      {order.lines?.length === 0 && (
        <p className="muted">No lines yet.</p>
      )}
      {order.lines?.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Item</th>
              <th style={{ textAlign: 'center', padding: '0.5rem' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Unit Price</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Subtotal</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Instructions</th>
              {canAddLines && <th style={{ textAlign: 'center', padding: '0.5rem' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{line.menuItem?.name}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{line.quantity}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                  ${Number(line.unitPrice).toFixed(2)}
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                  ${(Number(line.unitPrice) * line.quantity).toFixed(2)}
                </td>
                <td style={{
                  padding: '0.5rem',
                  fontStyle: line.specialInstructions ? 'italic' : 'normal',
                  color: line.specialInstructions ? '#666' : '#999',
                }}>
                  {line.specialInstructions || '—'}
                </td>
                {canAddLines && (
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    {voidingLineId === line.id ? (
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="Reason required..."
                          value={voidReason}
                          onChange={(e) => {
                            setVoidReason(e.target.value);
                            setVoidError('');
                          }}
                          style={{ width: 130 }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleVoidLine(line.id)}
                          disabled={!voidReason.trim()}
                          style={{ fontSize: '0.75rem' }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => {
                            setVoidingLineId(null);
                            setVoidReason('');
                            setVoidError('');
                          }}
                          style={{ fontSize: '0.75rem', background: '#6c757d' }}
                        >
                          Cancel
                        </button>
                        {voidError && (
                          <span style={{ color: 'red', fontSize: '0.7rem' }}>{voidError}</span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setVoidingLineId(line.id)}
                        style={{ fontSize: '0.75rem', background: '#dc3545' }}
                        title="Void this line"
                      >
                        Void
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold', borderTop: '2px solid #ddd' }}>
              <td colSpan="3" style={{ padding: '0.5rem', textAlign: 'right' }}>Total</td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                ${Number(order.total || 0).toFixed(2)}
              </td>
              <td colSpan="2" />
            </tr>
          </tfoot>
        </table>
      )}

      {/* ── Add line form ────────────────────────────────────────────── */}
      {canAddLines && (
        <div style={{ borderTop: '2px solid #ddd', paddingTop: '1rem', marginTop: '1rem' }}>
          <h4>Add Line</h4>
          {addError && <p style={{ color: 'red' }}>{addError}</p>}
          <form onSubmit={handleAddLine} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem' }}>Menu Item</label>
              <select
                value={selectedMenuItem}
                onChange={(e) => setSelectedMenuItem(e.target.value)}
                required
              >
                <option value="">Select item...</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — ${Number(item.price).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem' }}>Qty</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                style={{ width: 70 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem' }}>Special Instructions</label>
              <input
                type="text"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Optional"
                maxLength={500}
                style={{ width: 200 }}
              />
            </div>
            <button type="submit" disabled={addingLine || !selectedMenuItem}>
              {addingLine ? 'Adding...' : 'Add Line'}
            </button>
          </form>
        </div>
      )}

      {(order.status === 'SERVED' || order.status === 'CANCELLED') && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          Lines cannot be added to a {order.status.toLowerCase()} order.
        </p>
      )}
    </div>
  );
}
