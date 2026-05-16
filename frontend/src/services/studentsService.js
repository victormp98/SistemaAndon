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
    const token = authService.getToken();
    // PUT /api/students/:id
    const response = await fetch(`http://localhost:3000/api/students/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(studentData)
    });
    return response.json();
  },

  async setStudentStatus(id, isActive) {
    const token = authService.getToken();
    // PATCH /api/students/:id/status
    const response = await fetch(`http://localhost:3000/api/students/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ is_active: isActive })
    });
    return response.json();
  },

  async resetPassword(id, temporaryPassword = '') {
    const token = authService.getToken();
    return apiClient.post(`/students/${id}/reset-password`, { temporary_password: temporaryPassword }, token);
  }
};

export default studentsService;
