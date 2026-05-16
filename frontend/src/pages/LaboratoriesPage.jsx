import { useState, useEffect, useCallback } from 'react';
import laboratoriesService from '../services/laboratoriesService';

const LaboratoriesPage = () => {
  const [labs, setLabs] = useState([]);
  const [lines, setLines] = useState([]);
  const [stations, setStations] = useState([]);
  
  const [selectedLab, setSelectedLab] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);
  const [loadingStations, setLoadingStations] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); // 'lab', 'line', 'station'
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit'
  const [editingItem, setEditingItem] = useState(null);

  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');

  const fetchLabs = useCallback(async () => {
    setLoadingLabs(true);
    try {
      const data = await laboratoriesService.getLaboratories();
      if (data.ok) setLabs(data.laboratories);
    } catch (err) { console.error(err); }
    finally { setLoadingLabs(false); }
  }, []);

  useEffect(() => { fetchLabs(); }, [fetchLabs]);

  const fetchLines = async (labId) => {
    setLoadingLines(true);
    setStations([]);
    setSelectedLine(null);
    try {
      const data = await laboratoriesService.getLines(labId);
      if (data.ok) setLines(data.lines);
    } catch (err) { console.error(err); }
    finally { setLoadingLines(false); }
  };

  const fetchStations = async (lineId) => {
    setLoadingStations(true);
    try {
      const data = await laboratoriesService.getStations(lineId);
      if (data.ok) setStations(data.stations);
    } catch (err) { console.error(err); }
    finally { setLoadingStations(false); }
  };

  const handleSelectLab = (lab) => {
    setSelectedLab(lab);
    fetchLines(lab.id);
  };

  const handleSelectLine = (line) => {
    setSelectedLine(line);
    fetchStations(line.id);
  };

  const openModal = (type, mode, item = null) => {
    setModalType(type);
    setModalMode(mode);
    setEditingItem(item);
    setError('');
    
    if (mode === 'edit' && item) {
      setFormData({ ...item });
    } else {
      if (type === 'lab') setFormData({ name: '', description: '' });
      if (type === 'line') setFormData({ name: '', description: '', sequence_order: lines.length + 1 });
      if (type === 'station') setFormData({ 
        name: '', description: '', instructions: '', sequence_order: stations.length + 1, 
        target_cycle_time_seconds: 60, allows_defects: 1, allows_downtime: 1 
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      let res;
      if (modalType === 'lab') {
        res = modalMode === 'create' 
          ? await laboratoriesService.createLaboratory(formData)
          : await laboratoriesService.updateLaboratory(editingItem.id, formData);
        if (res.ok) fetchLabs();
      } else if (modalType === 'line') {
        res = modalMode === 'create'
          ? await laboratoriesService.createLine(selectedLab.id, formData)
          : await laboratoriesService.updateLine(editingItem.id, formData);
        if (res.ok) fetchLines(selectedLab.id);
      } else if (modalType === 'station') {
        res = modalMode === 'create'
          ? await laboratoriesService.createStation(selectedLine.id, formData)
          : await laboratoriesService.updateStation(editingItem.id, formData);
        if (res.ok) fetchStations(selectedLine.id);
      }

      if (res.ok) {
        setIsModalOpen(false);
      } else {
        setError(res.error || 'Error al guardar.');
      }
    } catch (err) {
      setError('Error de conexión.');
    }
  };

  return (
    <div className="laboratories-page">
      <header className="page-header-actions">
        <div>
          <h1>Configuración de Laboratorios</h1>
          <p className="subtitle">Gestiona la infraestructura jerárquica de producción.</p>
        </div>
        <button className="btn-primary" onClick={() => openModal('lab', 'create')}>
          + Nuevo Laboratorio
        </button>
      </header>

      <div className="hierarchy-container">
        {/* Step 1: Laboratories */}
        <section className="hierarchy-column card">
          <div className="column-header">
            <h3>Laboratorios</h3>
          </div>
          <div className="column-content">
            {loadingLabs ? <p>Cargando...</p> : (
              <div className="item-list">
                {labs.map(lab => (
                  <div 
                    key={lab.id} 
                    className={`list-item ${selectedLab?.id === lab.id ? 'active' : ''} ${!lab.is_active ? 'disabled' : ''}`}
                    onClick={() => handleSelectLab(lab)}
                  >
                    <div className="item-info">
                      <span className="item-name">{lab.name}</span>
                      <span className="item-meta">{lab.line_count || 0} líneas</span>
                    </div>
                    <button className="btn-edit-small" onClick={(e) => { e.stopPropagation(); openModal('lab', 'edit', lab); }}>✏️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Lines */}
        <section className={`hierarchy-column card ${!selectedLab ? 'locked' : ''}`}>
          <div className="column-header">
            <h3>Líneas {selectedLab && <small>({selectedLab.name})</small>}</h3>
            {selectedLab && <button className="btn-add-inline" onClick={() => openModal('line', 'create')}>+</button>}
          </div>
          <div className="column-content">
            {!selectedLab ? <p className="empty-msg">Selecciona un laboratorio</p> : (
              loadingLines ? <p>Cargando...</p> : (
                <div className="item-list">
                  {lines.map(line => (
                    <div 
                      key={line.id} 
                      className={`list-item ${selectedLine?.id === line.id ? 'active' : ''} ${!line.is_active ? 'disabled' : ''}`}
                      onClick={() => handleSelectLine(line)}
                    >
                      <div className="item-info">
                        <span className="item-name">{line.name}</span>
                        <span className="item-order">Orden: {line.sequence_order}</span>
                      </div>
                      <button className="btn-edit-small" onClick={(e) => { e.stopPropagation(); openModal('line', 'edit', line); }}>✏️</button>
                    </div>
                  ))}
                  {lines.length === 0 && <p className="empty-msg">No hay líneas creadas</p>}
                </div>
              )
            )}
          </div>
        </section>

        {/* Step 3: Stations */}
        <section className={`hierarchy-column card wide ${!selectedLine ? 'locked' : ''}`}>
          <div className="column-header">
            <h3>Estaciones {selectedLine && <small>({selectedLine.name})</small>}</h3>
            {selectedLine && <button className="btn-add-inline" onClick={() => openModal('station', 'create')}>+</button>}
          </div>
          <div className="column-content">
            {!selectedLine ? <p className="empty-msg">Selecciona una línea</p> : (
              loadingStations ? <p>Cargando...</p> : (
                <div className="item-list-grid">
                  {stations.map(station => (
                    <div key={station.id} className={`grid-card ${!station.is_active ? 'disabled' : ''}`}>
                      <div className="grid-card-header">
                        <span className="order-badge">#{station.sequence_order}</span>
                        <h4>{station.name}</h4>
                        <button className="btn-edit-small" onClick={() => openModal('station', 'edit', station)}>✏️</button>
                      </div>
                      <div className="grid-card-body">
                        <p>{station.description || 'Sin descripción'}</p>
                        <div className="station-metrics">
                          <span>⏱️ {station.target_cycle_time_seconds}s</span>
                          <span title="Permite defectos">{station.allows_defects ? '✅ Def.' : '❌ Def.'}</span>
                          <span title="Permite paros">{station.allows_downtime ? '✅ Paros' : '❌ Paros'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {stations.length === 0 && <p className="empty-msg">No hay estaciones creadas</p>}
                </div>
              )
            )}
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <header className="modal-header">
              <h2>{modalMode === 'create' ? 'Crear' : 'Editar'} {modalType === 'lab' ? 'Laboratorio' : modalType === 'line' ? 'Línea' : 'Estación'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </header>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre*</label>
                <input 
                  type="text" 
                  value={formData.name || ''} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea 
                  value={formData.description || ''} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                />
              </div>

              {modalType === 'line' && (
                <div className="form-group">
                  <label>Orden de Secuencia</label>
                  <input 
                    type="number" 
                    value={formData.sequence_order || 0} 
                    onChange={(e) => setFormData({...formData, sequence_order: parseInt(e.target.value)})} 
                  />
                </div>
              )}

              {modalType === 'station' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Instrucciones de Trabajo</label>
                    <textarea 
                      value={formData.instructions || ''} 
                      onChange={(e) => setFormData({...formData, instructions: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Orden</label>
                    <input 
                      type="number" 
                      value={formData.sequence_order || 0} 
                      onChange={(e) => setFormData({...formData, sequence_order: parseInt(e.target.value)})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Tiempo Ciclo Obj. (s)</label>
                    <input 
                      type="number" 
                      value={formData.target_cycle_time_seconds || 0} 
                      onChange={(e) => setFormData({...formData, target_cycle_time_seconds: parseInt(e.target.value)})} 
                    />
                  </div>
                  <div className="form-checkboxes">
                    <label><input type="checkbox" checked={!!formData.allows_defects} onChange={(e) => setFormData({...formData, allows_defects: e.target.checked})} /> Permite Defectos</label>
                    <label><input type="checkbox" checked={!!formData.allows_downtime} onChange={(e) => setFormData({...formData, allows_downtime: e.target.checked})} /> Permite Paros</label>
                  </div>
                </div>
              )}

              {modalMode === 'edit' && (
                <div className="form-group">
                  <label><input type="checkbox" checked={!!formData.is_active} onChange={(e) => setFormData({...formData, is_active: e.target.checked})} /> Activo</label>
                </div>
              )}

              {error && <p className="error-alert">{error}</p>}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaboratoriesPage;
