import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import analyticsService from '../services/analyticsService';
import authService from '../services/authService';
import { useNavigate, useParams } from 'react-router-dom';

export default function AndonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState({ simulations: [], stations: [] });
  const [lineId, setLineId] = useState('');
  const load = useCallback(() => analyticsService.andon(id).then((result) => result.ok && setData(result)), [id]);

  useEffect(() => {
    load();
    const socket = io({ auth: { token: authService.getToken() } });
    ['ticket:updated', 'simulation:status', 'incident:created', 'downtime:created'].forEach((event) => socket.on(event, load));
    const timer = setInterval(load, Math.max(Number(data.refresh_seconds || 15), 5) * 1000);
    return () => { clearInterval(timer); socket.disconnect(); };
  }, [load, data.refresh_seconds]);

  const lines = [...new Map(data.stations.map((station) => [station.line_id, station.line_name])).entries()];
  const visibleStations = lineId ? data.stations.filter((station) => String(station.line_id) === lineId) : data.stations;

  return (
    <div className="andon-page">
      <header className="page-header-actions"><div><h1>Panel Andon</h1><p className="subtitle">Estado en tiempo real. Refresco: {data.refresh_seconds || 15}s.</p></div><div className="action-buttons"><select value={id || ''} onChange={(e) => navigate(e.target.value ? `/andon/simulaciones/${e.target.value}` : '/andon')}><option value="">Todas las simulaciones</option>{data.simulations.map((simulation) => <option value={simulation.id} key={simulation.id}>{simulation.name}</option>)}</select><select value={lineId} onChange={(e) => setLineId(e.target.value)}><option value="">Todas las líneas</option>{lines.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="btn-secondary" onClick={() => document.documentElement.requestFullscreen?.()}>Pantalla completa</button></div></header>
      {data.simulations.map((simulation) => (
        <section className="card" key={simulation.id}>
          <h2>{simulation.name} <span className={`status-pill ${simulation.status}`}>{simulation.status}</span></h2>
          <div className="andon-grid">
            {visibleStations.filter((station) => station.simulation_id === simulation.id).map((station) => (
              <div className={`andon-station ${station.is_down ? 'down' : station.has_incident ? 'warning' : 'ok'}`} key={station.station_id}>
                <strong>{station.station_name}</strong><span>{station.line_name}</span>
                <small>Cola: {station.queued} | Proceso: {station.in_progress} | Terminados: {station.completed}</small>
              </div>
            ))}
          </div>
        </section>
      ))}
      {!data.simulations.length && <div className="card empty-state">No hay simulaciones preparadas o activas.</div>}
    </div>
  );
}
