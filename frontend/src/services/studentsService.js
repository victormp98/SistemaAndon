import apiClient from './apiClient';
import authService from './authService';

const studentsService = {
  async getStudents(search = '') {
    const token = authService.getToken();
    const endpoint = search ? `/students?search=${encodeURIComponent(search)}` : '/students';
    return apiClient.get(endpoint, token);
  },

  async createStudent(studentData) {
    const token = authService.getToken();
    return apiClient.post('/students', studentData, token);
  },

  async updateStudent(id, studentData) {
    return apiClient.put(`/students/${id}`, studentData, authService.getToken());
  },

  async setStudentStatus(id, isActive) {
    return apiClient.patch(`/students/${id}/status`, { is_active: isActive }, authService.getToken());
  },

  async resetPassword(id, temporaryPassword = '') {
    const token = authService.getToken();
    return apiClient.post(`/students/${id}/reset-password`, { temporary_password: temporaryPassword }, token);
  }
};

export default studentsService;
