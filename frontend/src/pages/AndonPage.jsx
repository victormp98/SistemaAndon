import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import analyticsService from '../services/analyticsService';
import authService from '../services/authService';

export default function AndonPage() {
  const [data, setData] = useState({ simulations: [], stations: [] });
  const load = useCallback(() => analyticsService.andon().then((result) => result.ok && setData(result)), []);

  useEffect(() => {
    load();
    const socket = io({ auth: { token: authService.getToken() } });
    ['ticket:updated', 'simulation:status', 'incident:created', 'downtime:created'].forEach((event) => socket.on(event, load));
    const timer = setInterval(load, 15000);
    return () => { clearInterval(timer); socket.disconnect(); };
  }, [load]);

  return (
    <div>
      <header className="page-header-actions"><div><h1>Panel Andon</h1><p className="subtitle">Estado en tiempo real de líneas y estaciones.</p></div></header>
      {data.simulations.map((simulation) => (
        <section className="card" key={simulation.id}>
          <h2>{simulation.name} <span className={`status-pill ${simulation.status}`}>{simulation.status}</span></h2>
          <div className="andon-grid">
            {data.stations.filter((station) => station.simulation_id === simulation.id).map((station) => (
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
