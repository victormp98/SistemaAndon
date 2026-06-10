import { useEffect, useState } from 'react';
import analyticsService from '../services/analyticsService';
import { Link } from 'react-router-dom';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  useEffect(() => { analyticsService.reports().then((result) => result.ok && setReports(result.reports)); }, []);

  const exportCsv = () => {
    const header = ['Simulacion', 'Estado', 'Ordenes', 'Tickets', 'Completados', 'Ciclo promedio segundos', 'Incidentes', 'Paros'];
    const rows = reports.map((r) => [r.name, r.status, r.orders, r.tickets, r.completed, r.avg_cycle_seconds || '', r.incidents, r.downtimes]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'reporte-simulaciones.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div>
      <header className="page-header-actions"><div><h1>Reportes</h1><p className="subtitle">Resultados consolidados por simulación.</p></div><button className="btn-primary" onClick={exportCsv}>Exportar CSV</button></header>
      <div className="card table-container"><table className="data-table"><thead><tr><th>Simulación</th><th>Estado</th><th>Tickets</th><th>Completados</th><th>Ciclo prom.</th><th>Incidentes</th><th>Paros</th><th>Detalle</th></tr></thead>
        <tbody>{reports.map((r) => <tr key={r.id}><td data-label="Simulación">{r.name}</td><td data-label="Estado">{r.status}</td><td data-label="Tickets">{r.tickets}</td><td data-label="Completados">{r.completed}</td><td data-label="Ciclo promedio">{r.avg_cycle_seconds || '-'} s</td><td data-label="Incidentes">{r.incidents}</td><td data-label="Paros">{r.downtimes}</td><td data-label="Detalle"><Link className="btn-secondary link-button" to={`/profesor/simulaciones/${r.id}/reporte`}>Abrir</Link></td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
