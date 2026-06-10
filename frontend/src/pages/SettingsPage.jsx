import { useEffect, useState } from 'react';
import settingsService from '../services/settingsService';
import authService from '../services/authService';

export default function SettingsPage() {
  const [settings, setSettings] = useState({ organization_name: '', andon_refresh_seconds: '15', max_ticket_quantity: '500' });
  const [backups, setBackups] = useState([]);
  const [message, setMessage] = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const load = async () => {
    const [config, backupList] = await Promise.all([settingsService.get(), settingsService.backups()]);
    if (config.ok) setSettings((current) => ({ ...current, ...Object.fromEntries(config.settings.map((item) => [item.key, item.value])) }));
    if (backupList.ok) setBackups(backupList.backups);
  };
  useEffect(() => {
    load();
    authService.me().then((result) => setIsAdmin(Boolean(result.user?.is_admin)));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    const result = await settingsService.save(settings);
    setMessage(result.ok ? 'Configuración guardada.' : result.error);
  };
  const backup = async () => {
    const result = await settingsService.backup();
    setMessage(result.ok ? `Respaldo creado: ${result.file}` : result.error);
    load();
  };
  const restore = async () => {
    if (confirmation !== restoreTarget.name) return setMessage('Escribe el nombre completo del respaldo.');
    const result = await settingsService.restore(restoreTarget.name);
    setMessage(result.ok ? `${result.message} Respaldo de seguridad: ${result.safety_backup}` : result.error);
    if (result.ok) { setRestoreTarget(null); setConfirmation(''); }
  };

  return (
    <div>
      <header className="page-header-actions"><div><h1>Configuración</h1><p className="subtitle">Parámetros locales y respaldos.</p></div><button className="btn-primary" onClick={backup}>Crear respaldo</button></header>
      {message && <div className="alert success">{message}</div>}
      <form className="card" onSubmit={save}>
        {Object.entries(settings).map(([key, value]) => <div className="form-group" key={key}><label>{key}</label><input disabled={!isAdmin} value={value} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} /></div>)}
        {isAdmin ? <button className="btn-primary">Guardar</button> : <p className="subtitle">Sólo el administrador global puede modificar parámetros generales.</p>}
      </form>
      <div className="card"><h3>Respaldos</h3>{backups.map((item) => <div className="backup-row" key={item.name}><span><code>{item.name}</code> ({Math.round(item.size / 1024)} KB)</span>{isAdmin && <button className="btn-secondary" onClick={() => setRestoreTarget(item)}>Restaurar</button>}</div>)}</div>
      {restoreTarget && <div className="modal-overlay"><div className="modal-content card"><header className="modal-header"><h2>Confirmar restauración</h2><button className="btn-close" onClick={() => setRestoreTarget(null)}>&times;</button></header><div className="alert error">La base actual será sustituida al reiniciar el servidor. Antes se creará un respaldo de seguridad.</div><p>Escribe <code>{restoreTarget.name}</code> para confirmar.</p><div className="form-group"><input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></div><div className="modal-footer"><button className="btn-secondary" onClick={() => setRestoreTarget(null)}>Cancelar</button><button className="btn-primary" disabled={confirmation !== restoreTarget.name} onClick={restore}>Preparar restauración</button></div></div></div>}
    </div>
  );
}
