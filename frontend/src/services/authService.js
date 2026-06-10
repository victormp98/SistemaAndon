import apiClient from './apiClient';

const authService = {
  async login(identifier, password) {
    const data = await apiClient.post('/auth/login', { identifier, password });
    if (data.ok && data.token) {
      localStorage.setItem('token', data.token);
    }
    return data;
  },

  async me() {
    const token = localStorage.getItem('token');
    if (!token) return { ok: false };
    return apiClient.get('/auth/me', token);
  },

  async changePassword(currentPassword, newPassword) {
    return apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword
    }, this.getToken());
  },

  logout() {
    localStorage.removeItem('token');
  },

  getToken() {
    return localStorage.getItem('token');
  }
};

export default authService;
