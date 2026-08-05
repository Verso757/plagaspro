import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, FileText, CheckCircle, AlertTriangle, Download, Target, ClipboardList } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PortalSiteDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/portal/sites/${id}`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
    api.get(`/portal/sites/${id}/monthly-events`)
      .then(res => setMonthlyData(res.data || []))
      .catch(() => {});
  }, [id]);

  const handleDownloadCert = (visitId) => {
    window.open(`/api/documents/certificate/${visitId}`, '_blank');
  };

  const handleDownloadReport = () => {
    window.open(`/api/documents/report/${id}`, '_blank');
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!data) return <div className="alert alert-error">Error al cargar sitio</div>;

  const { site, traps, visits, events, sketches } = data;

  const chartData = monthlyData.map(m => ({
    name: m.month,
    Eventos: m.count,
    'Alta severidad': m.high_severity
  }));

  return (
    <div>
      <Link to="/portal" className="btn btn-outline btn-sm" style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Volver al dashboard
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{site.name}</h2>
          <p style={{ color: 'var(--gray-600)' }}>{site.address || 'Sin dirección'}</p>
          <span className="badge badge-green">{site.service_frequency || 'Sin frecuencia definida'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleDownloadReport}>
            <Download size={14} /> Descargar Informe
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon green"><Target size={20} /></div>
          <div><div className="stat-value">{traps?.length || 0}</div><div className="stat-label">Trampas</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><ClipboardList size={20} /></div>
          <div><div className="stat-value">{visits?.length || 0}</div><div className="stat-label">Visitas</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={20} /></div>
          <div><div className="stat-value">{events?.filter(e => e.severity === 'alto' || e.severity === 'urgente').length || 0}</div><div className="stat-label">Alertas</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><FileText size={20} /></div>
          <div><div className="stat-value">{sketches?.length || 0}</div><div className="stat-label">Croquis</div></div>
        </div>
      </div>

      {/* Monthly chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>Tendencia Mensual de Eventos</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="Eventos" fill="#1a73e8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Alta severidad" fill="#d93025" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Traps */}
        <div className="card">
          <div className="card-header"><h3>Trampas ({traps?.length || 0})</h3></div>
          <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Código</th><th>Tipo</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {traps?.length > 0 ? traps.map(trap => (
                  <tr key={trap.id}>
                    <td><strong>{trap.code}</strong></td>
                    <td>{trap.trap_type_name || 'Sin tipo'} {trap.trap_type_icon || ''}</td>
                    <td>
                      <span className={`badge badge-${trap.status === 'activa' ? 'green' : trap.status === 'dañada' ? 'red' : 'yellow'}`}>
                        {trap.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin trampas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visits */}
        <div className="card">
          <div className="card-header"><h3>Últimas Visitas</h3></div>
          <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Fecha</th><th>Técnico</th><th>Estado</th><th>Cert.</th></tr>
              </thead>
              <tbody>
                {visits?.length > 0 ? visits.slice(0, 10).map(visit => (
                  <tr key={visit.id}>
                    <td>{new Date(visit.visit_date).toLocaleDateString('es-MX')}</td>
                    <td>{visit.technician_name}</td>
                    <td>
                      <span className={`badge badge-${visit.status === 'completed' ? 'green' : visit.status === 'planned' ? 'blue' : 'yellow'}`}>
                        {visit.status === 'completed' ? 'Completada' : visit.status === 'planned' ? 'Planeada' : 'En progreso'}
                      </span>
                    </td>
                    <td>
                      {visit.status === 'completed' && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleDownloadCert(visit.id)} title="Descargar certificado">
                          <FileText size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Sin visitas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="card">
        <div className="card-header"><h3>Eventos Recientes ({events?.length || 0})</h3></div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Trampa</th><th>Tipo</th><th>Plaga</th><th>Severidad</th><th>Descripción</th><th>Técnico</th></tr>
            </thead>
            <tbody>
              {events?.length > 0 ? events.slice(0, 20).map(event => (
                <tr key={event.id}>
                  <td>{new Date(event.created_at).toLocaleDateString('es-MX')}</td>
                  <td>{event.trap_code || 'N/A'}</td>
                  <td>{event.event_type_name || 'General'}</td>
                  <td>{event.plague_name || 'N/A'}</td>
                  <td>
                    <span className={`badge badge-${event.severity === 'urgente' || event.severity === 'alto' ? 'red' : event.severity === 'medio' ? 'yellow' : 'green'}`}>
                      {event.severity}
                    </span>
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.description || '-'}
                  </td>
                  <td>{event.technician_name}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--gray-500)' }}>No hay eventos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}