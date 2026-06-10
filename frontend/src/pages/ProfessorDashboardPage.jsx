import { useEffect, useState } from 'react';
import analyticsService from '../services/analyticsService';

export default function ProfessorDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    analyticsService.dashboard().then((result) => {
      if (result.ok) setData(result);
      else setError(result.error);
    });
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <div className="loading-inline">Cargando indicadores...</div>;

  const cards = [
    ['Laboratorios activos', data.summary.active_laboratories],
    ['Alumnos activos', data.summary.active_students],
    ['Simulaciones ejecutándose', data.summary.running_simulations],
    ['Tickets en proceso', data.summary.tickets_in_progress],
    ['Incidentes abiertos', data.summary.open_incidents],
    ['Paros activos', data.summary.active_downtimes],
  ];

  return (
    <div>
      <header className="page-header-actions"><div><h1>Dashboard</h1><p className="subtitle">Estado operativo del sistema.</p></div></header>
      <div className="metric-grid">
        {cards.map(([label, value]) => <div className="card metric-card" key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </div>
      <div className="card table-container">
        <h3>Simulaciones recientes</h3>
        <table className="data-table"><thead><tr><th>Nombre</th><th>Laboratorio</th><th>Estado</th></tr></thead>
          <tbody>{data.recent_simulations.map((sim) => <tr key={sim.id}><td data-label="Nombre">{sim.name}</td><td data-label="Laboratorio">{sim.laboratory_name}</td><td data-label="Estado">{sim.status}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
