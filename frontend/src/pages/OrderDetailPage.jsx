import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchOrder, fetchMenu, addOrderLine } from '../api';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add line state
  const [menuItems, setMenuItems] = useState([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [addingLine, setAddingLine] = useState(false);
  const [addError, setAddError] = useState('');

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
      // Reset form
      setSelectedMenuItem('');
      setQuantity(1);
      setSpecialInstructions('');
      // Reload order to see new line
      await loadOrder();
    } catch (err) {
      setAddError(err.message || 'Failed to add line');
    } finally {
      setAddingLine(false);
    }
  };

  const canAddLines = order && order.status !== 'SERVED' && order.status !== 'CANCELLED';

  if (loading) return <div className="card"><p>Loading order…</p></div>;
  if (error) return <div className="card"><p style={{ color: 'red' }}>{error}</p></div>;
  if (!order) return <div className="card"><p>Order not found.</p></div>;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Order #{order.tableNumber}</h2>
        <button onClick={() => navigate('/orders')} style={{ background: '#6c757d' }}>← Back</button>
      </div>

      {/* Order header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
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

      {/* Collaborators */}
      {order.collaborators?.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <strong>Collaborators:</strong>{' '}
          {order.collaborators.map((c) => c.waiter.name).join(', ')}
        </div>
      )}

      {/* Lines table */}
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
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{line.menuItem?.name}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{line.quantity}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>${Number(line.unitPrice).toFixed(2)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>${(Number(line.unitPrice) * line.quantity).toFixed(2)}</td>
                <td style={{ padding: '0.5rem', fontStyle: line.specialInstructions ? 'italic' : 'normal', color: line.specialInstructions ? '#666' : '#999' }}>
                  {line.specialInstructions || '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold', borderTop: '2px solid #ddd' }}>
              <td colSpan="3" style={{ padding: '0.5rem', textAlign: 'right' }}>Total</td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>${Number(order.total || 0).toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}

      {/* Add line form */}
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
                style={{ width: '70px' }}
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

      {order.status === 'SERVED' && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          Lines cannot be added to a served order.
        </p>
      )}
      {order.status === 'CANCELLED' && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          Lines cannot be added to a cancelled order.
        </p>
      )}
    </div>
  );
}
