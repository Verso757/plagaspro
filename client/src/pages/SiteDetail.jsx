import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Plus, ClipboardList, PenLine, Clock } from 'lucide-react';

export default function SiteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  useEffect(() => {
    Promise.all([api.get(`/sites/${id}`), api.get(`/events/visits?site_id=${id}`)])
      .then(([s, v]) => { setSite(s.data); setVisits(v.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const handleNewVisit = async () => {
    try {
      await api.post('/events/visits', { site_id: id, status: 'in_progress' });
      const res = await api.get(`/events/visits?site_id=${id}`);
      setVisits(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al crear visita');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!site) return <div className="alert alert-error">Sitio no encontrado</div>;

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/sites')} style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Volver a sitios
      </button>

      <div className="card">
        <div className="card-header">
          <div>
            <h2>{site.name}</h2>
            <p style={{ color: 'var(--gray-600)' }}>Cliente: <Link to={`/clients/${site.client_id}`}>{site.client_name}</Link></p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-success" onClick={handleNewVisit}><ClipboardList size={16} /> Registrar visita</button>
            {isAdmin && <Link to={`/sites/${id}/sketch/new`} className="btn btn-primary"><PenLine size={16} /> Nuevo croquis</Link>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><strong>Dirección:</strong> {site.address || '-'}</div>
          <div><strong>Frecuencia:</strong> {site.service_frequency || '-'}</div>
          <div><strong>Técnicos:</strong> {site.technicians?.map(t => t.full_name).join(', ') || 'Sin asignar'}</div>
        </div>
      </div>

      {/* Sketches */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3>Croquis ({site.sketches?.length || 0})</h3>
        </div>
        {site.sketches?.length > 0 ? (
          <div className="table-container">
            <table>
              <thead><tr><th>Nombre</th><th>Versión</th><th>Creado por</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {site.sketches.map(sk => (
                  <tr key={sk.id}>
                    <td><strong>{sk.name}</strong></td>
                    <td>v{sk.version}</td>
                    <td>{sk.created_by_name}</td>
                    <td>{new Date(sk.created_at).toLocaleDateString('es-MX')}</td>
                    <td><Link to={`/sites/${id}/sketch/${sk.id}`} className="btn btn-sm btn-outline"><PenLine size={14} /> Editar</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ padding: 24, color: 'var(--gray-500)', textAlign: 'center' }}>
            No hay croquis.{' '}
            <Link to={`/sites/${id}/sketch/new`}>Crear primer croquis</Link>
          </p>
        )}
      </div>

      {/* Visits history */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3>Historial de visitas ({visits.length})</h3></div>
        {visits.length > 0 ? (
          <div className="table-container">
            <table>
              <thead><tr><th>Fecha</th><th>Técnico</th><th>Estado</th><th>Notas</th><th></th></tr></thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id}>
                    <td>{new Date(v.visit_date).toLocaleString('es-MX')}</td>
                    <td>{v.technician_name}</td>
                    <td><span className={`badge badge-${v.status === 'completed' ? 'green' : v.status === 'in_progress' ? 'yellow' : 'gray'}`}>{v.status}</span></td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes || '-'}</td>
                    <td><Link to={`/events/${v.id}`} className="btn btn-sm btn-outline">Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ padding: 24, color: 'var(--gray-500)', textAlign: 'center' }}>No hay visitas registradas</p>
        )}
      </div>
    </div>
  );
}