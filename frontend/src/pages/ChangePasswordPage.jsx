import { useState } from 'react';
import authService from '../services/authService';

export default function ChangePasswordPage({ onChanged }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (next !== confirm) return setError('Las contraseñas nuevas no coinciden.');
    setSaving(true);
    const result = await authService.changePassword(current, next);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    onChanged();
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Cambiar contraseña</h1>
        <p>Debes establecer una contraseña personal antes de continuar.</p>
        <form onSubmit={submit} className="login-form">
          <div className="form-group">
            <label>Contraseña actual</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Nueva contraseña</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength="10" required />
          </div>
          <div className="form-group">
            <label>Confirmar contraseña</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <div className="error-alert">{error}</div>}
          <button className="btn-login" disabled={saving}>{saving ? 'Guardando...' : 'Cambiar contraseña'}</button>
        </form>
      </div>
    </div>
  );
}
