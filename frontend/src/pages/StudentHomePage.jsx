import { useState, useEffect, useCallback } from 'react';
import operatorService from '../services/operatorService';
import { io } from 'socket.io-client';
import authService from '../services/authService';
import incidentsService from '../services/incidentsService';

const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
const PRIORITY_COLORS = { low: 'muted', medium: 'info', high: 'warning', urgent: 'error' };

const StudentHomePage = ({ user }) => {
  const [context, setContext] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [operationModal, setOperationModal] = useState(null);
  const [operationForm, setOperationForm] = useState({ description: '', type: 'other', severity: 'medium', notes: '' });

  const loadData = useCallback(async () => {
    try {
      const ctxRes = await operatorService.getContext();
      if (ctxRes.ok && ctxRes.assignment) {
        setContext(ctxRes.assignment);
        
        const [ticketsRes, currRes] = await Promise.all([
          operatorService.getAvailableTickets(),
          operatorService.getCurrentTicket()
        ]);
        
        if (ticketsRes.ok) setTickets(ticketsRes.tickets);
        if (currRes.ok) setCurrentTicket(currRes.ticket);
      } else {
        setContext(null);
      }
    } catch (e) {
      console.error(e);
      setError('Error al cargar datos operativos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Configurar Socket.IO
    const socket = io({ auth: { token: authService.getToken() } });
    socket.on('ticket:updated', () => {
      // Refresh tickets if the update concerns this station
      loadData();
    });

    return () => {
      socket.disconnect();
    };
  }, [loadData]);

  const handleStartTicket = async (ticket) => {
    if (currentTicket) {
      setError('Ya tienes un ticket en proceso.');
      setTimeout(() => setError(''), 4000);
      return;
    }
    
    try {
      const res = await operatorService.startTicket(ticket.id);
      if (res.ok) {
        setSuccessMsg(`Ticket ${ticket.code} iniciado.`);
        setTimeout(() => setSuccessMsg(''), 4000);
        loadData();
      } else {
        setError(res.error || 'Error al iniciar ticket.');
        setTimeout(() => setError(''), 4000);
      }
    } catch {
      setError('Error de conexión.');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleCompleteTicket = async () => {
    if (!currentTicket || completing) return;
    setCompleting(true);
    try {
      const res = await operatorService.completeCurrentTicket(operationForm.notes);
      if (res.ok) {
        setSuccessMsg(res.result === 'completed' ? 'Ticket completado exitosamente.' : 'Ticket enviado a la siguiente estación.');
        setTimeout(() => setSuccessMsg(''), 4000);
        loadData();
        setOperationModal(null);
        setOperationForm({ description: '', type: 'other', severity: 'medium', notes: '' });
      } else {
        setError(res.error || 'Error al completar ticket.');
        setTimeout(() => setError(''), 4000);
      }
    } catch {
      setError('Error de conexión.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setCompleting(false);
    }
  };

  const reportIncident = async () => {
    const description = operationForm.description.trim();
    if (!description) return setError('Describe el incidente.');
    const result = await incidentsService.create({
      simulation_id: context.simulation_id,
      line_id: context.line_id,
      station_id: context.station_id,
      ticket_id: currentTicket?.id,
      type: operationForm.type,
      severity: operationForm.severity,
      description
    });
    if (result.ok) {
      setSuccessMsg('Incidente reportado.');
      setOperationModal(null);
      setOperationForm({ description: '', type: 'other', severity: 'medium', notes: '' });
    } else setError(result.error);
  };

  const reportDowntime = async () => {
    const reason = operationForm.description.trim();
    if (!reason) return setError('Describe el motivo del paro.');
    const result = await incidentsService.createDowntime({
      simulation_id: context.simulation_id,
      station_id: context.station_id,
      ticket_id: currentTicket?.id,
      reason
    });
    if (result.ok) {
      setSuccessMsg('Paro reportado.');
      setOperationModal(null);
      setOperationForm({ description: '', type: 'other', severity: 'medium', notes: '' });
    } else setError(result.error);
  };

  if (loading) return <div className="loading-screen">Cargando contexto...</div>;

  if (!context) {
    return (
      <div className="student-page">
        <div className="welcome-banner">
          <h2>Pantalla del Operador</h2>
          <p>Tu vista operativa se activará automáticamente cuando un profesor inicie una simulación y te asigne un rol (Supervisor u Operador).</p>
          <div className="status-badge info">No tienes una estación asignada en una simulación preparada.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-page operator-view">
      <header className="page-header-actions">
        <div>
          <h1>Pantalla del Operador</h1>
          <p className="subtitle">Operario: {user?.name}</p>
        </div>
        <div className="status-badge success">Conectado a Estación</div>
      </header>

      <div className="page-header-actions">
        <button className="btn-secondary" onClick={() => setOperationModal('incident')}>Reportar incidente</button>
        <button className="btn-outline btn-warn-outline" onClick={() => setOperationModal('downtime')}>Reportar paro</button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {successMsg && <div className="alert success">{successMsg}</div>}

      <div className="context-card card">
        <div className="context-header">
          <h3>Contexto Operativo</h3>
          <span className="sim-badge">{context.simulation_name}</span>
        </div>
        <div className="context-grid">
          <div className="context-item">
            <span className="label">Rol:</span>
            <span className="value">Operador</span>
          </div>
          <div className="context-item">
            <span className="label">Línea:</span>
            <span className="value">{context.line_name}</span>
          </div>
          <div className="context-item">
            <span className="label">Estación:</span>
            <span className="value">{context.station_name}</span>
          </div>
          {context.target_cycle_time_seconds > 0 && (
            <div className="context-item">
              <span className="label">Tiempo Ciclo:</span>
              <span className="value">{context.target_cycle_time_seconds}s</span>
            </div>
          )}
        </div>
        {context.station_instructions && (
          <div className="instructions-box">
            <h4>Instrucciones:</h4>
            <p>{context.station_instructions}</p>
          </div>
        )}
      </div>

      <div className="operator-layout">
        <section className="current-ticket-panel card">
          <div className="panel-header">
            <h3>Ticket Actual</h3>
          </div>
          <div className="panel-content">
            {currentTicket ? (
              <div className="ticket-in-progress">
                <div className="ticket-header">
                  <span className="ticket-code">{currentTicket.code}</span>
                  <span className={`priority-tag ${PRIORITY_COLORS[currentTicket.priority]}`}>
                    {PRIORITY_LABELS[currentTicket.priority]}
                  </span>
                </div>
                <h4 className="product-name">{currentTicket.product_name}</h4>
                <div className="status-indicator">
                  <span className="pulse-dot"></span> En proceso
                </div>
                <p className="time-info">Iniciado: {new Date(currentTicket.started_at + 'Z').toLocaleTimeString()}</p>
                <button 
                  className="btn-primary" 
                  onClick={() => setOperationModal('complete')}
                  disabled={completing}
                  style={{ width: '100%', marginTop: '1rem', padding: '0.8rem', fontSize: '1.1rem' }}
                >
                  {completing ? 'Enviando...' : 'Marcar como terminado'}
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <span className="icon">💤</span>
                <p>No tienes ningún ticket en proceso.</p>
                <p className="subtext">Toma uno de los tickets disponibles para comenzar.</p>
              </div>
            )}
          </div>
        </section>

        <section className="available-tickets-panel card">
          <div className="panel-header">
            <h3>Tickets Disponibles</h3>
            <span className="count-badge">{tickets.length}</span>
          </div>
          <div className="panel-content scrollable">
            {tickets.length > 0 ? (
              <div className="tickets-list">
                {tickets.map(ticket => (
                  <div key={ticket.id} className="ticket-item">
                    <div className="ticket-info">
                      <span className="ticket-code">{ticket.code}</span>
                      <span className="product-name">{ticket.product_name}</span>
                      <span className={`priority-dot ${PRIORITY_COLORS[ticket.priority]}`} title={PRIORITY_LABELS[ticket.priority]}></span>
                    </div>
                    <button 
                      className="btn-primary" 
                      onClick={() => handleStartTicket(ticket)}
                      disabled={!!currentTicket}
                    >
                      Tomar Ticket
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="icon">✓</span>
                <p>No hay tickets en la fila de espera para esta estación.</p>
              </div>
            )}
          </div>
        </section>
      </div>
      {operationModal && <div className="modal-overlay"><div className="modal-content card"><header className="modal-header"><h2>{operationModal === 'incident' ? 'Reportar incidente' : operationModal === 'downtime' ? 'Reportar paro' : 'Completar ticket'}</h2><button className="btn-close" onClick={() => setOperationModal(null)}>&times;</button></header>
        {operationModal === 'incident' && <div className="form-grid"><div className="form-group"><label>Tipo</label><select value={operationForm.type} onChange={(e) => setOperationForm({ ...operationForm, type: e.target.value })}><option value="defect">Defecto</option><option value="quality">Calidad</option><option value="safety">Seguridad</option><option value="material">Material</option><option value="other">Otro</option></select></div><div className="form-group"><label>Severidad</label><select value={operationForm.severity} onChange={(e) => setOperationForm({ ...operationForm, severity: e.target.value })}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div></div>}
        <div className="form-group"><label>{operationModal === 'complete' ? 'Notas de operación' : 'Descripción'}</label><textarea value={operationModal === 'complete' ? operationForm.notes : operationForm.description} onChange={(e) => setOperationForm({ ...operationForm, [operationModal === 'complete' ? 'notes' : 'description']: e.target.value })} rows="4" required={operationModal !== 'complete'} /></div>
        <div className="modal-footer"><button className="btn-secondary" onClick={() => setOperationModal(null)}>Cancelar</button><button className="btn-primary" onClick={operationModal === 'incident' ? reportIncident : operationModal === 'downtime' ? reportDowntime : handleCompleteTicket}>Confirmar</button></div>
      </div></div>}
    </div>
  );
};

export default StudentHomePage;
