import apiClient from './apiClient';
import authService from './authService';

const laboratoriesService = {
  // Laboratories
  async getLaboratories() {
    return apiClient.get('/laboratories', authService.getToken());
  },
  async createLaboratory(data) {
    return apiClient.post('/laboratories', data, authService.getToken());
  },
  async updateLaboratory(id, data) {
    return apiClient.put(`/laboratories/${id}`, data, authService.getToken());
  },
  async setLaboratoryStatus(id, isActive) {
    return apiClient.patch(`/laboratories/${id}/status`, { is_active: isActive }, authService.getToken());
  },

  // Lines
  async getLines(labId) {
    return apiClient.get(`/laboratories/${labId}/lines`, authService.getToken());
  },
  async createLine(labId, data) {
    return apiClient.post(`/laboratories/${labId}/lines`, data, authService.getToken());
  },
  async updateLine(id, data) {
    return apiClient.put(`/laboratories/lines/${id}`, data, authService.getToken());
  },

  // Stations
  async getStations(lineId) {
    return apiClient.get(`/laboratories/lines/${lineId}/stations`, authService.getToken());
  },
  async createStation(lineId, data) {
    return apiClient.post(`/laboratories/lines/${lineId}/stations`, data, authService.getToken());
  },
  async updateStation(id, data) {
    return apiClient.put(`/laboratories/stations/${id}`, data, authService.getToken());
  }
};

export default laboratoriesService;
