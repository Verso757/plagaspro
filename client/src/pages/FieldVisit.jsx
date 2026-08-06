import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { MapPin, QrCode, Camera, Save, CheckCircle, Clock, ChevronRight, X, AlertTriangle, Search, Play, Square, FileText, ChevronDown } from 'lucide-react';

export default function FieldVisit() {
  const navigate = useNavigate();
  const [step, setStep] = useState('select'); // select | active | done
  const [mySites, setMySites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [visit, setVisit] = useState(null);
  const [traps, setTraps] = useState([]);
  const [eventQueue, setEventQueue] = useState([]); // events registered this session
  const [trapTypes, setTrapTypes] = useState([]);
  const [plagues, setPlagues] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [currentTrap, setCurrentTrap] = useState(null);
  const [form, setForm] = useState({ event_type_id: '', plague_id: '', severity: 'bajo', description: '', photo: null });
  const [searchQuery, setSearchQuery] = useState('');
  const qrReaderRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/catalogs/trap-types').then(r => setTrapTypes(r.data || [])).catch(() => {});
    api.get('/catalogs/plagues').then(r => setPlagues(r.data || [])).catch(() => {});
    api.get('/catalogs/event-types').then(r => setEventTypes(r.data || [])).catch(() => {});
    loadMySites();
  }, []);

  const loadMySites = async () => {
    try {
      const res = await api.get('/calendar');
      if (res.data?.sites?.length) {
        setMySites(res.data.sites);
      } else {
        const sr = await api.get('/sites');
        setMySites(sr.data || []);
      }
      setLoading(false);
    } catch {
      const sr = await api.get('/sites');
      setMySites(sr.data || []);
      setLoading(false);
    }
  };

  const startVisit = async (site) => {
    setLoading(true);
    try {
      // Get traps for this site
      const sketchesRes = await api.get(`/sketches?site_id=${site.id}`);
      const sketches = sketchesRes.data || [];
      let allTraps = [];
      for (const sketch of sketches) {
        const sRes = await api.get(`/sketches/${sketch.id}`);
        allTraps = [...allTraps, ...(sRes.data?.trap_points || [])];
      }
      setTraps(allTraps);

      // Create or find visit
      const today = new Date().toISOString().split('T')[0];
      let visit = null;
      try {
        const existing = await api.get(`/calendar?month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`);
        const todayVisits = (existing.data?.visits || []).filter(v => v.visit_date?.startsWith(today) && v.site_id === site.id);
        if (todayVisits.length > 0) visit = todayVisits[0];
      } catch {}

      if (!visit) {
        const res = await api.post('/visits', { site_id: site.id, technician_id: 'me', visit_date: new Date().toISOString(), status: 'in_progress', notes: 'Visita en campo' });
        visit = res.data;
      } else if (visit.status === 'planned') {
        await api.put(`/calendar/visit/${visit.id}`, { status: 'in_progress' });
        visit.status = 'in_progress';
      }
      setVisit(visit);
      setSelectedSite(site);
      setStep('active');
    } catch (err) {
      alert('Error al iniciar visita: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = (decodedText) => {
    const trap = traps.find(t => t.qr_code === decodedText || t.code === decodedText);
    if (trap) {
      setCurrentTrap(trap);
      setShowQR(false);
      setForm({ event_type_id: '', plague_id: '', severity: 'bajo', description: '', photo: null });
    } else {
      alert('Trampa no encontrada. Código: ' + decodedText);
    }
  };

  const handleTrapSelect = (trap) => {
    setCurrentTrap(trap);
    setForm({ event_type_id: '', plague_id: '', severity: 'bajo', description: '', photo: null });
  };

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Convert to base64 for preview
    const reader = new FileReader();
    reader.onload = () => setForm(prev => ({ ...prev, photo: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleRegisterEvent = async () => {
    if (!currentTrap || !visit) return;
    try {
      const payload = {
        qr_code: currentTrap.qr_code || currentTrap.code,
        event_type_id: form.event_type_id || null,
        plague_id: form.plague_id || null,
        severity: form.severity,
        description: form.description,
      };
      await api.post('/qr/checkin', payload);
      setEventQueue(prev => [...prev, { trap: currentTrap, ...form, time: new Date() }]);
      setCurrentTrap(null);
      setForm({ event_type_id: '', plague_id: '', severity: 'bajo', description: '', photo: null });
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  const finishVisit = async () => {
    if (!visit) return;
    try {
      await api.put(`/calendar/visit/${visit.id}`, { status: 'completed', notes: `Visita completada. ${eventQueue.length} eventos registrados.` });
      setStep('done');
    } catch (err) {
      alert('Error al finalizar: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredSites = mySites.filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.client_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  const getStatusColor = (status) => status === 'activa' ? '#10b981' : status === 'danada' ? '#ef4444' : '#f59e0b';
  const getStatusIcon = (status) => status === 'activa' ? '✅' : status === 'danada' ? '🔴' : '🟡';

  if (loading && step === 'select') return <div className="loading"><div className="spinner" /></div>;

  // STEP 1: Select site
  if (step === 'select') return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ marginBottom: 20, textAlign: 'center', paddingTop: 8 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🏠 Visita en Campo</h2>
        <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Selecciona el sitio a visitar</p>
      </div>
      <div className="search-bar" style={{ marginBottom: 16 }}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Buscar sitio..." style={{ width: '100%', padding: '14px 16px', fontSize: 16, borderRadius: 10, border: '1.5px solid var(--gray-300)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredSites.length === 0 && <p style={{ textAlign: 'center', color: 'var(--gray-500)', padding: 40 }}>No hay sitios asignados</p>}
        {filteredSites.map(site => (
          <div key={site.id} onClick={() => startVisit(site)}
            style={{ background: '#fff', borderRadius: 12, padding: '18px 16px', boxShadow: 'var(--shadow)', border: '1px solid var(--gray-100)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📍 {site.name}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{site.client_name || 'Sin cliente'} • {site.address || ''}</div>
              <div style={{ marginTop: 6 }}>
                <span className="badge badge-blue" style={{ fontSize: 11 }}>{site.service_frequency || 'Sin frecuencia'}</span>
              </div>
            </div>
            <ChevronRight size={24} style={{ color: 'var(--gray-400)' }} />
          </div>
        ))}
      </div>
    </div>
  );

  // STEP 2: Active visit
  if (step === 'active') return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 8px' }}>
      {/* Header */}
      <div style={{ background: 'var(--primary-gradient)', borderRadius: 14, padding: '18px 16px', marginBottom: 16, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 2 }}>📍 {selectedSite?.client_name}</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedSite?.name}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={12} /> Visita iniciada • {eventQueue.length} eventos
          </div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={finishVisit} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 13, padding: '10px 16px' }}>
          <Square size={14} /> Finalizar
        </button>
      </div>

      {/* QR Scanner button */}
      <button className="btn btn-primary" onClick={() => setShowQR(!showQR)}
        style={{ width: '100%', marginBottom: 16, padding: '16px', fontSize: 16, fontWeight: 700 }}>
        <QrCode size={20} /> {showQR ? 'Cerrar escáner' : 'Escanear código QR'}
      </button>

      {/* QR Reader */}
      {showQR && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <input ref={qrReaderRef} placeholder="O ingresa código manual..."
              style={{ flex: 1, padding: '12px 14px', fontSize: 16, borderRadius: 8, border: '1.5px solid var(--gray-300)' }}
              onKeyDown={e => { if (e.key === 'Enter') { handleQRScan(e.target.value); e.target.value = ''; } }} />
            <button className="btn btn-primary" style={{ fontSize: 14, padding: '10px 16px' }}
              onClick={() => { if (qrReaderRef.current?.value) { handleQRScan(qrReaderRef.current.value); qrReaderRef.current.value = ''; } }}>
              <Search size={16} /> Buscar
            </button>
          </div>
        </div>
      )}

      {/* Current trap form */}
      {currentTrap && (
        <div className="card" style={{ marginBottom: 16, padding: 16, borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{currentTrap.trap_type_icon || '📍'} {currentTrap.code}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{currentTrap.trap_type_name || 'Sin tipo'} • {currentTrap.status}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setCurrentTrap(null)}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={form.event_type_id} onChange={e => setForm({ ...form, event_type_id: e.target.value })}
                style={{ flex: 1, padding: '12px 10px', borderRadius: 8, border: '1.5px solid var(--gray-300)', fontSize: 14 }}>
                <option value="">Tipo de evento</option>
                {eventTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={form.plague_id} onChange={e => setForm({ ...form, plague_id: e.target.value })}
                style={{ flex: 1, padding: '12px 10px', borderRadius: 8, border: '1.5px solid var(--gray-300)', fontSize: 14 }}>
                <option value="">Plaga</option>
                {plagues.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}
              style={{ padding: '12px 10px', borderRadius: 8, border: '1.5px solid var(--gray-300)', fontSize: 14, background: form.severity === 'urgente' ? '#fef2f2' : form.severity === 'alto' ? '#fffbeb' : '#fff' }}>
              <option value="bajo">🟢 Bajo</option>
              <option value="medio">🟡 Medio</option>
              <option value="alto">🟠 Alto</option>
              <option value="urgente">🔴 Urgente</option>
            </select>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Observaciones (opcional)..."
              rows={2} style={{ padding: '12px', borderRadius: 8, border: '1.5px solid var(--gray-300)', fontSize: 14, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1, padding: '10px', fontSize: 13 }}>
                <Camera size={14} /> {form.photo ? 'Foto lista ✓' : 'Tomar foto'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} style={{ display: 'none' }} />
              <button className="btn btn-primary" onClick={handleRegisterEvent} style={{ flex: 1, padding: '10px', fontSize: 14, fontWeight: 700 }}>
                <Save size={14} /> Registrar
              </button>
            </div>
            {form.photo && <img src={form.photo} alt="Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }} />}
          </div>
        </div>
      )}

      {/* Traps grid */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={16} /> Cebaderos / Trampas ({traps.length})
        </h3>
        {traps.length === 0 && <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: 20 }}>No hay trampas en este sitio</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {traps.map(trap => {
            const isScanned = eventQueue.some(e => e.trap.id === trap.id);
            return (
              <div key={trap.id} onClick={() => handleTrapSelect(trap)}
                style={{ background: isScanned ? '#ecfdf5' : '#fff', borderRadius: 10, padding: '12px 10px',
                  boxShadow: 'var(--shadow)', border: isScanned ? '2px solid #10b981' : '1px solid var(--gray-200)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{trap.trap_type_icon || '📍'}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{trap.code}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{trap.trap_type_name || 'Trampa'}</div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: getStatusColor(trap.status) + '20', color: getStatusColor(trap.status), fontWeight: 600 }}>
                    {getStatusIcon(trap.status)} {trap.status}
                  </span>
                </div>
                {isScanned && <div style={{ marginTop: 6, color: '#10b981', fontSize: 11, fontWeight: 600 }}>✓ Registrado</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event queue */}
      {eventQueue.length > 0 && (
        <div className="card" style={{ marginBottom: 80, padding: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📋 Eventos registrados ({eventQueue.length})</h3>
          {eventQueue.map((ev, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < eventQueue.length - 1 ? '1px solid var(--gray-100)' : 'none', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>{ev.trap.trap_type_icon || '📍'}</span>
              <span style={{ fontWeight: 600 }}>{ev.trap.code}</span>
              <span style={{ color: 'var(--gray-500)' }}>{ev.description || 'Sin descripción'}</span>
              <span className={`badge badge-${ev.severity === 'urgente' || ev.severity === 'alto' ? 'red' : ev.severity === 'medio' ? 'yellow' : 'green'}`} style={{ fontSize: 10, marginLeft: 'auto' }}>{ev.severity}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fixed footer with finish button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: '#fff', borderTop: '1px solid var(--gray-200)', zIndex: 100 }}>
        <button className="btn btn-success" onClick={finishVisit}
          style={{ width: '100%', padding: '16px', fontSize: 17, fontWeight: 700 }}>
          <CheckCircle size={20} /> Finalizar visita ({eventQueue.length} eventos)
        </button>
      </div>
    </div>
  );

  // STEP 3: Done
  return (
    <div style={{ maxWidth: 500, margin: '60px auto 0', textAlign: 'center', padding: '0 20px' }}>
      <div style={{ background: '#ecfdf5', borderRadius: 20, padding: 40 }}>
        <CheckCircle size={64} style={{ color: '#10b981', marginBottom: 16 }} />
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>¡Visita completada!</h2>
        <p style={{ color: 'var(--gray-600)', fontSize: 16, marginBottom: 6 }}>{eventQueue.length} eventos registrados</p>
        <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>{selectedSite?.name}</p>
      </div>
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visit && (
          <button className="btn btn-outline" onClick={() => window.open(`/api/documents/certificate/${visit.id}`, '_blank')}
            style={{ padding: '14px', fontSize: 15 }}>
            <FileText size={16} /> Descargar certificado
          </button>
        )}
        <button className="btn btn-primary" onClick={() => { setStep('select'); setEventQueue([]); setCurrentTrap(null); setSelectedSite(null); setVisit(null); }}
          style={{ padding: '14px', fontSize: 15, fontWeight: 700 }}>
          <Play size={16} /> Nueva visita
        </button>
        <button className="btn btn-outline" onClick={() => navigate('/dashboard')}
          style={{ padding: '14px', fontSize: 15 }}>
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}