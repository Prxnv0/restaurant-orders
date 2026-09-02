import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder } from '../api';

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [tableNumber, setTableNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { order } = await createOrder({ table_number: tableNumber.trim() });
      navigate(`/orders/${order.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 480, margin: '2rem auto' }}>
      <h2>New Order</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="tableNumber" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Table Number
          </label>
          <input
            id="tableNumber"
            type="text"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="e.g. 1, 2, Bar-3"
            required
            autoFocus
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Order'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            style={{ background: '#6c757d' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
