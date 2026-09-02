// Frontend API client — thin wrapper around fetch.
// Handles credentials, JSON parsing, error normalization, and 401 redirect.
const API_BASE = ''; // Uses Vite proxy in dev, same-origin in prod

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