import apiClient from './apiClient';
import authService from './authService';

export default {
  list: (filters = {}) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    return apiClient.get(`/audit${query ? `?${query}` : ''}`, authService.getToken());
  }
};
