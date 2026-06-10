import { useCallback, useEffect, useState } from 'react';
import auditService from '../services/auditService';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ action: '', from: '', to: '' });
  const load = useCallback(() => auditService.list(filters).then((result) => result.ok && setLogs(result.logs)), [filters]);
  useEffect(() => { auditService.list().then((result) => result.ok && setLogs(result.logs)); }, []);
  return <div>
    <header className="page-header-actions"><div><h1>Auditoría</h1><p className="subtitle">Acciones administrativas y operativas registradas.</p></div></header>
    <form className="card filter-bar" onSubmit={(event) => { event.preventDefault(); load(); }}><input placeholder="Acción" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} /><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /><input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /><button className="btn-primary">Filtrar</button></form>
    <div className="card table-container"><table className="data-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Resultado</th><th>IP</th></tr></thead><tbody>
      {logs.map((item) => <tr key={item.id}><td data-label="Fecha">{new Date(`${item.created_at}Z`).toLocaleString()}</td><td data-label="Usuario">{item.user_name || item.username || 'Sistema'}</td><td data-label="Acción">{item.action}</td><td data-label="Entidad">{item.entity_type || '-'} {item.entity_id || ''}</td><td data-label="Resultado">{item.success ? 'Correcto' : 'Fallido'}</td><td data-label="IP">{item.ip_address || '-'}</td></tr>)}
    </tbody></table></div>
  </div>;
}
