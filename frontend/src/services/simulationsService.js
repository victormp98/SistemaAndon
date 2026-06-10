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
    return apiClient.put(`/simulations/${id}`, data, authService.getToken());
  },

  async setSimulationStatus(id, status) {
    return apiClient.patch(`/simulations/${id}/status`, { status }, authService.getToken());
  },

  async addParticipant(simulationId, participantData) {
    return apiClient.post(`/simulations/${simulationId}/participants`, participantData, authService.getToken());
  },

  async removeParticipant(simulationId, participantId) {
    return apiClient.delete(`/simulations/${simulationId}/participants/${participantId}`, authService.getToken());
  }
};

export default simulationsService;
