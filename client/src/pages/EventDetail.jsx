import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Plus, Camera, Upload } from 'lucide-react';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [visit, setVisit] = useState(null);
  const [catalogs, setCatalogs] = useState({ event_types: [], plagues: [], trap_types: [] });
  const [loading, setLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ trap_point_id: '', event_type_id: '', plague_id: '', severity: 'bajo', description: '', actions_taken: '' });
  const [traps, setTraps] = useState([]);
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get(`/events/visits/${id}`),
      api.get('/catalogs/all')
    ]).then(([v, c]) => {
      setVisit(v.data);
      setCatalogs(c.data);
      setLoading(false);
      // Load traps if site has sketches
      if (v.data.site_id) {
        api.get(`/sketches?site_id=${v.data.site_id}`).then(res => {
          if (res.data.length > 0) {
            api.get(`/traps?sketch_id=${res.data[0].id}`).then(tr => setTraps(tr.data)).catch(() => {});
          }
        }).catch(() => {});
      }
    }).catch(() => setLoading(false));
  }, [id]);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      await api.post('/events', { ...eventForm, visit_id: parseInt(id) });
      setShowEventForm(false);
      setEventForm({ trap_point_id: '', event_type_id: '', plague_id: '', severity: 'bajo', description: '', actions_taken: '' });
      const res = await api.get(`/events/visits/${id}`);
      setVisit(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al crear evento');
    }
  };

  const handlePhotoUpload = async (eventId, files) => {
    if (!files?.length) return;
    setUploading(true);
    const formData = new FormData();
    for (const file of files) formData.append('photos', file);
    try {
      await api.post(`/events/${eventId}/photos`, formData);
      const res = await api.get(`/events/visits/${id}`);
      setVisit(res.data);
    } catch (err) {
      alert('Error al subir fotos');
    }
    setUploading(false);
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!visit) return <div className="alert alert-error">Visita no encontrada</div>;

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/events')} style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Volver a eventos
      </button>

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Visita - {visit.site_name}</h2>
            <p style={{ color: 'var(--gray-600)' }}>Cliente: {visit.client_name} | Técnico: {visit.technician_name}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className={`badge badge-${visit.status === 'completed' ? 'green' : 'yellow'}`}>{visit.status}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowEventForm(true)}><Plus size={16} /> Registrar evento</button>
          </div>
        </div>
        <div><strong>Fecha:</strong> {new Date(visit.visit_date).toLocaleString('es-MX')}</div>
        {visit.notes && <div style={{ marginTop: 8 }}><strong>Notas:</strong> {visit.notes}</div>}
      </div>

      <div className="card-header" style={{ marginTop: 16 }}>
        <h3>Eventos registrados ({visit.events?.length || 0})</h3>
      </div>

      {visit.events?.length > 0 ? (
        visit.events.map(event => (
          <div key={event.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <span className="badge badge-blue" style={{ marginRight: 8 }}>{event.event_type_name || 'Sin tipo'}</span>
                <span className={`badge badge-${event.severity === 'urgente' || event.severity === 'alto' ? 'red' : event.severity === 'medio' ? 'yellow' : 'green'}`}>{event.severity}</span>
                {event.trap_code && <span className="badge badge-gray" style={{ marginLeft: 8 }}>Trampa {event.trap_code}</span>}
                {event.plague_name && <span className="badge badge-yellow" style={{ marginLeft: 8 }}>{event.plague_name}</span>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{new Date(event.created_at).toLocaleString('es-MX')}</span>
            </div>
            {event.description && <p style={{ marginTop: 8 }}>{event.description}</p>}
            {event.actions_taken && <p style={{ marginTop: 4, fontSize: 13, color: 'var(--gray-600)' }}><strong>Acciones:</strong> {event.actions_taken}</p>}

            {/* Photos */}
            {event.photos?.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {event.photos.map(photo => (
                  <a key={photo.id} href={photo.file_path} target="_blank" rel="noopener noreferrer">
                    <img src={photo.file_path} alt="Evidencia" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--gray-200)' }} />
                  </a>
                ))}
              </div>
            )}

            {/* Upload photos */}
            <div style={{ marginTop: 12 }}>
              <label className="btn btn-sm btn-outline" style={{ cursor: 'pointer' }}>
                <Camera size={14} /> {uploading ? 'Subiendo...' : 'Agregar fotos'}
                <input ref={photoRef} type="file" accept="image/*" multiple onChange={e => handlePhotoUpload(event.id, e.target.files)} style={{ display: 'none' }} disabled={uploading} />
              </label>
            </div>
          </div>
        ))
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--gray-500)' }}>
          No hay eventos registrados para esta visita
        </div>
      )}

      {/* New event modal */}
      {showEventForm && (
        <div className="modal-overlay" onClick={() => setShowEventForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Registrar nuevo evento</h3>
            <form onSubmit={handleCreateEvent}>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo de evento</label>
                  <select value={eventForm.event_type_id} onChange={e => setEventForm({ ...eventForm, event_type_id: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {catalogs.event_types?.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Severidad</label>
                  <select value={eventForm.severity} onChange={e => setEventForm({ ...eventForm, severity: e.target.value })}>
                    <option value="bajo">Bajo</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Trampa asociada (opcional)</label>
                  <select value={eventForm.trap_point_id} onChange={e => setEventForm({ ...eventForm, trap_point_id: e.target.value })}>
                    <option value="">Ninguna</option>
                    {traps.map(t => <option key={t.id} value={t.id}>{t.code} - {t.trap_type_name || 'Sin tipo'}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Plaga detectada</label>
                  <select value={eventForm.plague_id} onChange={e => setEventForm({ ...eventForm, plague_id: e.target.value })}>
                    <option value="">Ninguna</option>
                    {catalogs.plagues?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group"><label>Descripción</label><textarea value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} rows={3} /></div>
              <div className="form-group"><label>Acciones tomadas</label><textarea value={eventForm.actions_taken} onChange={e => setEventForm({ ...eventForm, actions_taken: e.target.value })} rows={2} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowEventForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar evento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}