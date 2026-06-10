import { useEffect, useState } from 'react';
import settingsService from '../services/settingsService';

export default function SettingsPage() {
  const [settings, setSettings] = useState({ organization_name: '', andon_refresh_seconds: '15', max_ticket_quantity: '500' });
  const [backups, setBackups] = useState([]);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [config, backupList] = await Promise.all([settingsService.get(), settingsService.backups()]);
    if (config.ok) setSettings((current) => ({ ...current, ...Object.fromEntries(config.settings.map((item) => [item.key, item.value])) }));
    if (backupList.ok) setBackups(backupList.backups);
  };
  useEffect(() => { load(); }, []);

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

  return (
    <div>
      <header className="page-header-actions"><div><h1>Configuración</h1><p className="subtitle">Parámetros locales y respaldos.</p></div><button className="btn-primary" onClick={backup}>Crear respaldo</button></header>
      {message && <div className="alert success">{message}</div>}
      <form className="card" onSubmit={save}>
        {Object.entries(settings).map(([key, value]) => <div className="form-group" key={key}><label>{key}</label><input value={value} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} /></div>)}
        <button className="btn-primary">Guardar</button>
      </form>
      <div className="card"><h3>Respaldos</h3>{backups.map((item) => <p key={item.name}><code>{item.name}</code> ({Math.round(item.size / 1024)} KB)</p>)}</div>
    </div>
  );
}
