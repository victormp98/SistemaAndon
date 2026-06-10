import apiClient from './apiClient';
import authService from './authService';

const token = () => authService.getToken();

export default {
  dashboard: () => apiClient.get('/analytics/dashboard', token()),
  andon: () => apiClient.get('/analytics/andon', token()),
  reports: (simulationId = '') => apiClient.get(
    `/analytics/reports${simulationId ? `?simulation_id=${simulationId}` : ''}`,
    token()
  ),
};
