import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import participantService from '../services/participantService';
import StudentHomePage from './StudentHomePage';

export default function ParticipantHomePage({ user }) {
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState('');
  useEffect(() => { participantService.assignments().then((result) => result.ok && setAssignments(result.assignments)); }, []);
  const operator = assignments.find((item) => item.simulation_role === 'operator' && ['ready', 'running', 'paused'].includes(item.status));
  const complete = async (simulationId) => {
    const result = await participantService.completeSimulation(simulationId);
    setMessage(result.ok ? result.message : result.error);
    if (result.ok) participantService.assignments().then((response) => response.ok && setAssignments(response.assignments));
  };
  return <div>
    <header className="page-header-actions"><div><h1>Mis simulaciones</h1><p className="subtitle">Contexto asignado y herramientas según tu rol.</p></div></header>
    {message && <div className="alert success">{message}</div>}
    <div className="assignment-grid">{assignments.map((item) => <article className="card" key={item.id}><span className={`role-badge ${item.simulation_role}`}>{item.simulation_role}</span><h3>{item.simulation_name}</h3><p>{item.laboratory_name}</p><p>Estado: <strong>{item.status}</strong></p>{item.line_name && <p>Línea: {item.line_name}</p>}{item.station_name && <p>Estación: {item.station_name}</p>}
      <div className="action-buttons"><Link className="btn-secondary link-button" to={`/alumno/simulaciones/${item.simulation_id}/dashboard`}>Dashboard</Link><Link className="btn-secondary link-button" to={`/andon/simulaciones/${item.simulation_id}`}>Andon</Link>{item.simulation_role !== 'operator' && <Link className="btn-secondary link-button" to={`/alumno/simulaciones/${item.simulation_id}/reporte`}>Reporte</Link>}{item.simulation_role === 'supervisor' && <Link className="btn-secondary link-button" to={`/alumno/simulaciones/${item.simulation_id}/incidentes`}>Incidentes</Link>}{item.simulation_role === 'manager' && ['running', 'paused'].includes(item.status) && <button className="btn-primary" onClick={() => complete(item.simulation_id)}>Cerrar simulación</button>}</div>
    </article>)}</div>
    {!assignments.length && <div className="card empty-state compact-empty">No tienes simulaciones asignadas.</div>}
    {operator && <div className="embedded-operator"><StudentHomePage user={user} /></div>}
  </div>;
}
