import { useEffect, useState } from 'react';
import professorsService from '../services/professorsService';

const emptyForm = { name: '', username: '', email: '', temporary_password: '', is_admin: false };

export default function ProfessorsPage() {
  const [professors, setProfessors] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(false);
  const [message, setMessage] = useState('');

  const load = () => professorsService.list().then((result) => result.ok && setProfessors(result.professors));
  useEffect(() => { load(); }, []);

  const open = (professor = null) => {
    setEditing(professor);
    setForm(professor ? { ...professor, temporary_password: '', is_admin: Boolean(professor.is_admin) } : emptyForm);
    setMessage('');
    setModal(true);
  };
  const submit = async (event) => {
    event.preventDefault();
    const result = editing ? await professorsService.update(editing.id, form) : await professorsService.create(form);
    if (!result.ok) return setMessage(result.error);
    setMessage(result.temporary_password ? `Contraseña temporal: ${result.temporary_password}` : 'Profesor guardado.');
    load();
    if (!result.temporary_password) setModal(false);
  };
  const reset = async (professor) => {
    if (!confirm(`Restablecer contraseña de ${professor.name}?`)) return;
    const result = await professorsService.resetPassword(professor.id);
    setMessage(result.ok ? `Contraseña temporal para ${professor.username}: ${result.temporary_password}` : result.error);
  };

  return <div>
    <header className="page-header-actions"><div><h1>Profesores</h1><p className="subtitle">Administración exclusiva del administrador global.</p></div><button className="btn-primary" onClick={() => open()}>Nuevo profesor</button></header>
    {message && <div className={message.includes('temporal') ? 'alert success' : 'alert error'}>{message}</div>}
    <div className="card table-container"><table className="data-table"><thead><tr><th>Nombre</th><th>Usuario</th><th>Correo</th><th>Permiso</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>{professors.map((item) => <tr key={item.id}><td data-label="Nombre">{item.name}</td><td data-label="Usuario">{item.username}</td><td data-label="Correo">{item.email}</td><td data-label="Permiso">{item.is_admin ? 'Administrador' : 'Profesor'}</td><td data-label="Estado">{item.is_active ? 'Activo' : 'Inactivo'}</td><td data-label="Acciones"><div className="action-buttons"><button className="btn-secondary" onClick={() => open(item)}>Editar</button><button className="btn-secondary" onClick={() => reset(item)}>Contraseña</button><button className="btn-secondary" onClick={async () => { const result = await professorsService.status(item.id, !item.is_active); setMessage(result.ok ? 'Estado actualizado.' : result.error); load(); }}>{item.is_active ? 'Desactivar' : 'Activar'}</button></div></td></tr>)}</tbody>
    </table></div>
    {modal && <div className="modal-overlay"><div className="modal-content card"><header className="modal-header"><h2>{editing ? 'Editar profesor' : 'Nuevo profesor'}</h2><button className="btn-close" onClick={() => setModal(false)}>&times;</button></header>
      <form onSubmit={submit}><div className="form-grid">
        <div className="form-group"><label>Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="form-group"><label>Usuario</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
        <div className="form-group"><label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        {!editing && <div className="form-group"><label>Contraseña temporal</label><input value={form.temporary_password} onChange={(e) => setForm({ ...form, temporary_password: e.target.value })} placeholder="Se genera si queda vacío" /></div>}
      </div><label className="checkbox-row"><input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} /> Administrador global</label>
      {message && <div className="alert error">{message}</div>}<div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn-primary">Guardar</button></div></form>
    </div></div>}
  </div>;
}
