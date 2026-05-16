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
    const token = authService.getToken();
    const response = await fetch(`http://localhost:3000/api/laboratories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  async setLaboratoryStatus(id, isActive) {
    return apiClient.post(`/laboratories/${id}/status`, { is_active: isActive }, authService.getToken());
  },

  // Lines
  async getLines(labId) {
    return apiClient.get(`/laboratories/${labId}/lines`, authService.getToken());
  },
  async createLine(labId, data) {
    return apiClient.post(`/laboratories/${labId}/lines`, data, authService.getToken());
  },
  async updateLine(id, data) {
    const token = authService.getToken();
    const response = await fetch(`http://localhost:3000/api/laboratories/lines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  // Stations
  async getStations(lineId) {
    return apiClient.get(`/laboratories/lines/${lineId}/stations`, authService.getToken());
  },
  async createStation(lineId, data) {
    return apiClient.post(`/laboratories/lines/${lineId}/stations`, data, authService.getToken());
  },
  async updateStation(id, data) {
    const token = authService.getToken();
    const response = await fetch(`http://localhost:3000/api/laboratories/stations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};

export default laboratoriesService;
