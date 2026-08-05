const express = require('express');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// GET /api/qr/:code - Lookup trap info by QR code
router.get('/:code', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const code = req.params.code;

    const trap = db.prepare(`
      SELECT tp.*, tt.name as trap_type_name, tt.icon as trap_type_icon,
             sk.site_id, s.name as site_name, c.name as client_name
      FROM trap_points tp
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      JOIN sketches sk ON sk.id = tp.sketch_id AND sk.is_active = 1
      JOIN sites s ON s.id = sk.site_id
      JOIN clients c ON c.id = s.client_id
      WHERE tp.qr_code = ? AND tp.is_active = 1
      LIMIT 1
    `).get(code);

    if (!trap) {
      // Also search by numeric code as fallback
      const trapByCode = db.prepare(`
        SELECT tp.*, tt.name as trap_type_name, tt.icon as trap_type_icon,
               sk.site_id, s.name as site_name, c.name as client_name
        FROM trap_points tp
        LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
        JOIN sketches sk ON sk.id = tp.sketch_id AND sk.is_active = 1
        JOIN sites s ON s.id = sk.site_id
        JOIN clients c ON c.id = s.client_id
        WHERE tp.code = ? AND tp.is_active = 1
        LIMIT 1
      `).get(code);

      if (!trapByCode) {
        return res.status(404).json({ error: 'Trampa no encontrada' });
      }
      return res.json(trapByCode);
    }

    // Get recent events for this trap
    const recentEvents = db.prepare(`
      SELECT e.*, et.name as event_type_name, p.name as plague_name,
             v.visit_date, u.full_name as technician_name
      FROM events e
      LEFT JOIN event_types et ON et.id = e.event_type_id
      LEFT JOIN plagues p ON p.id = e.plague_id
      JOIN visits v ON v.id = e.visit_id
      JOIN users u ON u.id = v.technician_id
      WHERE e.trap_point_id = ?
      ORDER BY e.created_at DESC
      LIMIT 5
    `).all(trap.id);

    // Get thresholds for this trap
    const thresholds = db.prepare(`
      SELECT t.*, p.name as plague_name
      FROM thresholds t
      LEFT JOIN plagues p ON p.id = t.plague_id
      WHERE t.trap_point_id = ? AND t.active = 1
    `).all(trap.id);

    res.json({
      trap,
      recent_events: recentEvents,
      thresholds
    });
  } catch (err) {
    console.error('QR lookup error:', err);
    res.status(500).json({ error: 'Error al buscar trampa' });
  }
});

// POST /api/qr/checkin - Quick checkin when scanning a QR code in the field
router.post('/checkin', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { qr_code, event_type_id, plague_id, severity, description, actions_taken } = req.body;

    if (!qr_code) {
      return res.status(400).json({ error: 'qr_code es requerido' });
    }

    const trap = db.prepare(`
      SELECT tp.*, sk.site_id
      FROM trap_points tp
      JOIN sketches sk ON sk.id = tp.sketch_id AND sk.is_active = 1
      WHERE tp.qr_code = ? AND tp.is_active = 1
    `).get(qr_code);

    if (!trap) {
      return res.status(404).json({ error: 'Trampa no encontrada' });
    }

    // Create or find an active visit for this site today
    const today = new Date().toISOString().split('T')[0];
    let visit = db.prepare(`
      SELECT id FROM visits
      WHERE site_id = ? AND technician_id = ? AND date(visit_date) = ?
      LIMIT 1
    `).get(trap.site_id, req.user.id, today);

    if (!visit) {
      // Create a new visit automatically
      const result = db.prepare(`
        INSERT INTO visits (site_id, technician_id, visit_date, status, notes)
        VALUES (?, ?, datetime('now'), 'in_progress', 'Check-in rápido vía QR')
      `).run(trap.site_id, req.user.id);
      visit = { id: result.lastInsertRowid };
    }

    // Create event
    const eventResult = db.prepare(`
      INSERT INTO events (visit_id, trap_point_id, event_type_id, plague_id, severity, description, actions_taken)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      visit.id,
      trap.id,
      event_type_id || null,
      plague_id || null,
      severity || 'bajo',
      description || 'Registrado vía QR',
      actions_taken || null
    );

    res.status(201).json({
      id: eventResult.lastInsertRowid,
      visit_id: visit.id,
      message: 'Evento registrado correctamente'
    });
  } catch (err) {
    console.error('QR checkin error:', err);
    res.status(500).json({ error: 'Error al registrar check-in' });
  }
});

// POST /api/qr/generate/:trapId - Generate QR code for a specific trap
router.post('/generate/:trapId', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const trapId = req.params.trapId;

    const trap = db.prepare('SELECT * FROM trap_points WHERE id = ?').get(trapId);
    if (!trap) {
      return res.status(404).json({ error: 'Trampa no encontrada' });
    }

    const qrCode = uuidv4().slice(0, 12);
    db.prepare('UPDATE trap_points SET qr_code = ? WHERE id = ?').run(qrCode, trapId);

    res.json({ qr_code: qrCode, message: 'Código QR generado' });
  } catch (err) {
    console.error('QR generate error:', err);
    res.status(500).json({ error: 'Error al generar QR' });
  }
});

module.exports = router;