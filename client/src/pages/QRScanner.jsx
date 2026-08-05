import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { QrCode, Camera, X, Save, AlertTriangle, CheckCircle, MapPin } from 'lucide-react';

export default function QRScanner() {
  const [scanning, setScanning] = useState(false);
  const [trapData, setTrapData] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [plagues, setPlagues] = useState([]);
  const [form, setForm] = useState({ event_type_id: '', plague_id: '', severity: 'bajo', description: '', actions_taken: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    api.get('/catalogs/event-types').then(r => setEventTypes(r.data || [])).catch(() => {});
    api.get('/catalogs/plagues').then(r => setPlagues(r.data || [])).catch(() => {});
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanning = async () => {
    setError('');
    setScanning(true);
    try {
      const Html5Qrcode = (await import('html5-qrcode')).Html5Qrcode;
      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          lookupTrap(decodedText);
          scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {} // ignore scan errors
      );
    } catch (err) {
      setError('No se pudo acceder a la cámara. Intenta ingresar el código manualmente.');
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      await html5QrCodeRef.current.stop().catch(() => {});
    }
    setScanning(false);
  };

  const lookupTrap = async (code) => {
    setError('');
    try {
      const res = await api.get(`/qr/${encodeURIComponent(code)}`);
      setTrapData(res.data);
      setSubmitted(false);
    } catch (err) {
      setError('Código no encontrado. Verifica e intenta de nuevo.');
      setTrapData(null);
    }
  };

  const handleManualLookup = (e) => {
    e.preventDefault();
    if (manualCode.trim()) lookupTrap(manualCode.trim());
  };

  const handleSubmitEvent = async (e) => {
    e.preventDefault();
    if (!trapData?.trap?.qr_code) return;
    try {
      await api.post('/qr/checkin', {
        qr_code: trapData.trap.qr_code,
        ...form,
        event_type_id: form.event_type_id || null,
        plague_id: form.plague_id || null
      });
      setSubmitted(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al registrar');
    }
  };

  const handleGenerateQR = async (trapId) => {
    try {
      const res = await api.post(`/qr/generate/${trapId}`);
      alert(`Código QR generado: ${res.data.qr_code}`);
      if (trapData) {
        setTrapData({
          ...trapData,
          trap: { ...trapData.trap, qr_code: res.data.qr_code }
        });
      }
    } catch (err) {
      alert('Error al generar QR');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Escáner QR de Trampas</h2>

      {/* Info card */}
      <div className="card" style={{ marginBottom: 16, background: 'var(--primary-light)', border: '1px solid #c6dafc' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <QrCode size={40} style={{ color: 'var(--primary)' }} />
          <div>
            <h4 style={{ margin: '0 0 4px 0' }}>Registro rápido en terreno</h4>
            <p style={{ fontSize: 13, color: 'var(--gray-600)', margin: 0 }}>
              Escanea el código QR de una trampa para registrar eventos al instante sin necesidad de navegar por menús.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Scanner */}
        <div>
          <div className="card" style={{ minHeight: 350, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {scanning ? (
              <>
                <div id="qr-reader" style={{ width: '100%', maxWidth: 400 }} />
                <button className="btn btn-outline btn-sm" onClick={stopScanning} style={{ marginTop: 12 }}>
                  <X size={14} /> Cancelar escaneo
                </button>
              </>
            ) : error && !trapData ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <AlertTriangle size={40} style={{ color: 'var(--warning)', marginBottom: 12 }} />
                <p style={{ color: 'var(--gray-600)', marginBottom: 12 }}>{error}</p>
                <button className="btn btn-primary btn-sm" onClick={startScanning}>
                  <Camera size={14} /> Reintentar cámara
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <QrCode size={56} style={{ color: 'var(--gray-400)', marginBottom: 12 }} />
                <p style={{ color: 'var(--gray-600)', marginBottom: 16 }}>Escanea un código QR o ingrésalo manualmente</p>
                <button className="btn btn-primary" onClick={startScanning} style={{ marginBottom: 16 }}>
                  <Camera size={16} /> Abrir cámara
                </button>
                <form onSubmit={handleManualLookup} style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <input value={manualCode} onChange={e => setManualCode(e.target.value)}
                    placeholder="Código QR o código de trampa"
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--gray-300)', width: 240, fontSize: 13 }} />
                  <button type="submit" className="btn btn-outline btn-sm">Buscar</button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right: Trap info & form */}
        <div>
          {trapData && (
            <div className="card">
              <div className="card-header">
                <h3>{trapData.trap.trap_type_icon || '📍'} {trapData.trap.code}</h3>
                <span className={`badge badge-${trapData.trap.status === 'activa' ? 'green' : 'red'}`}>
                  {trapData.trap.status}
                </span>
              </div>

              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <p><strong>Sitio:</strong> {trapData.trap.site_name}</p>
                <p><strong>Cliente:</strong> {trapData.trap.client_name}</p>
                <p><strong>Tipo:</strong> {trapData.trap.trap_type_name || 'No definido'}</p>
                <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>QR: {trapData.trap.qr_code || 'No generado'}</p>
                {!trapData.trap.qr_code && (
                  <button className="btn btn-sm btn-outline" onClick={() => handleGenerateQR(trapData.trap.id)} style={{ marginTop: 4 }}>
                    <QrCode size={12} /> Generar QR
                  </button>
                )}
              </div>

              {/* Thresholds */}
              {trapData.thresholds?.length > 0 && (
                <div style={{ marginBottom: 12, padding: 8, background: '#fef7e0', borderRadius: 6, fontSize: 12 }}>
                  <strong>⚠️ Umbrales configurados:</strong>
                  {trapData.thresholds.map(th => (
                    <div key={th.id}>• {th.plague_name || 'General'}: máx {th.max_count} ({th.period})</div>
                  ))}
                </div>
              )}

              {/* Recent events */}
              {trapData.recent_events?.length > 0 && (
                <div style={{ marginBottom: 12, fontSize: 11 }}>
                  <strong>Últimos eventos:</strong>
                  {trapData.recent_events.slice(0, 3).map(ev => (
                    <div key={ev.id} style={{ padding: '3px 0', borderBottom: '1px solid var(--gray-100)' }}>
                      {new Date(ev.visit_date).toLocaleDateString('es-MX')} - {ev.event_type_name || 'Evento'} - {ev.severity}
                    </div>
                  ))}
                </div>
              )}

              {submitted ? (
                <div style={{ textAlign: 'center', padding: 20, background: '#e6f4ea', borderRadius: 6 }}>
                  <CheckCircle size={32} style={{ color: 'var(--success)', marginBottom: 8 }} />
                  <p style={{ fontWeight: 600, color: 'var(--success)' }}>¡Evento registrado exitosamente!</p>
                  <button className="btn btn-outline btn-sm" onClick={() => { setSubmitted(false); setTrapData(null); }}
                    style={{ marginTop: 8 }}>Escanear otro</button>
                </div>
              ) : (
                <form onSubmit={handleSubmitEvent}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>Registrar Evento</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Tipo de evento</label>
                      <select value={form.event_type_id} onChange={e => setForm({ ...form, event_type_id: e.target.value })}
                        style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 12 }}>
                        <option value="">Seleccionar...</option>
                        {eventTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Plaga</label>
                      <select value={form.plague_id} onChange={e => setForm({ ...form, plague_id: e.target.value })}
                        style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 12 }}>
                        <option value="">Seleccionar...</option>
                        {plagues.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Severidad</label>
                      <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}
                        style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 12 }}>
                        <option value="bajo">Bajo</option>
                        <option value="medio">Medio</option>
                        <option value="alto">Alto</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Acciones</label>
                      <input value={form.actions_taken} onChange={e => setForm({ ...form, actions_taken: e.target.value })}
                        placeholder="Ej: Fumigación"
                        style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 12 }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Descripción</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      rows={2} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid var(--gray-300)', fontSize: 12, resize: 'vertical' }} />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                    <Save size={14} /> Registrar evento
                  </button>
                </form>
              )}
            </div>
          )}

          {!trapData && !scanning && !error && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-500)' }}>
              <MapPin size={48} style={{ marginBottom: 12 }} />
              <p>Escanea un código QR para ver la información de la trampa y registrar eventos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}