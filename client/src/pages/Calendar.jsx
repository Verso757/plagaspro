import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { ChevronLeft, ChevronRight, MapPin, Clock, User, Plus, X } from 'lucide-react';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function Calendar() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [techFilter, setTechFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ site_id: '', technician_id: '', visit_date: '', notes: '' });

  useEffect(() => {
    setLoading(true);
    const params = `/calendar?month=${month}&year=${year}${techFilter ? `&technician_id=${techFilter}` : ''}`;
    api.get(params).then(res => { setData(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [month, year, techFilter]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const visitsByDate = {};
  if (data?.visits) {
    data.visits.forEach(v => {
      const d = v.visit_date.split('T')[0];
      if (!visitsByDate[d]) visitsByDate[d] = [];
      visitsByDate[d].push(v);
    });
  }

  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const handleSchedule = async (e) => {
    e.preventDefault();
    try {
      await api.post('/calendar/schedule', form);
      setShowModal(false);
      setForm({ site_id: '', technician_id: '', visit_date: '', notes: '' });
      const params = `/calendar?month=${month}&year=${year}${techFilter ? `&technician_id=${techFilter}` : ''}`;
      const res = await api.get(params);
      setData(res.data);
    } catch (err) { alert(err.response?.data?.error || 'Error al programar'); }
  };

  const statusColors = {
    planned: '#1a73e8',
    in_progress: '#f9ab00',
    completed: '#0d904f',
    cancelled: '#999'
  };

  const statusLabels = {
    planned: 'P',
    in_progress: 'IP',
    completed: '✓',
    cancelled: 'X'
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Calendario de Servicios</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={techFilter} onChange={e => setTechFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }}>
            <option value="">Todos los técnicos</option>
            {data?.technicians?.map(t => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Programar visita
          </button>
        </div>
      </div>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
        <h3 style={{ minWidth: 180, textAlign: 'center' }}>{MONTHS[month - 1]} {year}</h3>
        <button className="btn btn-outline btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
      </div>

      {/* Calendar grid */}
      <div className="card" style={{ padding: 12, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, padding: '6px 0', background: 'var(--gray-50)', borderRadius: 4 }}>
              {d}
            </div>
          ))}
          {calendarDays.map((d, i) => {
            if (d === null) return <div key={`e${i}`} style={{ minHeight: 80, background: '#fafafa', borderRadius: 4 }} />;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayVisits = visitsByDate[dateStr] || [];
            const isToday = d === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
            return (
              <div key={d} style={{
                minHeight: 80, padding: 4, borderRadius: 4, fontSize: 11,
                border: isToday ? '2px solid var(--primary)' : '1px solid #eee',
                background: isToday ? 'var(--primary-light)' : '#fff',
                overflow: 'hidden'
              }}>
                <div style={{ fontWeight: 600, marginBottom: 2, textAlign: 'right' }}>{d}</div>
                {dayVisits.slice(0, 3).map(v => (
                  <Link key={v.id} to={`/events/${v.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: statusColors[v.status], color: '#fff', padding: '2px 4px',
                      borderRadius: 3, marginBottom: 1, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }} title={`${v.site_name} - ${v.technician_name}`}>
                      {statusLabels[v.status]} {v.site_name}
                    </div>
                  </Link>
                ))}
                {dayVisits.length > 3 && (
                  <div style={{ fontSize: 9, color: 'var(--gray-500)', textAlign: 'center' }}>
                    +{dayVisits.length - 3} más
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12 }}>
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
            <span>{statusLabels[status]} = {status === 'planned' ? 'Planeada' : status === 'in_progress' ? 'En progreso' : status === 'completed' ? 'Completada' : 'Cancelada'}</span>
          </div>
        ))}
      </div>

      {/* Scheduling Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>Programar Visita</h3>
              <button className="btn btn-sm btn-outline" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSchedule}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Sitio</label>
                <select required value={form.site_id} onChange={e => setForm({ ...form, site_id: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }}>
                  <option value="">Seleccionar sitio...</option>
                  {data?.sites?.map(s => (
                    <option key={s.id} value={s.id}>{s.client_name} - {s.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Técnico</label>
                <select required value={form.technician_id} onChange={e => setForm({ ...form, technician_id: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }}>
                  <option value="">Seleccionar técnico...</option>
                  {data?.technicians?.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Fecha</label>
                <input required type="date" value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Notas</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: 13, resize: 'vertical' }} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Programar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}