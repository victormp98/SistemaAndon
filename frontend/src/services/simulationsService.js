import apiClient from './apiClient';
import authService from './authService';

const simulationsService = {
  async getSimulations() {
    return apiClient.get('/simulations', authService.getToken());
  },

  async getSimulationById(id) {
    return apiClient.get(`/simulations/${id}`, authService.getToken());
  },

  async createSimulation(data) {
    return apiClient.post('/simulations', data, authService.getToken());
  },

  async updateSimulation(id, data) {
    const token = authService.getToken();
    const response = await fetch(`http://localhost:3000/api/simulations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async setSimulationStatus(id, status) {
    return apiClient.post(`/simulations/${id}/status`, { status }, authService.getToken());
  },

  async addParticipant(simulationId, participantData) {
    return apiClient.post(`/simulations/${simulationId}/participants`, participantData, authService.getToken());
  },

  async removeParticipant(simulationId, participantId) {
    return apiClient.delete(`/simulations/${simulationId}/participants/${participantId}`, authService.getToken());
  }
};

export default simulationsService;
