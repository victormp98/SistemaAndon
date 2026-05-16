import { useState, useEffect, useCallback } from 'react';
import ordersService from '../services/ordersService';
import simulationsService from '../services/simulationsService';
import laboratoriesService from '../services/laboratoriesService';

const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
const PRIORITY_COLORS = { low: 'muted', medium: 'info', high: 'warning', urgent: 'error' };

const OrdersPage = () => {
  const [simulations, setSimulations] = useState([]);
  const [selectedSimId, setSelectedSimId] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [labLines, setLabLines] = useState([]);

  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ product_name: '', line_id: '', target_quantity: 10, priority: 'medium' });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Load draft simulations on mount
  useEffect(() => {
    simulationsService.getSimulations().then(res => {
      if (res.ok) setSimulations(res.simulations.filter(s => s.status === 'draft'));
    });
  }, []);

  // Load orders when simulation changes
  const fetchOrders = useCallback(async (simId) => {
    if (!simId) return setOrders([]);
    setLoadingOrders(true);
    try {
      const data = await ordersService.getOrders(simId);
      if (data.ok) setOrders(data.orders);
    } catch (e) { console.error(e); }
    finally { setLoadingOrders(false); }
  }, []);

  useEffect(() => { fetchOrders(selectedSimId); }, [selectedSimId, fetchOrders]);

  // Load lines when simulation changes
  useEffect(() => {
    if (!selectedSimId) return setLabLines([]);
    const sim = simulations.find(s => s.id === +selectedSimId);
    if (!sim) return;
    laboratoriesService.getLines(sim.laboratory_id).then(res => {
      if (res.ok) setLabLines(res.lines.filter(l => l.is_active));
    });
  }, [selectedSimId, simulations]);

  const handleSelectOrder = async (order) => {
    setSelectedOrder(order);
    setLoadingDetail(true);
    try {
      const data = await ordersService.getOrderById(order.id);
      if (data.ok) setTickets(data.tickets);
    } catch (e) { console.error(e); }
    finally { setLoadingDetail(false); }
  };

  const openCreateModal = () => {
    setFormData({ product_name: '', line_id: labLines[0]?.id || '', target_quantity: 10, priority: 'medium' });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await ordersService.createOrder({ ...formData, simulation_id: selectedSimId });
      if (res.ok) {
        setIsModalOpen(false);
        setSuccessMsg(`Orden ${res.order.code} creada exitosamente.`);
        fetchOrders(selectedSimId);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(res.error);
      }
    } catch (e) { setError('Error de conexión.'); }
  };

  const handleGenerateTickets = async (order) => {
    if (!window.confirm(`¿Generar ${order.target_quantity} tickets para "${order.product_name}"?`)) return;
    try {
      const res = await ordersService.generateTickets(order.id);
      if (res.ok) {
        setSuccessMsg(res.message);
        fetchOrders(selectedSimId);
        handleSelectOrder({ ...order, ticket_count: order.target_quantity });
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(res.error);
      }
    } catch (e) { alert('Error de conexión.'); }
  };

  const selectedSim = simulations.find(s => s.id === +selectedSimId);

  return (
    <div className="orders-page">
      <header className="page-header-actions">
        <div>
          <h1>Órdenes de Producción</h1>
          <p className="subtitle">Planifica la producción y genera tickets de trabajo por estación.</p>
        </div>
        <button className="btn-primary" disabled={!selectedSimId} onClick={openCreateModal}>
          + Nueva Orden
        </button>
      </header>

      {successMsg && <div className="alert success">{successMsg}</div>}

      {/* Simulation Selector */}
      <div className="sim-selector card">
        <label>Simulación en borrador:</label>
        <select value={selectedSimId} onChange={e => { setSelectedSimId(e.target.value); setSelectedOrder(null); setTickets([]); }}>
          <option value="">Selecciona una simulación...</option>
          {simulations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {selectedSim && <span className="sim-lab-badge">🏭 {selectedSim.laboratory_name}</span>}
      </div>

      {selectedSimId && (
        <div className="orders-layout">
          {/* Orders Panel */}
          <section className="orders-list-panel card">
            <div className="panel-header">
              <h3>Órdenes</h3>
              <span className="count-badge">{orders.length}</span>
            </div>
            <div className="panel-content scrollable">
              {loadingOrders ? <p>Cargando...</p> : (
                <div className="item-list">
                  {orders.map(order => (
                    <div
                      key={order.id}
                      className={`order-card ${selectedOrder?.id === order.id ? 'active' : ''}`}
                      onClick={() => handleSelectOrder(order)}
                    >
                      <div className="order-card-top">
                        <code className="order-code">{order.code}</code>
                        <span className={`priority-dot ${PRIORITY_COLORS[order.priority]}`} title={PRIORITY_LABELS[order.priority]} />
                      </div>
                      <p className="order-product">{order.product_name}</p>
                      <div className="order-card-meta">
                        <span>{order.line_name}</span>
                        <span>{order.ticket_count || 0}/{order.target_quantity} tickets</span>
                      </div>
                      {(!order.ticket_count || order.ticket_count === 0) ? (
                        <button
                          className="btn-generate"
                          onClick={e => { e.stopPropagation(); handleGenerateTickets(order); }}
                        >
                          ⚡ Generar Tickets
                        </button>
                      ) : (
                        <div className="tickets-generated-badge">✅ Tickets Generados</div>
                      )}
                    </div>
                  ))}
                  {orders.length === 0 && <p className="empty-msg">No hay órdenes para esta simulación</p>}
                </div>
              )}
            </div>
          </section>

          {/* Tickets Detail Panel */}
          <section className="tickets-panel card">
            {!selectedOrder ? (
              <div className="empty-state">
                <span className="icon">📋</span>
                <h3>Selecciona una orden</h3>
                <p>Verás aquí los tickets generados y su estado inicial.</p>
              </div>
            ) : (
              <div>
                <div className="panel-header">
                  <div>
                    <h3>{selectedOrder.product_name}</h3>
                    <span className="order-code-header">{selectedOrder.code}</span>
                  </div>
                  <div className="ticket-count-summary">
                    <span className="big-count">{tickets.length}</span>
                    <span>/ {selectedOrder.target_quantity} tickets</span>
                  </div>
                </div>

                {loadingDetail ? <p>Cargando tickets...</p> : (
                  tickets.length > 0 ? (
                    <div className="tickets-grid-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Estación Inicial</th>
                            <th>Estado</th>
                            <th>Prioridad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tickets.map(t => (
                            <tr key={t.id}>
                              <td><code>{t.code}</code></td>
                              <td>{t.station_name || '—'}</td>
                              <td>
                                <span className={`status-pill-small ${t.status === 'available' ? 'success' : ''}`}>
                                  {t.status}
                                </span>
                              </td>
                              <td>
                                <span className={`priority-tag ${PRIORITY_COLORS[t.priority]}`}>
                                  {PRIORITY_LABELS[t.priority]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ height: '300px' }}>
                      <span className="icon">⚡</span>
                      <h3>Sin tickets generados</h3>
                      <p>Usa el botón "Generar Tickets" en la orden para crearlos.</p>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <header className="modal-header">
              <h2>Nueva Orden de Producción</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </header>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre del Producto*</label>
                <input
                  type="text" value={formData.product_name}
                  onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="Ej. Ensamble Tipo A" required
                />
              </div>
              <div className="form-group">
                <label>Línea de Producción*</label>
                <select value={formData.line_id} onChange={e => setFormData({ ...formData, line_id: e.target.value })} required>
                  <option value="">Selecciona línea...</option>
                  {labLines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Cantidad Objetivo*</label>
                  <input
                    type="number" min="1" max="200"
                    value={formData.target_quantity}
                    onChange={e => setFormData({ ...formData, target_quantity: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Prioridad</label>
                  <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
              {error && <p className="error-alert">{error}</p>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Crear Orden</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
