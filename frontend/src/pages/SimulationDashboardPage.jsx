import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import analyticsService from '../services/analyticsService';

export default function SimulationDashboardPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { analyticsService.reportDetail(id).then((result) => result.ok ? setReport(result.report) : setError(result.error)); }, [id]);
  if (error) return <div className="alert error">{error}</div>;
  if (!report) return <div className="loading-inline">Cargando dashboard...</div>;
  const s = report.summary;
  const metrics = [['Avance', `${s.completion_percent || 0}%`], ['WIP', s.wip], ['Throughput/h', s.throughput_per_hour], ['Ciclo promedio', `${s.avg_cycle_seconds || 0}s`], ['Lead time', `${s.lead_time_minutes || 0} min`], ['Scrap/defectos', s.scrap], ['Tiempo muerto', `${s.downtime_minutes || 0} min`], ['Respuesta supervisor', `${s.avg_supervisor_response_seconds || 0}s`], ['Cuello de botella', s.bottleneck_station || 'Sin datos']];
  return <div><header className="page-header-actions"><div><h1>{report.simulation.name}</h1><p className="subtitle">Dashboard de simulación.</p></div><div className="action-buttons"><Link className="btn-secondary link-button" to={`../reporte`}>Reporte</Link><Link className="btn-secondary link-button" to={`../eventos`}>Eventos</Link><Link className="btn-primary link-button" to={`/andon/simulaciones/${id}`}>Andon</Link></div></header>
    <div className="metric-grid">{metrics.map(([label, value]) => <div className="card metric-card" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <div className="card table-container"><h3>Estaciones</h3><table className="data-table"><thead><tr><th>Estación</th><th>Línea</th><th>Operaciones</th><th>Ciclo promedio</th><th>Objetivo</th></tr></thead><tbody>{report.stations.map((item) => <tr key={item.id}><td data-label="Estación">{item.name}</td><td data-label="Línea">{item.line_name}</td><td data-label="Operaciones">{item.operations}</td><td data-label="Ciclo promedio">{item.avg_cycle_seconds || '-'} s</td><td data-label="Objetivo">{item.target_cycle_time_seconds}s</td></tr>)}</tbody></table></div>
    <div className="card table-container"><h3>Ranking de participantes</h3><table className="data-table"><thead><tr><th>Participante</th><th>Rol</th><th>Operaciones</th><th>Ciclo promedio</th><th>Incidentes reportados</th></tr></thead><tbody>{report.participant_ranking.map((item) => <tr key={item.id}><td data-label="Participante">{item.name}</td><td data-label="Rol">{item.simulation_role}</td><td data-label="Operaciones">{item.completed_operations}</td><td data-label="Ciclo promedio">{item.avg_cycle_seconds || '-'} s</td><td data-label="Incidentes">{item.reported_incidents}</td></tr>)}</tbody></table></div>
  </div>;
}
