import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { Building2, MapPin, Calendar } from 'lucide-react';

export default function PortalSitesList() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/portal/stats').then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Mis Sitios</h2>
      {stats?.sites?.length > 0 ? (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Dirección</th><th>Frecuencia</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {stats.sites.map(site => (
                <tr key={site.id}>
                  <td>
                    <Link to={`/portal/sites/${site.id}`} style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={16} /> {site.name}
                    </Link>
                  </td>
                  <td>{site.address || 'N/A'}</td>
                  <td><span className="badge badge-blue">{site.service_frequency || 'No definida'}</span></td>
                  <td>
                    <Link to={`/portal/sites/${site.id}`} className="btn btn-outline btn-sm">Ver detalle</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Building2 size={48} style={{ color: 'var(--gray-400)', marginBottom: 12 }} />
          <p style={{ color: 'var(--gray-600)' }}>No tienes sitios asignados todavía.</p>
        </div>
      )}
    </div>
  );
}