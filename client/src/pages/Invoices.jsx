import { useState, useEffect } from 'react';
import api from '../api';
import { FileText, Plus, Search, DollarSign, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';

const STATUS_ICONS = {
  pendiente: <Clock size={14} />,
  pagada: <CheckCircle size={14} />,
  vencida: <AlertTriangle size={14} />,
  cancelada: <X size={14} />
};

const STATUS_COLORS = {
  pendiente: 'yellow',
  pagada: 'green',
  vencida: 'red',
  cancelada: 'gray'
};

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ client_id: '', status: '' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    client_id: '', site_id: '', number: '', amount: '', tax: '0', total: '',
    status: 'pendiente', issue_date: new Date().toISOString().split('T')[0],
    due_date: '', payment_method: '', notes: ''
  });

  const fetchInvoices = () => {
    const params = new URLSearchParams();
    if (filter.client_id) params.append('client_id', filter.client_id);
    if (filter.status) params.append('status', filter.status);
    api.get(`/invoices?${params.toString()}`).then(res => setInvoices(res.data)).catch(() => {});
  };

  useEffect(() => {
    fetchInvoices();
    api.get('/clients').then(res => setClients(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.client_id) {
      api.get(`/sites?client_id=${form.client_id}`).then(res => setSites(res.data || [])).catch(() => {});
    }
  }, [form.client_id]);

  const totals = {
    total: invoices.reduce((sum, i) => sum + (i.status !== 'cancelada' ? i.total : 0), 0),
    pendiente: invoices.filter(i => i.status === 'pendiente').reduce((sum, i) => sum + i.total, 0),
    pagada: invoices.filter(i => i.status === 'pagada').reduce((sum, i) => sum + i.total, 0),
    vencida: invoices.filter(i => i.status === 'vencida').reduce((sum, i) => sum + i.total, 0)
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/invoices', {
        ...form,
        amount: parseFloat(form.amount),
        tax: parseFloat(form.tax),
        total: parseFloat(form.total)
      });
      setShowModal(false);
      setForm({
        client_id: '', site_id: '', number: '', amount: '', tax: '0', total: '',
        status: 'pendiente', issue_date: new Date().toISOString().split('T')[0],
        due_date: '', payment_method: '', notes: ''
      });
      fetchInvoices();
    } catch (err) { alert(err.response?.data?.error || 'Error al crear factura'); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/invoices/${id}`, { status: newStatus, paid_date: newStatus === 'pagada' ? new Date().toISOString().split('T')[0] : null });
      fetchInvoices();
    } catch (err) { alert('Error al actualizar'); }
  };

  const formatCurrency = (val) => `$${parseFloat(val || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Gestión de Cobranza</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Nueva Factura
        </button>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon blue"><DollarSign size={20} /></div>
          <div><div className="stat-value">{formatCurrency(totals.total)}</div><div className="stat-label">Total facturado</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Clock size={20} /></div>
          <div><div className="stat-value">{formatCurrency(totals.pendiente)}</div><div className="stat-label">Pendiente</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={20} /></div>
          <div><div className="stat-value">{formatCurrency(totals.pagada)}</div><div className="stat-label">Pagado</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={20} /></div>
          <div><div className="stat-value">{formatCurrency(totals.vencida)}</div><div className="stat-label">Vencido</div></div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={filter.client_id} onChange={e => setFilter({ ...filter, client_id: e.target.value })}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }}>
          <option value="">Todos los clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagada">Pagada</option>
          <option value="vencida">Vencida</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={fetchInvoices}>Filtrar</button>
      </div>

      {/* Invoices table */}
      <div className="card">
        <div className="table-container" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Cliente</th><th>Sitio</th><th>Monto</th><th>IVA</th><th>Total</th>
                <th>Emisión</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length > 0 ? invoices.map(inv => (
                <tr key={inv.id}>
                  <td><strong>{inv.number}</strong></td>
                  <td>{inv.client_name}</td>
                  <td>{inv.site_name || 'N/A'}</td>
                  <td>{formatCurrency(inv.amount)}</td>
                  <td>{formatCurrency(inv.tax)}</td>
                  <td><strong>{formatCurrency(inv.total)}</strong></td>
                  <td style={{ fontSize: 12 }}>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('es-MX') : '-'}</td>
                  <td style={{ fontSize: 12, color: inv.status === 'vencida' ? 'var(--danger)' : 'inherit' }}>
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString('es-MX') : '-'}
                  </td>
                  <td>
                    <span className={`badge badge-${STATUS_COLORS[inv.status]}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {STATUS_ICONS[inv.status]} {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {inv.status === 'pendiente' && (
                        <button className="btn btn-sm btn-success" style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => handleStatusChange(inv.id, 'pagada')}>Pagar</button>
                      )}
                      {inv.status === 'pagada' && (
                        <button className="btn btn-sm btn-outline" style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => handleStatusChange(inv.id, 'pendiente')}>Reabrir</button>
                      )}
                      {inv.status !== 'cancelada' && inv.status !== 'pagada' && (
                        <button className="btn btn-sm btn-danger" style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => handleStatusChange(inv.id, 'cancelada')}>Cancelar</button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-500)' }}>
                  No hay facturas registradas
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 480, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>Nueva Factura</h3>
              <button className="btn btn-sm btn-outline" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Cliente *</label>
                  <select required value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value, site_id: '' })}
                    style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }}>
                    <option value="">Seleccionar...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Sitio</label>
                  <select value={form.site_id} onChange={e => setForm({ ...form, site_id: e.target.value })}
                    style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }}>
                    <option value="">N/A</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Número/Folio *</label>
                  <input required value={form.number} onChange={e => setForm({ ...form, number: e.target.value })}
                    style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Estado</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }}>
                    <option value="pendiente">Pendiente</option>
                    <option value="pagada">Pagada</option>
                    <option value="vencida">Vencida</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Monto *</label>
                  <input required type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value, total: e.target.value })}
                    style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>IVA</label>
                  <input type="number" step="0.01" value={form.tax} onChange={e => setForm({ ...form, tax: e.target.value })}
                    style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Total</label>
                  <input required type="number" step="0.01" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })}
                    style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Método de pago</label>
                  <input value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} placeholder="Ej: Transferencia"
                    style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Fecha emisión</label>
                  <input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })}
                    style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Fecha vencimiento</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                    style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }} />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>Notas</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  style={{ width: '100%', padding: 7, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13, resize: 'vertical' }} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>Crear Factura</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}