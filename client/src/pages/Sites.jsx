import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, MapPin, Search } from 'lucide-react';

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [clients, setClients] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [form, setForm] = useState({ client_id: '', name: '', address: '', service_frequency: '', notes: '', technician_ids: [] });
  const { isAdmin } = useAuth();

  const loadData = () => {
    Promise.all([api.get('/sites'), api.get('/clients'), api.get('/users/technicians')])
      .then(([s, c, t]) => { setSites(s.data); setClients(c.data); setTechnicians(t.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const openNew = () => { setEditingSite(null); setForm({ client_id: '', name: '', address: '', service_frequency: '', notes: '', technician_ids: [] }); setShowModal(true); };
  const openEdit = (s) => { setEditingSite(s); setForm({ ...s, technician_ids: [] }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSite) {
        await api.put(`/sites/${editingSite.id}`, form);
      } else {
        await api.post('/sites', form);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar');
    }
  };

  const handleToggleTech = (techId) => {
    setForm(prev => ({
      ...prev,
      technician_ids: prev.technician_ids.includes(techId)
        ? prev.technician_ids.filter(id => id !== techId)
        : [...prev.technician_ids, techId]
    }));
  };

  const filtered = sites.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.client_name?.toLowerCase().includes(search.toLowerCase()));
  const frequencies = ['semanal', 'quincenal', 'mensual', 'bimestral', 'trimestral', 'unico'];

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card-header">
        <h2>Sitios ({sites.length})</h2>
        {isAdmin && <button className="btn btn-primary" onClick={openNew}><Plus size={18} /> Nuevo sitio</button>}
      </div>

      <div className="search-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={18} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--gray-400)' }} />
          <input placeholder="Buscar sitio..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Sitio</th><th>Cliente</th><th>Dirección</th><th>Frecuencia</th><th>Técnicos</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td><Link to={`/sites/${s.id}`}><strong>{s.name}</strong></Link></td>
                  <td>{s.client_name}</td>
                  <td>{s.address || '-'}</td>
                  <td><span className="badge badge-blue">{s.service_frequency || '-'}</span></td>
                  <td>{s.technicians || 'Sin asignar'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to={`/sites/${s.id}`} className="btn btn-sm btn-outline"><MapPin size={14} /> Ver</Link>
                      {isAdmin && <button className="btn btn-sm btn-outline" onClick={() => openEdit(s)}><Pencil size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>No se encontraron sitios</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingSite ? 'Editar sitio' : 'Nuevo sitio'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Cliente *</label><select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} required>
                <option value="">Seleccionar cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
              <div className="form-row">
                <div className="form-group"><label>Nombre del sitio *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="form-group"><label>Frecuencia de servicio</label><select value={form.service_frequency} onChange={e => setForm({ ...form, service_frequency: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {frequencies.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select></div>
              </div>
              <div className="form-group"><label>Dirección</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="form-group"><label>Notas</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <div className="form-group">
                <label>Técnicos asignados</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {technicians.map(t => (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: `1px solid ${form.technician_ids.includes(t.id) ? 'var(--primary)' : 'var(--gray-300)'}`, cursor: 'pointer', background: form.technician_ids.includes(t.id) ? 'var(--primary-light)' : 'white' }}>
                      <input type="checkbox" checked={form.technician_ids.includes(t.id)} onChange={() => handleToggleTech(t.id)} style={{ display: 'none' }} />
                      {t.full_name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingSite ? 'Guardar cambios' : 'Crear sitio'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}