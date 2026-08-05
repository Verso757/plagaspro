import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', business_type: '', notes: '' });
  const { isAdmin } = useAuth();

  const loadClients = () => {
    api.get('/clients').then(res => { setClients(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { loadClients(); }, []);

  const openNew = () => { setEditingClient(null); setForm({ name: '', contact_person: '', phone: '', email: '', address: '', business_type: '', notes: '' }); setShowModal(true); };
  const openEdit = (c) => { setEditingClient(c); setForm({ ...c }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, form);
      } else {
        await api.post('/clients', form);
      }
      setShowModal(false);
      loadClients();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este cliente?')) return;
    await api.delete(`/clients/${id}`);
    loadClients();
  };

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.contact_person?.toLowerCase().includes(search.toLowerCase()));

  const businessTypes = ['residencial', 'restaurante', 'bodega', 'industria', 'comercio', 'oficina', 'otro'];

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card-header">
        <h2>Clientes ({clients.length})</h2>
        {isAdmin && <button className="btn btn-primary" onClick={openNew}><Plus size={18} /> Nuevo cliente</button>}
      </div>

      <div className="search-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={18} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--gray-400)' }} />
          <input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th>Tipo</th><th>Sitios</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td><Link to={`/clients/${c.id}`}><strong>{c.name}</strong></Link></td>
                  <td>{c.contact_person || '-'}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td><span className="badge badge-blue">{c.business_type || '-'}</span></td>
                  <td>{c.sites_count || 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {isAdmin && <button className="btn btn-sm btn-outline" onClick={() => openEdit(c)}><Pencil size={14} /></button>}
                      {isAdmin && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>No se encontraron clientes</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h3>{editingClient ? 'Editar cliente' : 'Nuevo cliente'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="form-group"><label>Persona de contacto</label><input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Teléfono</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Dirección</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="form-row">
                <div className="form-group"><label>Tipo de negocio</label><select value={form.business_type} onChange={e => setForm({ ...form, business_type: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {businessTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select></div>
                <div className="form-group"><label>Notas</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingClient ? 'Guardar cambios' : 'Crear cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}