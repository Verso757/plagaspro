const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Setup multer for event photos
const uploadsDir = path.join(__dirname, '..', 'uploads', 'events');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ==================== VISITS ====================

// GET /api/events/visits?site_id=X - List visits for a site
router.get('/visits', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { site_id, technician_id, status } = req.query;

    let query = `
      SELECT v.*, s.name as site_name, c.name as client_name,
             u.full_name as technician_name
      FROM visits v
      JOIN sites s ON s.id = v.site_id
      JOIN clients c ON c.id = s.client_id
      JOIN users u ON u.id = v.technician_id
      WHERE 1=1
    `;
    const params = [];

    if (site_id) { query += ' AND v.site_id = ?'; params.push(site_id); }
    if (technician_id) { query += ' AND v.technician_id = ?'; params.push(technician_id); }
    if (status) { query += ' AND v.status = ?'; params.push(status); }

    // Filter for technicians to only see their visits
    if (req.user.role === 'tecnico') {
      query += ' AND v.technician_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY v.visit_date DESC LIMIT 100';

    const visits = db.prepare(query).all(...params);
    res.json(visits);
  } catch (err) {
    console.error('List visits error:', err);
    res.status(500).json({ error: 'Error al obtener visitas' });
  }
});

// GET /api/events/visits/:id
router.get('/visits/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const visit = db.prepare(`
      SELECT v.*, s.name as site_name, c.name as client_name,
             u.full_name as technician_name
      FROM visits v
      JOIN sites s ON s.id = v.site_id
      JOIN clients c ON c.id = s.client_id
      JOIN users u ON u.id = v.technician_id
      WHERE v.id = ?
    `).get(req.params.id);

    if (!visit) {
      return res.status(404).json({ error: 'Visita no encontrada' });
    }

    // Get events for this visit
    const events = db.prepare(`
      SELECT e.*, et.name as event_type_name, p.name as plague_name,
             tp.code as trap_code, tt.name as trap_type_name
      FROM events e
      LEFT JOIN event_types et ON et.id = e.event_type_id
      LEFT JOIN plagues p ON p.id = e.plague_id
      LEFT JOIN trap_points tp ON tp.id = e.trap_point_id
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      WHERE e.visit_id = ?
      ORDER BY e.created_at DESC
    `).all(visit.id);

    // Get photos for each event
    for (const event of events) {
      event.photos = db.prepare('SELECT * FROM event_photos WHERE event_id = ?').all(event.id);
    }

    visit.events = events;
    res.json(visit);
  } catch (err) {
    console.error('Get visit error:', err);
    res.status(500).json({ error: 'Error al obtener visita' });
  }
});

// POST /api/events/visits - Create a new visit
router.post('/visits', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { site_id, visit_date, notes, status } = req.body;

    if (!site_id) {
      return res.status(400).json({ error: 'site_id es requerido' });
    }

    const result = db.prepare(`
      INSERT INTO visits (site_id, technician_id, visit_date, notes, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(site_id, req.user.id, visit_date || new Date().toISOString(), notes || null, status || 'completed');

    const visit = db.prepare(`
      SELECT v.*, s.name as site_name, u.full_name as technician_name
      FROM visits v
      JOIN sites s ON s.id = v.site_id
      JOIN users u ON u.id = v.technician_id
      WHERE v.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(visit);
  } catch (err) {
    console.error('Create visit error:', err);
    res.status(500).json({ error: 'Error al crear visita' });
  }
});

// PUT /api/events/visits/:id
router.put('/visits/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { visit_date, notes, status } = req.body;
    const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
    if (!visit) {
      return res.status(404).json({ error: 'Visita no encontrada' });
    }

    db.prepare(`
      UPDATE visits SET visit_date = ?, notes = ?, status = ? WHERE id = ?
    `).run(visit_date || visit.visit_date, notes !== undefined ? notes : visit.notes,
           status || visit.status, req.params.id);

    const updated = db.prepare(`
      SELECT v.*, s.name as site_name, u.full_name as technician_name
      FROM visits v
      JOIN sites s ON s.id = v.site_id
      JOIN users u ON u.id = v.technician_id
      WHERE v.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Update visit error:', err);
    res.status(500).json({ error: 'Error al actualizar visita' });
  }
});

