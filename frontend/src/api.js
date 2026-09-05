// Frontend API client — thin wrapper around fetch.
// Handles credentials, JSON parsing, error normalization, and 401 redirect.
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''; // '' = dev proxy, real URL in prod

class ApiError extends Error {
  constructor(message, status, code, body) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    credentials: 'include', // send/receive httpOnly cookie
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let body;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    body = await response.json().catch(() => null);
  } else {
    body = await response.text().catch(() => null);
  }

  if (!response.ok) {
    const message = body?.message || body || response.statusText;
    const code = body?.error || 'REQUEST_FAILED';
    throw new ApiError(message, response.status, code, body);
  }

  return body;
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

// Convenience auth helpers
export async function login(email, password) {
  return api.post('/api/auth/login', { email, password });
}

export async function logout() {
  return api.post('/api/auth/logout');
}

export async function fetchMe() {
  return api.get('/api/auth/me');
}

// Convenience menu helpers
export async function fetchMenu(include = 'available') {
  return api.get(`/api/menu?include=${include}`);
}

export async function createMenuItem(data) {
  return api.post('/api/menu', data);
}

export async function updateMenuItem(id, data) {
  return api.patch(`/api/menu/${id}`, data);
}

export async function bulkUpdateMenuItems(item_ids, data) {
  return api.post('/api/menu/bulk-update', { item_ids, ...data });
}

// Convenience order helpers
export async function fetchOrders(query = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.waiter) params.set('waiter', query.waiter);
  if (query.date) params.set('date', query.date);
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  if (query.page) params.set('page', query.page);
  if (query.limit) params.set('limit', query.limit);
  if (query.include_archived) params.set('include_archived', 'true');
  const qs = params.toString();
  return api.get(`/api/orders${qs ? '?' + qs : ''}`);
}

export async function fetchOrder(id) {
  return api.get(`/api/orders/${id}`);
}

export async function createOrder(data) {
  return api.post('/api/orders', data);
}

export async function addOrderLine(orderId, data) {
  return api.post(`/api/orders/${orderId}/lines`, data);
}

export async function archiveOrder(orderId) {
  return api.post(`/api/orders/${orderId}/archive`);
}

export async function restoreOrder(orderId) {
  return api.post(`/api/orders/${orderId}/restore`);
}

// Lifecycle + history helpers
export async function changeOrderStatus(orderId, status) {
  return api.patch(`/api/orders/${orderId}/status`, { status });
}

export async function voidOrderLine(orderId, lineId, reason) {
  return api.post(`/api/orders/${orderId}/lines/${lineId}/void`, { reason });
}

export async function fetchOrderHistory(orderId) {
  return api.get(`/api/orders/${orderId}/history`);
}

export async function fetchOrderNotes(orderId) {
  return api.get(`/api/orders/${orderId}/notes`);
}

export async function addOrderNote(orderId, content) {
  return api.post(`/api/orders/${orderId}/notes`, { content });
}

// Collaborator helpers
// waiter_id accepts either a UUID or an email; the backend resolves either
// to the target user. Email is the friendlier input for the UI.
export async function addCollaborator(orderId, waiter_id) {
  return api.post(`/api/orders/${orderId}/collaborators`, { waiter_id });
}

export async function removeCollaborator(orderId, waiterId) {
  return api.delete(`/api/orders/${orderId}/collaborators/${waiterId}`);
}

// Dashboard helper (manager only) — returns headline metrics, breakdowns, 14-day chart.
export async function fetchDashboard() {
  return api.get('/api/dashboard');
}

// Alert helpers
// fetchAlerts returns { alerts, count }. count is intended for the nav badge.
export async function fetchAlerts() {
  return api.get('/api/alerts');
}

export async function dismissAlert(alertId) {
  return api.post(`/api/alerts/${alertId}/dismiss`);
}

// CSV export — returns the raw text. The browser turns this into a download
// via Content-Disposition.
export async function fetchTodaysOrdersCsv() {
  return api.get('/api/export/orders/today');
}