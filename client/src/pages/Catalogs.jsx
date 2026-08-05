import { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function Catalogs() {
  const [catalogs, setCatalogs] = useState({ trap_types: [], plagues: [], event_types: [], services: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('trap_types');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const loadCatalogs = () => {
    api.get('/catalogs/all').then(res => { setCatalogs(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { loadCatalogs(); }, []);

  const endpoints = {
    trap_types: '/catalogs/trap-types',
    plagues: '/catalogs/plagues',
    event_types: '/catalogs/event-types',
    services: '/catalogs/services'
  };

  const tabLabels = {
    trap_types: 'Tipos de Trampa',
    plagues: 'Plagas',
    event_types: 'Tipos de Evento',
    services: 'Servicios (Cotizaciones)'
  };

  const openNew = () => { setEditingItem(null); setForm({ name: '', description: '', icon: '', default_price: '' }); setShowModal(true); };
  const openEdit = (item) => { setEditingItem(item); setForm({ name: item.name, description: item.description || '', icon: item.icon || '', default_price: item.default_price || '', unit: item.unit || '' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = endpoints[tab];
      if (editingItem) {
        await api.put(`${endpoint}/${editingItem.id}`, form);
      } else {
        await api.post(endpoint, form);
      }
      setShowModal(false);
      loadCatalogs();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este elemento?')) return;
    const endpoint = endpoints[tab];
    await api.delete(`${endpoint}/${id}`);
    loadCatalogs();
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const items = catalogs[tab] || [];

  return (
    <div>
      <div className="card-header">
        <h2>Catálogos</h2>
        <button className="btn btn-primary" onClick={openNew}><Plus size={18} /> Nuevo elemento</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-200)' }}>
        {Object.entries(tabLabels).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              color: tab === key ? 'var(--primary)' : 'var(--gray-600)',
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              fontWeight: tab === key ? 600 : 400, fontSize: 14, marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                {tab === 'trap_types' && <th>Icono</th>}
                {tab === 'services' && <th>Precio</th>}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td><strong>{tab === 'trap_types' ? `${item.icon || '📍'} ${item.name}` : item.name}</strong></td>
                  <td>{item.description || '-'}</td>
                  {tab === 'trap_types' && <td>{item.icon || '-'}</td>}
                  {tab === 'services' && <td><strong>${item.default_price?.toFixed(2)}</strong> / {item.unit || 'servicio'}</td>}
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(item)}><Pencil size={14} /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={tab === 'services' ? 4 : 3} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>No hay elementos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingItem ? 'Editar elemento' : 'Nuevo elemento'} - {tabLabels[tab]}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              {tab === 'trap_types' && (
                <div className="form-row">
                  <div className="form-group"><label>Icono (emoji)</label><input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="🐀" /></div>
                </div>
              )}
              <div className="form-group"><label>Descripción</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              {tab === 'services' && (
                <div className="form-row">
                  <div className="form-group"><label>Precio por defecto</label><input type="number" value={form.default_price} onChange={e => setForm({ ...form, default_price: e.target.value })} step="0.01" /></div>
                  <div className="form-group"><label>Unidad</label><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="mensual" /></div>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingItem ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}