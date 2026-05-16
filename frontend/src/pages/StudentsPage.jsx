import { useState, useEffect, useCallback } from 'react';
import studentsService from '../services/studentsService';

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    student_code: '',
    group_name: '',
    temporary_password: ''
  });

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await studentsService.getStudents(searchTerm);
      if (data.ok) {
        setStudents(data.students);
      } else {
        setError(data.error || 'Error al cargar alumnos');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchStudents();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchStudents]);

  const handleOpenCreate = () => {
    setIsEdit(false);
    setSelectedStudent(null);
    setFormData({
      name: '',
      username: '',
      email: '',
      student_code: '',
      group_name: '',
      temporary_password: ''
    });
    setTempPassword(null);
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (student) => {
    setIsEdit(true);
    setSelectedStudent(student);
    setFormData({
      name: student.name,
      username: student.username,
      email: student.email,
      student_code: student.student_code || '',
      group_name: student.group_name || '',
      temporary_password: ''
    });
    setTempPassword(null);
    setError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTempPassword(null);
    setError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      if (isEdit) {
        const data = await studentsService.updateStudent(selectedStudent.id, {
          ...formData,
          is_active: selectedStudent.is_active
        });
        if (data.ok) {
          setSuccess('Alumno actualizado correctamente.');
          handleCloseModal();
          fetchStudents();
        } else {
          setError(data.error);
        }
      } else {
        const data = await studentsService.createStudent(formData);
        if (data.ok) {
          if (data.temporary_password) {
            setTempPassword(data.temporary_password);
          } else {
            setSuccess('Alumno creado correctamente.');
            handleCloseModal();
          }
          fetchStudents();
        } else {
          setError(data.error);
        }
      }
    } catch (err) {
      setError('Error al procesar la solicitud.');
    }
  };

  const handleToggleStatus = async (student) => {
    const newStatus = !student.is_active;
    try {
      const data = await studentsService.setStudentStatus(student.id, newStatus);
      if (data.ok) {
        setStudents(prev => prev.map(s => s.id === student.id ? { ...s, is_active: newStatus ? 1 : 0 } : s));
      } else {
        alert(data.error || 'Error al cambiar estado');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  const handleResetPassword = async (student) => {
    if (!window.confirm(`¿Seguro que deseas resetear la contraseña de ${student.name}?`)) return;
    
    try {
      const data = await studentsService.resetPassword(student.id);
      if (data.ok) {
        setTempPassword(data.temporary_password);
        setSelectedStudent(student);
        setIsModalOpen(true);
        setIsEdit(true); // Just to reuse modal, but we'll show the password
      } else {
        alert(data.error || 'Error al resetear contraseña');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  return (
    <div className="students-page">
      <header className="page-header-actions">
        <div>
          <h1>Gestión de Alumnos</h1>
          <p className="subtitle">Administra los accesos y grupos de tus estudiantes.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreate}>
          + Registrar Alumno
        </button>
      </header>

      {success && <div className="alert success">{success}</div>}

      <div className="table-controls card">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por nombre, usuario, matrícula o grupo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card table-container">
        {loading ? (
          <div className="loading-inline">Cargando alumnos...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Grupo</th>
                <th>Estado</th>
                <th>Password</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {students.length > 0 ? (
                students.map(student => (
                  <tr key={student.id}>
                    <td><code>{student.student_code || '---'}</code></td>
                    <td><strong>{student.name}</strong></td>
                    <td>{student.username}</td>
                    <td>{student.email}</td>
                    <td>{student.group_name || '---'}</td>
                    <td>
                      <span className={`status-pill-small ${student.is_active ? 'success' : 'error'}`}>
                        {student.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      {student.must_change_password ? (
                        <span className="badge-warning">Cambio Req.</span>
                      ) : (
                        <span className="badge-success">OK</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon" title="Editar" onClick={() => handleOpenEdit(student)}>✏️</button>
                        <button className="btn-icon" title="Reset Password" onClick={() => handleResetPassword(student)}>🔑</button>
                        <button 
                          className={`btn-icon ${student.is_active ? 'btn-warn' : 'btn-success-icon'}`} 
                          title={student.is_active ? 'Desactivar' : 'Activar'}
                          onClick={() => handleToggleStatus(student)}
                        >
                          {student.is_active ? '🚫' : '✅'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center">No se encontraron alumnos.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <header className="modal-header">
              <h2>{tempPassword ? '⚠️ Nueva Contraseña' : (isEdit ? 'Editar Alumno' : 'Registrar Nuevo Alumno')}</h2>
              <button className="btn-close" onClick={handleCloseModal}>&times;</button>
            </header>

            {tempPassword ? (
              <div className="password-reveal">
                <p>Se ha generado una contraseña temporal para <strong>{isEdit ? selectedStudent.name : formData.name}</strong>:</p>
                <div className="password-box">
                  <code>{tempPassword}</code>
                </div>
                <p className="warning-text">Por favor, copia esta contraseña ahora. No se volverá a mostrar por seguridad.</p>
                <button className="btn-primary" onClick={handleCloseModal}>Entendido, la he copiado</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nombre Completo*</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Correo Electrónico*</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Nombre de Usuario*</label>
                    <input type="text" name="username" value={formData.username} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Matrícula / Código</label>
                    <input type="text" name="student_code" value={formData.student_code} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Grupo</label>
                    <input type="text" name="group_name" value={formData.group_name} onChange={handleInputChange} />
                  </div>
                  {!isEdit && (
                    <div className="form-group">
                      <label>Contraseña Temporal (Opcional)</label>
                      <input type="text" name="temporary_password" value={formData.temporary_password} onChange={handleInputChange} placeholder="Autogenerar si vacío" />
                    </div>
                  )}
                </div>

                {error && <div className="error-alert">{error}</div>}

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={handleCloseModal}>Cancelar</button>
                  <button type="submit" className="btn-primary">{isEdit ? 'Guardar Cambios' : 'Registrar'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsPage;
