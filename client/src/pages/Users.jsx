import { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'tecnico', phone: '' });

  const loadUsers = () => {
    api.get('/users').then(res => { setUsers(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const openNew = () => { setEditingUser(null); setForm({ email: '', password: '', full_name: '', role: 'tecnico', phone: '' }); setShowModal(true); };
  const openEdit = (u) => { setEditingUser(u); setForm({ email: u.email, password: '', full_name: u.full_name, role: u.role, phone: u.phone || '' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form };
      if (!data.password) delete data.password;
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, data);
      } else {
        await api.post('/users', data);
      }
      setShowModal(false);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este usuario?')) return;
    await api.delete(`/users/${id}`);
    loadUsers();
  };

  const filtered = users.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card-header">
        <h2>Usuarios ({users.length})</h2>
        <button className="btn btn-primary" onClick={openNew}><Plus size={18} /> Nuevo usuario</button>
      </div>

      <div className="search-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={18} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--gray-400)' }} />
          <input placeholder="Buscar usuario..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Teléfono</th><th>Activo</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.full_name}</strong></td>
                  <td>{u.email}</td>
                  <td><span className={`badge badge-${u.role === 'admin' ? 'red' : 'blue'}`}>{u.role}</span></td>
                  <td>{u.phone || '-'}</td>
                  <td><span className={`badge badge-${u.active ? 'green' : 'gray'}`}>{u.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(u)}><Pencil size={14} /></button>
                      {u.active && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.id)}><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingUser ? 'Editar usuario' : 'Nuevo usuario'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Nombre completo *</label><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required /></div>
                <div className="form-group"><label>Teléfono</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
              <div className="form-row">
                <div className="form-group"><label>Contraseña {editingUser ? '(dejar vacío para mantener)' : '*'}</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editingUser} /></div>
                <div className="form-group"><label>Rol *</label><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} required>
                  <option value="tecnico">Técnico</option>
                  <option value="admin">Administrador</option>
                  <option value="cliente">Cliente</option>
                </select></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingUser ? 'Guardar cambios' : 'Crear usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}