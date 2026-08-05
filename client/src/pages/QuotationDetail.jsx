import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft } from 'lucide-react';

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  useEffect(() => {
    api.get(`/quotations/${id}`).then(res => { setQuotation(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status) => {
    try {
      await api.put(`/quotations/${id}`, { status });
      const res = await api.get(`/quotations/${id}`);
      setQuotation(res.data);
    } catch (err) {
      alert('Error al actualizar estado');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!quotation) return <div className="alert alert-error">Cotización no encontrada</div>;

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/quotations')} style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Volver a cotizaciones
      </button>

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Cotización #{quotation.id}</h2>
            <span className={`badge badge-${quotation.status === 'aceptada' ? 'green' : quotation.status === 'rechazada' ? 'red' : quotation.status === 'enviada' ? 'blue' : 'yellow'}`} style={{ fontSize: 13 }}>
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {isAdmin && quotation.status === 'borrador' && <button className="btn btn-sm btn-success" onClick={() => updateStatus('enviada')}>Marcar como enviada</button>}
            {isAdmin && quotation.status === 'enviada' && <button className="btn btn-sm btn-success" onClick={() => updateStatus('aceptada')}>Marcar como aceptada</button>}
            {isAdmin && (quotation.status === 'enviada' || quotation.status === 'borrador') && <button className="btn btn-sm btn-danger" onClick={() => updateStatus('rechazada')}>Rechazar</button>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><strong>Cliente:</strong> {quotation.client_name}</div>
          <div><strong>Sitio:</strong> {quotation.site_name || 'General'}</div>
          <div><strong>Creado por:</strong> {quotation.created_by_name}</div>
          <div><strong>Fecha:</strong> {new Date(quotation.created_at).toLocaleDateString('es-MX')}</div>
          {quotation.valid_until && <div><strong>Válido hasta:</strong> {new Date(quotation.valid_until).toLocaleDateString('es-MX')}</div>}
        </div>
        {quotation.notes && <div style={{ marginTop: 12 }}><strong>Notas:</strong> {quotation.notes}</div>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Conceptos</h3>
        {quotation.items?.length > 0 ? (
          <div className="table-container">
            <table>
              <thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio Unitario</th><th>Total</th></tr></thead>
              <tbody>
                {quotation.items.map(item => (
                  <tr key={item.id}>
                    <td>{item.service_name || item.description || 'Concepto sin nombre'}</td>
                    <td>{item.quantity}</td>
                    <td>${item.unit_price?.toFixed(2)}</td>
                    <td><strong>${item.total?.toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--gray-50)', fontWeight: 700 }}>
                  <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL</td>
                  <td style={{ fontSize: 18 }}>${quotation.total?.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p style={{ padding: 24, color: 'var(--gray-500)', textAlign: 'center' }}>Sin conceptos</p>
        )}
      </div>

      {/* Client info for reference */}
      <div className="card" style={{ marginTop: 16, background: 'var(--gray-50)' }}>
        <h4 style={{ marginBottom: 8 }}>Datos del cliente</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
          <div><strong>Cliente:</strong> {quotation.client_name}</div>
          <div><strong>Dirección:</strong> {quotation.client_address || '-'}</div>
          <div><strong>Teléfono:</strong> {quotation.client_phone || '-'}</div>
          <div><strong>Email:</strong> {quotation.client_email || '-'}</div>
        </div>
      </div>
    </div>
  );
}