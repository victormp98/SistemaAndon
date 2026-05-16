import apiClient from './apiClient';
import authService from './authService';

const operatorService = {
  async getContext() {
    return apiClient.get('/operator/context', authService.getToken());
  },

  async getAvailableTickets() {
    return apiClient.get('/operator/tickets', authService.getToken());
  },

  async getCurrentTicket() {
    return apiClient.get('/operator/current-ticket', authService.getToken());
  },

  async startTicket(ticketId) {
    return apiClient.post(`/operator/tickets/${ticketId}/start`, {}, authService.getToken());
  },

  async completeCurrentTicket(notes = '') {
    return apiClient.post('/operator/current-ticket/complete', { notes }, authService.getToken());
  }
};

export default operatorService;
