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
    const token = authService.getToken();
    const response = await fetch(`http://localhost:3000/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    return response.json();
  }
};

export default ordersService;
