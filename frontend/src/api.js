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