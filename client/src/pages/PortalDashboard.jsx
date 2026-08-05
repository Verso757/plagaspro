import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { Building2, MapPin, AlertTriangle, CheckCircle, TrendingUp, FileText } from 'lucide-react';

export default function PortalDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/portal/stats').then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!stats) return <div className="alert alert-error">Error al cargar portal</div>;

  if (stats.clients_count === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Building2 size={64} style={{ color: 'var(--gray-400)', marginBottom: 16 }} />
        <h3>Bienvenido al Portal de Clientes</h3>
        <p style={{ color: 'var(--gray-600)' }}>No tienes sitios asignados todavía. Contacta a tu proveedor de servicios.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Panel de Control</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Building2 size={24} /></div>
          <div><div className="stat-value">{stats.sites_count}</div><div className="stat-label">Sitios activos</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={24} /></div>
          <div><div className="stat-value">{stats.traps_active}</div><div className="stat-label">Trampas activas</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={24} /></div>
          <div><div className="stat-value">{stats.open_incidents}</div><div className="stat-label">Incidencias urgentes</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><TrendingUp size={24} /></div>
          <div><div className="stat-value">{stats.recent_visits}</div><div className="stat-label">Visitas (30 días)</div></div>
        </div>
      </div>

      {/* Sites list */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header"><h3>Mis Sitios</h3></div>
        {stats.sites?.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Sitio</th><th>Dirección</th><th>Frecuencia</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {stats.sites.map(site => (
                  <tr key={site.id}>
                    <td><Link to={`/portal/sites/${site.id}`} style={{ fontWeight: 600 }}>{site.name}</Link></td>
                    <td>{site.address || 'N/A'}</td>
                    <td><span className="badge badge-green">{site.service_frequency || 'N/A'}</span></td>
                    <td>
                      <Link to={`/portal/sites/${site.id}`} className="btn btn-outline btn-sm">Ver detalle</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--gray-500)', padding: 40, textAlign: 'center' }}>No hay sitios registrados</p>
        )}
      </div>

      {/* Recent events */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3>Eventos Recientes</h3></div>
        {stats.recent_events?.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Sitio</th><th>Tipo</th><th>Severidad</th><th>Técnico</th><th>Trampa</th></tr>
              </thead>
              <tbody>
                {stats.recent_events.map(event => (
                  <tr key={event.id}>
                    <td>{new Date(event.created_at).toLocaleDateString('es-MX')}</td>
                    <td>{event.site_name}</td>
                    <td>{event.event_type_name || 'General'}</td>
                    <td>
                      <span className={`badge badge-${
                        event.severity === 'urgente' || event.severity === 'alto' ? 'red' :
                        event.severity === 'medio' ? 'yellow' : 'green'}`}>
                        {event.severity}
                      </span>
                    </td>
                    <td>{event.technician_name}</td>
                    <td>{event.trap_code || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--gray-500)', padding: 40, textAlign: 'center' }}>No hay eventos recientes</p>
        )}
      </div>
    </div>
  );
}