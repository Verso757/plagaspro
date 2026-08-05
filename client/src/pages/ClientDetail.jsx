import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Building2, Plus, Pencil } from 'lucide-react';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  useEffect(() => {
    api.get(`/clients/${id}`).then(res => { setClient(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!client) return <div className="alert alert-error">Cliente no encontrado</div>;

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/clients')} style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Volver a clientes
      </button>

      <div className="card">
        <div className="card-header">
          <div>
            <h2>{client.name}</h2>
            <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>{client.business_type && client.business_type.charAt(0).toUpperCase() + client.business_type.slice(1)}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><strong>Contacto:</strong> {client.contact_person || '-'}</div>
          <div><strong>Teléfono:</strong> {client.phone || '-'}</div>
          <div><strong>Email:</strong> {client.email || '-'}</div>
          <div><strong>Dirección:</strong> {client.address || '-'}</div>
        </div>
        {client.notes && <div style={{ marginTop: 12 }}><strong>Notas:</strong> {client.notes}</div>}
      </div>

      <div className="card-header" style={{ marginTop: 8 }}>
        <h3>Sitios ({client.sites?.length || 0})</h3>
        {isAdmin && <Link to="/sites" className="btn btn-primary btn-sm"><Plus size={16} /> Gestionar sitios</Link>}
      </div>

      <div className="card">
        {client.sites?.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Dirección</th><th>Frecuencia</th><th>Técnicos</th><th>Croquis</th><th></th></tr>
              </thead>
              <tbody>
                {client.sites.map(site => (
                  <tr key={site.id}>
                    <td><strong>{site.name}</strong></td>
                    <td>{site.address || '-'}</td>
                    <td>{site.service_frequency || '-'}</td>
                    <td>{site.technicians || 'Sin asignar'}</td>
                    <td>
                      {isAdmin && (
                        <Link to={`/sites/${site.id}/sketch/new`} className="btn btn-sm btn-primary"><Plus size={14} /> Nuevo croquis</Link>
                      )}
                    </td>
                    <td><Link to={`/sites/${site.id}`} className="btn btn-sm btn-outline">Ver sitio</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ padding: 24, color: 'var(--gray-500)', textAlign: 'center' }}>
            No hay sitios registrados.{' '}
            {isAdmin && <Link to="/sites">Agregar sitio</Link>}
          </p>
        )}
      </div>
    </div>
  );
}