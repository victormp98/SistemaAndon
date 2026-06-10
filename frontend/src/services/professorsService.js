import apiClient from './apiClient';
import authService from './authService';

const token = () => authService.getToken();
export default {
  list: () => apiClient.get('/professors', token()),
  create: (data) => apiClient.post('/professors', data, token()),
  update: (id, data) => apiClient.put(`/professors/${id}`, data, token()),
  status: (id, isActive) => apiClient.patch(`/professors/${id}/status`, { is_active: isActive }, token()),
  resetPassword: (id, password = '') => apiClient.post(`/professors/${id}/reset-password`, { temporary_password: password }, token())
};