// ==================== EVENTS ====================

// POST /api/events - Create a new event
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { visit_id, trap_point_id, event_type_id, plague_id, severity, description, actions_taken } = req.body;

    if (!visit_id) {
      return res.status(400).json({ error: 'visit_id es requerido' });
    }

    const result = db.prepare(`
      INSERT INTO events (visit_id, trap_point_id, event_type_id, plague_id, severity, description, actions_taken)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(visit_id, trap_point_id || null, event_type_id || null, plague_id || null,
           severity || 'bajo', description || null, actions_taken || null);

    const event = db.prepare(`
      SELECT e.*, et.name as event_type_name, p.name as plague_name
      FROM events e
      LEFT JOIN event_types et ON et.id = e.event_type_id
      LEFT JOIN plagues p ON p.id = e.plague_id
      WHERE e.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(event);
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

// POST /api/events/:id/photos - Upload photos for an event
router.post('/:id/photos', authenticateToken, upload.array('photos', 10), (req, res) => {
  try {
    const db = getDb();
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const photos = [];
    if (req.files && req.files.length > 0) {
      const insertSt = db.prepare('INSERT INTO event_photos (event_id, file_path) VALUES (?, ?)');
      for (const file of req.files) {
        const filePath = '/uploads/events/' + file.filename;
        insertSt.run(event.id, filePath);
        photos.push({ file_path: filePath });
      }
    }

    res.json({ photos });
  } catch (err) {
    console.error('Upload photos error:', err);
    res.status(500).json({ error: 'Error al subir fotos' });
  }
});

// GET /api/events - Search/filter events
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { client_id, site_id, plague_id, severity, technician_id, date_from, date_to, trap_point_id } = req.query;

    let query = `
      SELECT e.*, et.name as event_type_name, p.name as plague_name,
             tp.code as trap_code, v.site_id, v.visit_date,
             s.name as site_name, c.name as client_name, c.id as client_id,
             u.full_name as technician_name
      FROM events e
      LEFT JOIN event_types et ON et.id = e.event_type_id
      LEFT JOIN plagues p ON p.id = e.plague_id
      LEFT JOIN trap_points tp ON tp.id = e.trap_point_id
      JOIN visits v ON v.id = e.visit_id
      JOIN sites s ON s.id = v.site_id
      JOIN clients c ON c.id = s.client_id
      JOIN users u ON u.id = v.technician_id
      WHERE 1=1
    `;
    const params = [];

    if (client_id) { query += ' AND c.id = ?'; params.push(client_id); }
    if (site_id) { query += ' AND v.site_id = ?'; params.push(site_id); }
    if (plague_id) { query += ' AND e.plague_id = ?'; params.push(plague_id); }
    if (severity) { query += ' AND e.severity = ?'; params.push(severity); }
    if (technician_id) { query += ' AND v.technician_id = ?'; params.push(technician_id); }
    if (date_from) { query += ' AND e.created_at >= ?'; params.push(date_from); }
    if (date_to) { query += ' AND e.created_at <= ?'; params.push(date_to); }
    if (trap_point_id) { query += ' AND e.trap_point_id = ?'; params.push(trap_point_id); }

    // Filter for technicians
    if (req.user.role === 'tecnico') {
      query += ' AND v.technician_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY e.created_at DESC LIMIT 200';

    const events = db.prepare(query).all(...params);

    // Get photos for each event
    for (const event of events) {
      event.photos = db.prepare('SELECT * FROM event_photos WHERE event_id = ?').all(event.id);
    }

    res.json(events);
  } catch (err) {
    console.error('Search events error:', err);
    res.status(500).json({ error: 'Error al buscar eventos' });
  }
});

module.exports = router;