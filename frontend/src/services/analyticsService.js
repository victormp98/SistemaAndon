import apiClient from './apiClient';
import authService from './authService';

const token = () => authService.getToken();

export default {
  dashboard: () => apiClient.get('/analytics/dashboard', token()),
  andon: (simulationId = '') => apiClient.get(`/analytics/andon${simulationId ? `?simulation_id=${simulationId}` : ''}`, token()),
  reports: (simulationId = '') => apiClient.get(
    `/analytics/reports${simulationId ? `?simulation_id=${simulationId}` : ''}`,
    token()
  ),
  reportDetail: (simulationId) => apiClient.get(`/analytics/reports/${simulationId}`, token()),
  events: (simulationId) => apiClient.get(`/analytics/events/${simulationId}`, token()),
  downloadPdf: (simulationId, filename) => apiClient.download(`/analytics/reports/${simulationId}/pdf`, token(), filename),
  downloadExcel: (simulationId, filename) => apiClient.download(`/analytics/reports/${simulationId}/xlsx`, token(), filename),
};
