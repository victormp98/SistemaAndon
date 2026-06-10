import { useState, useEffect, useCallback } from 'react';
import simulationsService from '../services/simulationsService';
import laboratoriesService from '../services/laboratoriesService';
import studentsService from '../services/studentsService';

const SimulationsPage = () => {
  const [simulations, setSimulations] = useState([]);
  const [selectedSim, setSelectedSim] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [laboratories, setLaboratories] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Auxiliary states for assignment
  const [labLines, setLabLines] = useState([]);
  const [labStations, setLabStations] = useState([]);
  
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); // 'create', 'assign'
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');

  const fetchSimulations = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await simulationsService.getSimulations();
      if (data.ok) setSimulations(data.simulations);
    } catch (err) { console.error(err); }
    finally { setLoadingList(false); }
  }, []);

  const fetchDependencies = useCallback(async () => {
    try {
      const [labsRes, studentsRes] = await Promise.all([
        laboratoriesService.getLaboratories(),
        studentsService.getStudents()
      ]);
      if (labsRes.ok) setLaboratories(labsRes.laboratories.filter(l => l.is_active));
      if (studentsRes.ok) setStudents(studentsRes.students.filter(s => s.is_active));
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    fetchSimulations();
    fetchDependencies();
  }, [fetchSimulations, fetchDependencies]);

  const handleSelectSim = async (sim) => {
    setLoadingDetail(true);
    setSelectedSim(sim);
    try {
      const data = await simulationsService.getSimulationById(sim.id);
      if (data.ok) {
        setParticipants(data.participants);
        // Load lines and stations for this lab to use in assignments
        const linesRes = await laboratoriesService.getLines(sim.laboratory_id);
        if (linesRes.ok) {
          setLabLines(linesRes.lines.filter(l => l.is_active));
          // For simplicity, let's fetch stations of all lines
          const allStations = await Promise.all(
            linesRes.lines.map(line => laboratoriesService.getStations(line.id))
          );
          setLabStations(allStations.flatMap(r => r.stations || []).filter(s => s.is_active));
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoadingDetail(false); }
  };

  const openCreateModal = () => {
    setModalType('create');
    setFormData({ laboratory_id: '', name: '', description: '', planned_duration_minutes: 60 });
    setError('');
    setIsModalOpen(true);
  };

  const openAssignModal = () => {
    setModalType('assign');
    setFormData({ user_id: '', simulation_role: 'operator', line_id: '', station_id: '' });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (modalType === 'create') {
        const res = await simulationsService.createSimulation(formData);
        if (res.ok) {
          setIsModalOpen(false);
          fetchSimulations();
        } else {
          setError(res.error);
        }
      } else if (modalType === 'assign') {
        const res = await simulationsService.addParticipant(selectedSim.id, formData);
        if (res.ok) {
          setIsModalOpen(false);
          handleSelectSim(selectedSim);
        } else {
          setError(res.error);
        }
      }
    } catch (err) {
      setError('Error de conexión.');
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (!window.confirm('¿Quitar a este participante?')) return;
    try {
      const res = await simulationsService.removeParticipant(selectedSim.id, participantId);
      if (res.ok) handleSelectSim(selectedSim);
      else alert(res.error);
    } catch (err) { alert('Error de conexión.'); }
  };

  const handleStatus = async (status) => {
    if (status === 'cancelled' && !window.confirm('¿Cancelar esta simulación?')) return;
    try {
      const res = await simulationsService.setSimulationStatus(selectedSim.id, status);
      if (res.ok) {
        await fetchSimulations();
        setSelectedSim({ ...selectedSim, status });
      }
      else alert(res.error);
    } catch { alert('Error de conexión.'); }
  };

  return (
    <div className="simulations-page">
      <header className="page-header-actions">
        <div>
          <h1>Gestión de Simulaciones</h1>
          <p className="subtitle">Configura laboratorios y asigna roles operativos.</p>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          + Nueva Simulación
        </button>
      </header>

      <div className="dual-panel-layout">
        {/* Left Panel: Simulations List */}
        <aside className="side-panel card">
          <div className="panel-header">
            <h3>Simulaciones</h3>
          </div>
          <div className="panel-content scrollable">
            {loadingList ? <p>Cargando...</p> : (
              <div className="item-list">
                {simulations.map(sim => (
                  <div 
                    key={sim.id} 
                    className={`list-item ${selectedSim?.id === sim.id ? 'active' : ''}`}
                    onClick={() => handleSelectSim(sim)}
                  >
                    <div className="item-info">
                      <span className="item-name">{sim.name}</span>
                      <div className="item-meta-row">
                        <span className={`status-pill-tiny ${sim.status}`}>{sim.status}</span>
                        <span className="item-meta">{sim.laboratory_name}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {simulations.length === 0 && <p className="empty-msg">No hay simulaciones creadas</p>}
              </div>
            )}
          </div>
        </aside>

        {/* Main Panel: Simulation Detail & Assignment */}
        <main className="main-panel card">
          {!selectedSim ? (
            <div className="empty-state">
              <span className="icon">🚀</span>
              <h3>Selecciona una simulación para configurar</h3>
              <p>Podrás asignar supervisores, operadores y estaciones.</p>
            </div>
          ) : (
            loadingDetail ? <p>Cargando detalles...</p> : (
              <div className="sim-detail-view">
                <header className="sim-header">
                  <div className="sim-title-group">
                    <h2>{selectedSim.name}</h2>
                    <span className={`status-pill ${selectedSim.status}`}>{selectedSim.status}</span>
                  </div>
                  <div className="sim-actions">
                    {selectedSim.status === 'draft' && <button className="btn-primary" onClick={() => handleStatus('ready')}>Preparar</button>}
                    {selectedSim.status === 'ready' && <>
                      <button className="btn-secondary" onClick={() => handleStatus('draft')}>Volver a borrador</button>
                      <button className="btn-primary" onClick={() => handleStatus('running')}>Iniciar</button>
                    </>}
                    {selectedSim.status === 'running' && <button className="btn-primary" onClick={() => handleStatus('paused')}>Pausar</button>}
                    {selectedSim.status === 'paused' && <button className="btn-primary" onClick={() => handleStatus('running')}>Reanudar</button>}
                    {['draft', 'ready', 'running', 'paused'].includes(selectedSim.status) && (
                      <button className="btn-outline btn-warn-outline" onClick={() => handleStatus('cancelled')}>Cancelar</button>
                    )}
                  </div>
                </header>

                <section className="sim-info-grid">
                  <div className="info-card">
                    <label>Laboratorio</label>
                    <p>{selectedSim.laboratory_name}</p>
                  </div>
                  <div className="info-card">
                    <label>Duración Planificada</label>
                    <p>{selectedSim.planned_duration_minutes} minutos</p>
                  </div>
                  <div className="info-card">
                    <label>Creación</label>
                    <p>{new Date(selectedSim.created_at).toLocaleDateString()}</p>
                  </div>
                </section>

                <section className="participants-section">
                  <div className="section-header">
                    <h3>Participantes y Roles</h3>
                    {selectedSim.status === 'draft' && (
                      <button className="btn-add-inline" onClick={openAssignModal}>+ Asignar</button>
                    )}
                  </div>

                  <div className="participants-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Rol en Simulación</th>
                          <th>Línea / Estación</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.length > 0 ? (
                          participants.map(p => (
                            <tr key={p.id}>
                              <td data-label="Usuario">
                                <strong>{p.user_name}</strong>
                                <br /><small>@{p.username}</small>
                              </td>
                              <td data-label="Rol"><span className={`role-badge ${p.simulation_role}`}>{p.simulation_role}</span></td>
                              <td data-label="Asignación">
                                {p.simulation_role === 'supervisor' ? `Línea: ${p.line_name || '?'}` : 
                                 p.simulation_role === 'operator' ? `Estación: ${p.station_name || '?'}` : '---'}
                              </td>
                              <td data-label="Acciones">
                                {selectedSim.status === 'draft' && (
                                  <button className="btn-icon btn-warn" onClick={() => handleRemoveParticipant(p.id)}>🗑️</button>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan="4" className="text-center">No hay participantes asignados.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )
          )}
        </main>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <header className="modal-header">
              <h2>{modalType === 'create' ? 'Nueva Simulación' : 'Asignar Participante'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </header>

            <form onSubmit={handleSubmit}>
              {modalType === 'create' ? (
                <>
                  <div className="form-group">
                    <label>Nombre de la Práctica*</label>
                    <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Laboratorio*</label>
                    <select value={formData.laboratory_id || ''} onChange={e => setFormData({...formData, laboratory_id: e.target.value})} required>
                      <option value="">Selecciona un laboratorio...</option>
                      {laboratories.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Descripción</label>
                    <textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Duración Planificada (minutos)</label>
                    <input type="number" value={formData.planned_duration_minutes || 60} onChange={e => setFormData({...formData, planned_duration_minutes: parseInt(e.target.value)})} />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Alumno / Usuario*</label>
                    <select value={formData.user_id || ''} onChange={e => setFormData({...formData, user_id: e.target.value})} required>
                      <option value="">Selecciona un alumno...</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.name} (@{s.username})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Rol Operativo*</label>
                    <select value={formData.simulation_role || 'operator'} onChange={e => setFormData({...formData, simulation_role: e.target.value})} required>
                      <option value="operator">Operador</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="observer">Observador</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  
                  {formData.simulation_role === 'supervisor' && (
                    <div className="form-group">
                      <label>Línea de Producción*</label>
                      <select value={formData.line_id || ''} onChange={e => setFormData({...formData, line_id: e.target.value})} required>
                        <option value="">Selecciona línea...</option>
                        {labLines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  )}

                  {formData.simulation_role === 'operator' && (
                    <div className="form-group">
                      <label>Estación de Trabajo*</label>
                      <select value={formData.station_id || ''} onChange={e => setFormData({...formData, station_id: e.target.value})} required>
                        <option value="">Selecciona estación...</option>
                        {labStations.map(s => {
                          const isAssigned = participants.some(p => p.station_id === s.id);
                          return (
                            <option key={s.id} value={s.id} disabled={isAssigned}>
                              {s.name} {isAssigned ? '(Ocupada)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </>
              )}

              {error && <p className="error-alert">{error}</p>}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationsPage;
