import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Plus, FileText } from 'lucide-react';

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ client_id: '', site_id: '', valid_until: '', notes: '', items: [] });
  const { isAdmin } = useAuth();

  const loadData = () => {
    Promise.all([api.get('/quotations'), api.get('/clients'), api.get('/catalogs/services')])
      .then(([q, c, s]) => { setQuotations(q.data); setClients(c.data); setServices(s.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const loadSites = (clientId) => {
    api.get(`/sites?client_id=${clientId}`).then(res => setSites(res.data)).catch(() => {});
  };

  const addItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, { service_catalog_id: '', description: '', quantity: 1, unit_price: 0 }] }));
  };

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    setForm(prev => ({ ...prev, items }));
  };

  const removeItem = (index) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleServiceSelect = (index, serviceId) => {
    const service = services.find(s => s.id == serviceId);
    const items = [...form.items];
    items[index] = { ...items[index], service_catalog_id: serviceId, description: service?.description || '', unit_price: service?.default_price || 0 };
    setForm(prev => ({ ...prev, items }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/quotations', form);
      setShowModal(false);
      setForm({ client_id: '', site_id: '', valid_until: '', notes: '', items: [] });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al crear cotización');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/quotations/${id}`, { status });
      loadData();
    } catch (err) {
      alert('Error al actualizar estado');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card-header">
        <h2>Cotizaciones ({quotations.length})</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Nueva cotización</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>ID</th><th>Cliente</th><th>Sitio</th><th>Total</th><th>Estado</th><th>Creado por</th><th>Fecha</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {quotations.map(q => (
                <tr key={q.id}>
                  <td>#{q.id}</td>
                  <td>{q.client_name}</td>
                  <td>{q.site_name || '-'}</td>
                  <td><strong>${q.total?.toLocaleString()}</strong></td>
                  <td><span className={`badge badge-${q.status === 'aceptada' ? 'green' : q.status === 'rechazada' ? 'red' : q.status === 'enviada' ? 'blue' : 'yellow'}`}>{q.status}</span></td>
                  <td>{q.created_by_name}</td>
                  <td style={{ fontSize: 12 }}>{new Date(q.created_at).toLocaleDateString('es-MX')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Link to={`/quotations/${q.id}`} className="btn btn-sm btn-outline"><FileText size={14} /> Ver</Link>
                      {isAdmin && q.status === 'borrador' && <button className="btn btn-sm btn-success" onClick={() => updateStatus(q.id, 'enviada')}>Enviar</button>}
                      {isAdmin && q.status === 'enviada' && <button className="btn btn-sm btn-success" onClick={() => updateStatus(q.id, 'aceptada')}>Aceptar</button>}
                      {isAdmin && (q.status === 'enviada' || q.status === 'borrador') && <button className="btn btn-sm btn-danger" onClick={() => updateStatus(q.id, 'rechazada')}>Rechazar</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {quotations.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>No hay cotizaciones</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Nueva cotización</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Cliente *</label>
                <select value={form.client_id} onChange={e => { setForm({ ...form, client_id: e.target.value }); loadSites(e.target.value); }} required>
                  <option value="">Seleccionar...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Sitio</label><select value={form.site_id} onChange={e => setForm({ ...form, site_id: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
                <div className="form-group"><label>Válido hasta</label><input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
              </div>

              <div style={{ margin: '16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>Servicios/Conceptos</strong>
                  <button type="button" className="btn btn-sm btn-primary" onClick={addItem}><Plus size={14} /> Agregar</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={item.service_catalog_id} onChange={e => handleServiceSelect(i, e.target.value)} style={{ flex: 1, minWidth: 150 }}>
                      <option value="">Servicio...</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name} (${s.default_price})</option>)}
                    </select>
                    <input type="number" placeholder="Cantidad" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} style={{ width: 80 }} min={1} />
                    <input type="number" placeholder="P. Unitario" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} style={{ width: 100 }} step="0.01" />
                    <span style={{ fontWeight: 600, minWidth: 60 }}>${(item.quantity * item.unit_price).toFixed(2)}</span>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(i)}>×</button>
                  </div>
                ))}
              </div>

              <div className="form-group"><label>Notas</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>

              <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, marginTop: 8 }}>
                Total: ${form.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear cotización</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}