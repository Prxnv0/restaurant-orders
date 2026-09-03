import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchOrder,
  fetchMenu,
  addOrderLine,
  changeOrderStatus,
  voidOrderLine,
  fetchOrderHistory,
  fetchOrderNotes,
  addOrderNote,
  addCollaborator,
  removeCollaborator,
  archiveOrder,
  restoreOrder,
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

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Notes
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Archive / restore
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState('');

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

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchOrderHistory(id);
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadNotes = async () => {
    setNotesLoading(true);
    setNotesError('');
    try {
      const data = await fetchOrderNotes(id);
      setNotes(data.notes || []);
    } catch (err) {
      setNotesError(err.message || 'Failed to load notes');
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
    loadMenuItems();
    loadHistory();
    loadNotes();
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
      await loadHistory();
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
      await loadHistory();
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
      await loadHistory();
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
      await loadHistory();
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
      await loadHistory();
    } catch (err) {
      setCollabError(err.message || 'Failed to remove collaborator');
    }
  };

  // ── Add note ────────────────────────────────────────────────────────
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setNoteError('');
    setAddingNote(true);
    try {
      await addOrderNote(id, noteContent.trim());
      setNoteContent('');
      // Notes list is ordered newest-first by the server, so just refetch.
      await loadNotes();
      // A note also creates a history entry, so refresh the timeline too.
      await loadHistory();
    } catch (err) {
      setNoteError(err.message || 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  // ── Archive / restore ──────────────────────────────────────────────
  const handleArchive = async () => {
    setArchiveError('');
    setArchiveLoading(true);
    try {
      await archiveOrder(id);
      await loadOrder();
      await loadHistory();
    } catch (err) {
      setArchiveError(err.message || 'Failed to archive order');
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestore = async () => {
    setArchiveError('');
    setArchiveLoading(true);
    try {
      await restoreOrder(id);
      await loadOrder();
      await loadHistory();
    } catch (err) {
      setArchiveError(err.message || 'Failed to restore order');
    } finally {
      setArchiveLoading(false);
    }
  };

  if (loading) return <div className="card"><p>Loading order…</p></div>;
  if (error) return <div className="card"><p style={{ color: 'red' }}>{error}</p></div>;
  if (!order) return <div className="card"><p>Order not found.</p></div>;

  const nextStatuses = NEXT_STATUSES[order.status] || [];

  // Render a single history entry as a one-line description. Dispatch on
  // eventType, reading the known fields documented in Decision 19.
  const renderHistoryDescription = (entry) => {
    const d = entry.details || {};
    switch (entry.eventType) {
      case 'STATUS_CHANGE':
        return (
          <>
            Status changed from <strong>{d.old_status}</strong> to{' '}
            <strong>{d.new_status}</strong>
          </>
        );
      case 'LINE_ADDED':
        return (
          <>
            Line added: <strong>{d.quantity}×</strong> item
            (price ${Number(d.unit_price).toFixed(2)})
          </>
        );
      case 'LINE_VOIDED':
        return (
          <>
            Line voided — <em>"{d.reason}"</em>
          </>
        );
      case 'NOTE_ADDED':
        return (
          <>
            Note added: <em>"{d.content}"</em>
          </>
        );
      case 'COLLABORATOR_ADDED':
        return <>Collaborator added</>;
      case 'COLLABORATOR_REMOVED':
        return <>Collaborator removed</>;
      default:
        return <>{entry.eventType}</>;
    }
  };

  return (
    <div className="card">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Order #{order.tableNumber}</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {orderIsArchived ? (
            <button onClick={handleRestore} disabled={archiveLoading} style={{ background: '#0d9488' }}>
              {archiveLoading ? 'Restoring...' : 'Restore'}
            </button>
          ) : (
            <button onClick={handleArchive} disabled={archiveLoading} style={{ background: '#6c757d' }}>
              {archiveLoading ? 'Archiving...' : 'Archive'}
            </button>
          )}
          <button onClick={() => navigate('/orders')} style={{ background: '#6c757d' }}>← Back</button>
        </div>
      </div>
      {archiveError && <p style={{ color: 'red' }}>{archiveError}</p>}

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

      {/* ── History timeline ──────────────────────────────────────── */}
      <div style={{ borderTop: '2px solid #ddd', paddingTop: '1rem', marginTop: '1.5rem' }}>
        <h3>History</h3>
        {historyLoading && <p className="muted">Loading history…</p>}
        {!historyLoading && history.length === 0 && (
          <p className="muted">No history entries yet.</p>
        )}
        {!historyLoading && history.length > 0 && (
          <ul className="timeline">
            {history.map((entry) => (
              <li key={entry.id} className="timeline-entry">
                <div className="timeline-marker" />
                <div className="timeline-content">
                  <div className="timeline-text">
                    {renderHistoryDescription(entry)}{' '}
                    <span className="muted">by {entry.actor?.name || 'system'}</span>
                  </div>
                  <div className="timeline-time muted">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Notes panel ────────────────────────────────────────────── */}
      <div style={{ borderTop: '2px solid #ddd', paddingTop: '1rem', marginTop: '1.5rem' }}>
        <h3>Notes</h3>
        {notesError && <p style={{ color: 'red' }}>{notesError}</p>}
        {noteError && <p style={{ color: 'red' }}>{noteError}</p>}
        <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <textarea
            value={noteContent}
            onChange={(e) => {
              setNoteContent(e.target.value);
              setNoteError('');
            }}
            placeholder="Add a note about this order…"
            maxLength={2000}
            rows={2}
            style={{ flex: 1, minWidth: 240, resize: 'vertical' }}
            required
          />
          <button type="submit" disabled={addingNote || !noteContent.trim()}>
            {addingNote ? 'Adding...' : 'Add Note'}
          </button>
        </form>

        {notesLoading && <p className="muted">Loading notes…</p>}
        {!notesLoading && notes.length === 0 && (
          <p className="muted">No notes yet.</p>
        )}
        {!notesLoading && notes.length > 0 && (
          <ul className="notes-list">
            {notes.map((note) => (
              <li key={note.id} className="note-entry">
                <div className="note-meta">
                  <strong>{note.createdBy?.name || 'system'}</strong>{' '}
                  <span className="muted">— {new Date(note.createdAt).toLocaleString()}</span>
                </div>
                <div className="note-content">{note.content}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
