const express = require('express');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/calendar - Get visits for a month/year view
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { month, year, technician_id } = req.query;
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    // Default to current month
    const now = new Date();
    const m = month || (now.getMonth() + 1);
    const y = year || now.getFullYear();

    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = `${y}-${String(m).padStart(2, '0')}-31`;

    let query = `
      SELECT v.*, s.name as site_name, s.address as site_address,
             s.service_frequency, c.name as client_name,
             u.full_name as technician_name
      FROM visits v
      JOIN sites s ON s.id = v.site_id
      JOIN clients c ON c.id = s.client_id
      JOIN users u ON u.id = v.technician_id
      WHERE v.visit_date >= ? AND v.visit_date <= ?
    `;
    const params = [startDate, endDate];

    if (technician_id) {
      query += ' AND v.technician_id = ?';
      params.push(technician_id);
    }

    if (!isAdmin) {
      query += ` AND v.technician_id = ?`;
      params.push(userId);
    }

    query += ' ORDER BY v.visit_date ASC, s.name ASC';

    const visits = db.prepare(query).all(...params);

    // Also get sites with their service frequency for planning
    let sitesQuery = `
      SELECT s.*, c.name as client_name
      FROM sites s
      JOIN clients c ON c.id = s.client_id
      WHERE s.active = 1 AND s.service_frequency IS NOT NULL
    `;
    const sitesParams = [];

    if (!isAdmin) {
      sitesQuery += ` AND s.id IN (SELECT site_id FROM site_technicians WHERE user_id = ?)`;
      sitesParams.push(userId);
    }

    sitesQuery += ' ORDER BY c.name, s.name';
    const sites = db.prepare(sitesQuery).all(...sitesParams);

    // Get technicians for filter
    const technicians = db.prepare(`
      SELECT id, full_name FROM users WHERE role = 'tecnico' AND active = 1 ORDER BY full_name
    `).all();

    res.json({ visits, sites, technicians, month: m, year: y });
  } catch (err) {
    console.error('Calendar error:', err);
    res.status(500).json({ error: 'Error al obtener calendario' });
  }
});

// POST /api/calendar/schedule - Schedule a future visit
router.post('/schedule', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { site_id, technician_id, visit_date, notes } = req.body;

    if (!site_id || !technician_id || !visit_date) {
      return res.status(400).json({ error: 'site_id, technician_id y visit_date son requeridos' });
    }

    // Verify technician exists and is active
    const tech = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'tecnico' AND active = 1").get(technician_id);
    if (!tech) {
      return res.status(400).json({ error: 'Técnico no válido' });
    }

    const result = db.prepare(`
      INSERT INTO visits (site_id, technician_id, visit_date, notes, status)
      VALUES (?, ?, ?, ?, 'planned')
    `).run(site_id, technician_id, visit_date, notes || null);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Visita programada correctamente' });
  } catch (err) {
    console.error('Schedule visit error:', err);
    res.status(500).json({ error: 'Error al programar visita' });
  }
});

// PUT /api/calendar/visit/:id - Update visit status or details
router.put('/visit/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const visitId = req.params.id;
    const { status, notes, visit_date, technician_id } = req.body;

    const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId);
    if (!visit) {
      return res.status(404).json({ error: 'Visita no encontrada' });
    }

    db.prepare(`
      UPDATE visits SET
        status = ?, notes = ?, visit_date = ?, technician_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status || visit.status,
      notes !== undefined ? notes : visit.notes,
      visit_date || visit.visit_date,
      technician_id || visit.technician_id,
      visitId
    );

    res.json({ message: 'Visita actualizada' });
  } catch (err) {
    console.error('Update visit error:', err);
    res.status(500).json({ error: 'Error al actualizar visita' });
  }
});

// GET /api/calendar/upcoming - Next N upcoming visits
router.get('/upcoming', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    let query = `
      SELECT v.*, s.name as site_name, c.name as client_name,
             u.full_name as technician_name
      FROM visits v
      JOIN sites s ON s.id = v.site_id
      JOIN clients c ON c.id = s.client_id
      JOIN users u ON u.id = v.technician_id
      WHERE v.visit_date >= datetime('now') AND v.status = 'planned'
    `;
    const params = [];

    if (!isAdmin) {
      query += ' AND v.technician_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY v.visit_date ASC LIMIT ?';
    params.push(limit);

    const visits = db.prepare(query).all(...params);
    res.json(visits);
  } catch (err) {
    console.error('Upcoming visits error:', err);
    res.status(500).json({ error: 'Error al obtener próximas visitas' });
  }
});

module.exports = router;