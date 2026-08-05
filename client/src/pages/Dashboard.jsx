import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { Building2, AlertTriangle, MapPin, FileText, CheckCircle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0d904f', '#f9ab00', '#d93025', '#1a73e8'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats').then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!stats) return <div className="alert alert-error">Error al cargar dashboard</div>;

  const severityData = stats.events_by_severity?.map(e => ({
    name: e.severity.charAt(0).toUpperCase() + e.severity.slice(1),
    value: e.count
  })) || [];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, letterSpacing: -0.5 }}>Panel de Control</h2>
        <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Resumen general de tu operación de control de plagas</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Building2 size={24} /></div>
          <div>
            <div className="stat-value">{stats.clients_count}</div>
            <div className="stat-label">Clientes activos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><MapPin size={24} /></div>
          <div>
            <div className="stat-value">{stats.sites_count}</div>
            <div className="stat-label">Sitios activos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={24} /></div>
          <div>
            <div className="stat-value">{stats.traps_with_issues}</div>
            <div className="stat-label">Trampas con problemas</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><TrendingUp size={24} /></div>
          <div>
            <div className="stat-value">{stats.open_incidents}</div>
            <div className="stat-label">Incidencias urgentes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><CheckCircle size={24} /></div>
          <div>
            <div className="stat-value">{stats.recent_visits}</div>
            <div className="stat-label">Visitas (30 días)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><FileText size={24} /></div>
          <div>
            <div className="stat-value">{stats.pending_quotations}</div>
            <div className="stat-label">Cotizaciones pendientes</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 8 }}>
        <div className="card">
          <div className="card-header"><h3>Eventos por severidad</h3></div>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={severityData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {severityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--gray-500)', padding: 40, textAlign: 'center' }}>No hay eventos registrados</p>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h3>Sitios con más incidencias</h3></div>
          {stats.top_sites?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Sitio</th><th>Cliente</th><th>Incidencias</th></tr>
                </thead>
                <tbody>
                  {stats.top_sites.map(site => (
                    <tr key={site.id}>
                      <td><Link to={`/sites/${site.id}`}>{site.name}</Link></td>
                      <td>{site.client_name}</td>
                      <td><span className="badge badge-red">{site.incidents_count}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--gray-500)', padding: 40, textAlign: 'center' }}>No hay datos</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3>Eventos recientes</h3>
        </div>
        {stats.recent_events?.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Cliente</th><th>Sitio</th><th>Tipo</th><th>Severidad</th><th>Técnico</th></tr>
              </thead>
              <tbody>
                {stats.recent_events.map(event => (
                  <tr key={event.id}>
                    <td>{new Date(event.created_at).toLocaleDateString('es-MX')}</td>
                    <td>{event.client_name}</td>
                    <td>{event.site_name}</td>
                    <td>{event.event_type_name}</td>
                    <td><span className={`badge badge-${event.severity === 'urgente' || event.severity === 'alto' ? 'red' : event.severity === 'medio' ? 'yellow' : 'green'}`}>{event.severity}</span></td>
                    <td>{event.technician_name}</td>
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