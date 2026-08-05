const express = require('express');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/thresholds?trap_point_id=X
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { trap_point_id } = req.query;
    let query = `
      SELECT t.*, tp.code as trap_code, tp.status as trap_status,
             p.name as plague_name,
             sk.site_id, s.name as site_name
      FROM thresholds t
      JOIN trap_points tp ON tp.id = t.trap_point_id
      LEFT JOIN plagues p ON p.id = t.plague_id
      JOIN sketches sk ON sk.id = tp.sketch_id
      JOIN sites s ON s.id = sk.site_id
      WHERE t.active = 1
    `;
    const params = [];
    if (trap_point_id) { query += ' AND t.trap_point_id = ?'; params.push(trap_point_id); }
    query += ' ORDER BY t.created_at DESC LIMIT 100';
    const thresholds = db.prepare(query).all(...params);
    res.json(thresholds);
  } catch (err) {
    console.error('Thresholds list error:', err);
    res.status(500).json({ error: 'Error al obtener umbrales' });
  }
});

// POST /api/thresholds
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { trap_point_id, plague_id, max_count, period } = req.body;
    if (!trap_point_id || !max_count) {
      return res.status(400).json({ error: 'trap_point_id y max_count son requeridos' });
    }
    const result = db.prepare(`
      INSERT INTO thresholds (trap_point_id, plague_id, max_count, period)
      VALUES (?, ?, ?, ?)
    `).run(trap_point_id, plague_id || null, max_count, period || 'mensual');
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error('Threshold create error:', err);
    res.status(500).json({ error: 'Error al crear umbral' });
  }
});

// PUT /api/thresholds/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { max_count, period, active } = req.body;
    const t = db.prepare('SELECT * FROM thresholds WHERE id = ?').get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Umbral no encontrado' });
    db.prepare(`
      UPDATE thresholds SET max_count = ?, period = ?, active = ? WHERE id = ?
    `).run(max_count != null ? max_count : t.max_count, period || t.period, active !== undefined ? active : t.active, req.params.id);
    res.json({ message: 'Umbral actualizado' });
  } catch (err) {
    console.error('Threshold update error:', err);
    res.status(500).json({ error: 'Error al actualizar umbral' });
  }
});

// DELETE /api/thresholds/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE thresholds SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Umbral desactivado' });
});

// GET /api/thresholds/exceeded - Traps that have exceeded their thresholds
router.get('/exceeded/list', (req, res) => {
  try {
    const db = getDb();
    // This is a simple implementation: compare recent event counts against thresholds
    const thresholds = db.prepare(`
      SELECT t.*, tp.code as trap_code, tp.status as trap_status,
             p.name as plague_name,
             sk.site_id, s.name as site_name, c.name as client_name
      FROM thresholds t
      JOIN trap_points tp ON tp.id = t.trap_point_id AND tp.is_active = 1
      LEFT JOIN plagues p ON p.id = t.plague_id
      JOIN sketches sk ON sk.id = tp.sketch_id
      JOIN sites s ON s.id = sk.site_id
      JOIN clients c ON c.id = s.client_id
      WHERE t.active = 1
    `).all();

    const exceeded = [];

    for (const t of thresholds) {
      const periodDays = t.period === 'semanal' ? 7 : t.period === 'trimestral' ? 90 : 30;
      const eventCount = db.prepare(`
        SELECT COUNT(*) as count FROM events
        WHERE trap_point_id = ?
          AND created_at >= datetime('now', '-' || ? || ' days')
          ${t.plague_id ? 'AND plague_id = ?' : ''}
      `).get(t.trap_point_id, periodDays, ...(t.plague_id ? [t.plague_id] : [])).count;

      if (eventCount >= t.max_count) {
        exceeded.push({
          ...t,
          current_count: eventCount,
          percentage: Math.round((eventCount / t.max_count) * 100)
        });
      }
    }

    res.json(exceeded);
  } catch (err) {
    console.error('Exceeded thresholds error:', err);
    res.status(500).json({ error: 'Error al verificar umbrales' });
  }
});

module.exports = router;