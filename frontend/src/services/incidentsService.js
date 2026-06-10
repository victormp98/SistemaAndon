import apiClient from './apiClient';
import authService from './authService';

const token = () => authService.getToken();

export default {
  list: (simulationId = '') => apiClient.get(
    `/incidents${simulationId ? `?simulation_id=${simulationId}` : ''}`,
    token()
  ),
  create: (data) => apiClient.post('/incidents', data, token()),
  setStatus: (id, status) => apiClient.patch(`/incidents/${id}/status`, { status }, token()),
  createDowntime: (data) => apiClient.post('/incidents/downtime', data, token()),
  closeDowntime: (id) => apiClient.patch(`/incidents/downtime/${id}/close`, {}, token()),
};
