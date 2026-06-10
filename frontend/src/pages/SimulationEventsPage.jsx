import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import analyticsService from '../services/analyticsService';

export default function SimulationEventsPage() {
  const { id } = useParams();
  const [events, setEvents] = useState([]);
  useEffect(() => { analyticsService.events(id).then((result) => result.ok && setEvents(result.events)); }, [id]);
  return <div><header className="page-header-actions"><div><h1>Historial de eventos</h1><p className="subtitle">Trazabilidad cronológica de la simulación.</p></div></header>
    <div className="card table-container"><table className="data-table"><thead><tr><th>Fecha</th><th>Evento</th><th>Usuario</th><th>Ticket</th><th>Estación</th><th>Notas</th></tr></thead><tbody>{events.map((item) => <tr key={item.id}><td data-label="Fecha">{new Date(`${item.created_at}Z`).toLocaleString()}</td><td data-label="Evento">{item.event_type}</td><td data-label="Usuario">{item.user_name || '-'}</td><td data-label="Ticket">{item.ticket_code || '-'}</td><td data-label="Estación">{item.station_name || '-'}</td><td data-label="Notas">{item.notes || '-'}</td></tr>)}</tbody></table></div>
  </div>;
}
