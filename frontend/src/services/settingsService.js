import apiClient from './apiClient';
import authService from './authService';

const token = () => authService.getToken();

export default {
  get: () => apiClient.get('/settings', token()),
  save: (data) => apiClient.put('/settings', data, token()),
  backup: () => apiClient.post('/settings/backup', {}, token()),
  backups: () => apiClient.get('/settings/backups', token()),
};
