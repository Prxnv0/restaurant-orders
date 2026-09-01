import { useState, useEffect, useCallback } from 'react';
import {
  fetchMenu,
  createMenuItem,
  updateMenuItem,
  bulkUpdateMenuItems,
} from '../api';
import { useAuth } from '../context/AuthContext';

export default function MenuPage() {
  const { isManager } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkAvailable, setBulkAvailable] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // New-item form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newAvailable, setNewAvailable] = useState(true);
  const [creating, setCreating] = useState(false);

  // Edit state — track which item is being edited
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editAvailable, setEditAvailable] = useState(true);
  const [editArchived, setEditArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await fetchMenu('all');
      setItems(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await createMenuItem({
        name: newName.trim(),
        price: parseFloat(newPrice),
        is_available: newAvailable,
      });
      setNewName('');
      setNewPrice('');
      setNewAvailable(true);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditAvailable(item.isAvailable);
    setEditArchived(item.isArchived);
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setError(null);
    try {
      await updateMenuItem(editingId, {
        name: editName.trim(),
        price: parseFloat(editPrice),
        is_available: editAvailable,
        is_archived: editArchived,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBulkApply(e) {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    setBulkResult(null);
    setError(null);
    setBulkSubmitting(true);

    const data = {};
    if (bulkPrice !== '') data.price = parseFloat(bulkPrice);
    if (bulkAvailable !== '') data.is_available = bulkAvailable === 'true';

    if (Object.keys(data).length === 0) {
      setError('Enter a price or availability to apply.');
      setBulkSubmitting(false);
      return;
    }

    try {
      const result = await bulkUpdateMenuItems([...selectedIds], data);
      setBulkResult(result);
      setBulkPrice('');
      setBulkAvailable('');
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading menu…</p>;

  return (
    <div>
      <div className="card">
        <h2>Menu</h2>
        {!isManager && (
          <p className="muted">
            You are viewing the menu. Manager access is required to add or change items.
          </p>
        )}

        {error && <div className="error">{error}</div>}

        {isManager && (
          <div style={{ marginBottom: '12px' }}>
            {!showCreate && (
              <button className="primary" onClick={() => setShowCreate(true)}>
                + Add menu item
              </button>
            )}
            {showCreate && (
              <form onSubmit={handleCreate} style={{ display: 'grid', gap: '8px', maxWidth: '400px' }}>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={newAvailable}
                      onChange={(e) => setNewAvailable(e.target.checked)}
                    />
                    {' '}Available
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="primary" disabled={creating}>
                    {creating ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <table>
          <thead>
            <tr>
              {isManager && (
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <th>Name</th>
              <th>Price</th>
              <th>Available</th>
              <th>Archived</th>
              {isManager && <th></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) =>
              editingId === item.id ? (
                <tr key={item.id}>
                  <td colSpan={isManager ? 6 : 5}>
                    <form onSubmit={handleEditSave} style={{ display: 'grid', gap: '8px' }}>
                      <div className="form-group">
                        <label>Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={editAvailable}
                            onChange={(e) => setEditAvailable(e.target.checked)}
                          />
                          {' '}Available
                        </label>
                      </div>
                      <div className="form-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={editArchived}
                            onChange={(e) => setEditArchived(e.target.checked)}
                          />
                          {' '}Archived
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="primary">Save</button>
                        <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={item.id}>
                  {isManager && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                  )}
                  <td>{item.name}</td>
                  <td>${Number(item.price).toFixed(2)}</td>
                  <td>{item.isAvailable ? 'Yes' : 'No'}</td>
                  <td>{item.isArchived ? 'Yes' : 'No'}</td>
                  {isManager && (
                    <td>
                      <button onClick={() => startEdit(item)}>Edit</button>
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {isManager && selectedIds.size > 0 && (
        <div className="card">
          <h3>Bulk update ({selectedIds.size} selected)</h3>
          <form onSubmit={handleBulkApply} style={{ display: 'grid', gap: '8px', maxWidth: '400px' }}>
            <div className="form-group">
              <label>New price (leave blank to skip)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                placeholder="e.g. 9.99"
              />
            </div>
            <div className="form-group">
              <label>Set availability (leave blank to skip)</label>
              <select
                value={bulkAvailable}
                onChange={(e) => setBulkAvailable(e.target.value)}
              >
                <option value="">— keep current —</option>
                <option value="true">Available</option>
                <option value="false">Unavailable</option>
              </select>
            </div>
            <button type="submit" className="primary" disabled={bulkSubmitting}>
              {bulkSubmitting ? 'Applying…' : 'Apply to selected'}
            </button>
          </form>

          {bulkResult && (
            <div style={{ marginTop: '12px' }}>
              <p>
                <strong>{bulkResult.succeeded.length}</strong> succeeded,{' '}
                <strong>{bulkResult.rejected.length}</strong> rejected.
              </p>
              {bulkResult.rejected.length > 0 && (
                <div>
                  <p className="muted">Rejected items:</p>
                  <ul>
                    {bulkResult.rejected.map((r) => (
                      <li key={r.id}>
                        <code>{r.id.slice(0, 8)}</code>: {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}