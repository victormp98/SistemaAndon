import apiClient from './apiClient';
import authService from './authService';

const ordersService = {
  async getOrders(simulationId = null) {
    const endpoint = simulationId ? `/orders?simulation_id=${simulationId}` : '/orders';
    return apiClient.get(endpoint, authService.getToken());
  },

  async getOrderById(id) {
    return apiClient.get(`/orders/${id}`, authService.getToken());
  },

  async createOrder(data) {
    return apiClient.post('/orders', data, authService.getToken());
  },

  async generateTickets(orderId) {
    return apiClient.post(`/orders/${orderId}/generate-tickets`, {}, authService.getToken());
  },

  async setOrderStatus(id, status) {
    return apiClient.patch(`/orders/${id}/status`, { status }, authService.getToken());
  }
};

export default ordersService;
