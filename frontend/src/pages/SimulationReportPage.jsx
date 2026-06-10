import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import analyticsService from '../services/analyticsService';

export default function SimulationReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => { analyticsService.reportDetail(id).then((result) => result.ok ? setReport(result.report) : setMessage(result.error)); }, [id]);
  if (!report) return <div className={message ? 'alert error' : 'loading-inline'}>{message || 'Cargando reporte...'}</div>;
  const download = async (type) => {
    const name = `Sistema-Andon-${report.simulation.name}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
    const result = type === 'pdf' ? await analyticsService.downloadPdf(id, name) : await analyticsService.downloadExcel(id, name);
    if (!result.ok) setMessage(result.error);
  };
  return <div><header className="page-header-actions"><div><h1>Reporte: {report.simulation.name}</h1><p className="subtitle">{report.simulation.laboratory_name} | {report.simulation.status}</p></div><div className="action-buttons"><button className="btn-secondary" onClick={() => download('xlsx')}>Descargar Excel</button><button className="btn-primary" onClick={() => download('pdf')}>Descargar PDF</button></div></header>
    {message && <div className="alert error">{message}</div>}
    <div className="metric-grid">{Object.entries(report.summary).slice(0, 10).map(([key, value]) => <div className="card metric-card" key={key}><strong>{value ?? 0}</strong><span>{key.replaceAll('_', ' ')}</span></div>)}</div>
    <div className="card table-container"><h3>Participantes</h3><table className="data-table"><thead><tr><th>Nombre</th><th>Rol</th><th>Asignación</th></tr></thead><tbody>{report.participants.map((p) => <tr key={p.id}><td data-label="Nombre">{p.name}</td><td data-label="Rol">{p.simulation_role}</td><td data-label="Asignación">{p.station_name || p.line_name || '-'}</td></tr>)}</tbody></table></div>
  </div>;
}
