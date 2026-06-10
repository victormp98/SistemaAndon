import { useEffect, useState } from 'react';
import incidentsService from '../services/incidentsService';

export default function IncidentsPage() {
  const [data, setData] = useState({ incidents: [], downtimes: [] });
  const load = () => incidentsService.list().then((result) => result.ok && setData(result));
  useEffect(() => { load(); }, []);

  return (
    <div>
      <header className="page-header-actions"><div><h1>Incidentes y paros</h1><p className="subtitle">Seguimiento de eventos operativos.</p></div></header>
      <div className="card table-container"><h3>Incidentes</h3><table className="data-table"><thead><tr><th>Simulación</th><th>Estación</th><th>Tipo</th><th>Severidad</th><th>Descripción</th><th>Estado</th><th /></tr></thead>
        <tbody>{data.incidents.map((item) => <tr key={item.id}><td data-label="Simulación">{item.simulation_name}</td><td data-label="Estación">{item.station_name || '-'}</td><td data-label="Tipo">{item.type}</td><td data-label="Severidad">{item.severity}</td><td data-label="Descripción">{item.description}</td><td data-label="Estado">{item.status}</td><td data-label="Acciones">{item.status !== 'resolved' && <button className="btn-secondary" onClick={async () => { await incidentsService.setStatus(item.id, 'resolved'); load(); }}>Resolver</button>}</td></tr>)}</tbody>
      </table></div>
      <div className="card table-container"><h3>Paros</h3><table className="data-table"><thead><tr><th>Simulación</th><th>Estación</th><th>Motivo</th><th>Estado</th><th /></tr></thead>
        <tbody>{data.downtimes.map((item) => <tr key={item.id}><td data-label="Simulación">{item.simulation_name}</td><td data-label="Estación">{item.station_name || '-'}</td><td data-label="Motivo">{item.reason}</td><td data-label="Estado">{item.status}</td><td data-label="Acciones">{item.status === 'open' && <button className="btn-secondary" onClick={async () => { await incidentsService.closeDowntime(item.id); load(); }}>Cerrar paro</button>}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
