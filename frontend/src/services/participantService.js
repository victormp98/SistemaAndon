import apiClient from './apiClient';
import authService from './authService';

const token = () => authService.getToken();
export default {
  assignments: () => apiClient.get('/participant/assignments', token()),
  completeSimulation: (id) => apiClient.patch(`/participant/simulations/${id}/complete`, {}, token()),
  changeOrderPriority: (id, priority) => apiClient.patch(`/participant/orders/${id}/priority`, { priority }, token())
};
