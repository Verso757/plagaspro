import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { Search, Filter } from 'lucide-react';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ severity: '', site_id: '' });
  const [sites, setSites] = useState([]);

  useEffect(() => {
    api.get('/sites').then(res => setSites(res.data)).catch(() => {});
    loadEvents();
  }, []);

  const loadEvents = (extra = {}) => {
    const params = { ...filters, ...extra };
    api.get('/events', { params }).then(res => { setEvents(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  const filtered = events.filter(e => {
    const s = search.toLowerCase();
    return (e.client_name?.toLowerCase().includes(s) || e.site_name?.toLowerCase().includes(s) ||
            e.event_type_name?.toLowerCase().includes(s) || e.technician_name?.toLowerCase().includes(s) ||
            e.trap_code?.toLowerCase().includes(s));
  });

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card-header"><h2>Eventos e Incidencias ({events.length})</h2></div>

      <div className="search-bar">
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--gray-400)' }} />
          <input placeholder="Buscar eventos..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: 300 }} />
        </div>
        <select value={filters.severity} onChange={e => { setFilters({ ...filters, severity: e.target.value }); loadEvents({ severity: e.target.value }); }}>
          <option value="">Todas las severidades</option>
          <option value="bajo">Bajo</option>
          <option value="medio">Medio</option>
          <option value="alto">Alto</option>
          <option value="urgente">Urgente</option>
        </select>
        <select value={filters.site_id} onChange={e => { setFilters({ ...filters, site_id: e.target.value }); loadEvents({ site_id: e.target.value }); }}>
          <option value="">Todos los sitios</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.client_name} - {s.name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Cliente / Sitio</th><th>Tipo</th><th>Trampa</th><th>Plaga</th><th>Severidad</th><th>Técnico</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td style={{ fontSize: 12 }}>{new Date(e.created_at).toLocaleString('es-MX')}</td>
                  <td><strong>{e.client_name}</strong><br /><span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{e.site_name}</span></td>
                  <td><span className="badge badge-blue">{e.event_type_name || '-'}</span></td>
                  <td>{e.trap_code || '-'}</td>
                  <td>{e.plague_name || '-'}</td>
                  <td><span className={`badge badge-${e.severity === 'urgente' || e.severity === 'alto' ? 'red' : e.severity === 'medio' ? 'yellow' : 'green'}`}>{e.severity}</span></td>
                  <td>{e.technician_name}</td>
                  <td><Link to={`/events/${e.visit_id}`} className="btn btn-sm btn-outline">Ver</Link></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>No se encontraron eventos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}