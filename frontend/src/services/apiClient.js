const BASE_URL = '/api';

const apiClient = {
  async request(endpoint, { method = 'GET', body, token = null } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({
      ok: false,
      error: 'El servidor devolvió una respuesta inválida.',
    }));

    if (!response.ok && data.ok === undefined) data.ok = false;
    return data;
  },

  async get(endpoint, token = null) {
    return this.request(endpoint, { token });
  },

  async post(endpoint, body, token = null) {
    return this.request(endpoint, { method: 'POST', body, token });
  },

  async put(endpoint, body, token = null) {
    return this.request(endpoint, { method: 'PUT', body, token });
  },

  async patch(endpoint, body, token = null) {
    return this.request(endpoint, { method: 'PATCH', body, token });
  },

  async delete(endpoint, token = null) {
    return this.request(endpoint, { method: 'DELETE', token });
  }
};

export default apiClient;
