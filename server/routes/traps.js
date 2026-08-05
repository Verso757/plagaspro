const express = require('express');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/traps?sketch_id=X - List trap points for a sketch
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { sketch_id } = req.query;
    if (!sketch_id) {
      return res.status(400).json({ error: 'sketch_id es requerido' });
    }

    const traps = db.prepare(`
      SELECT tp.*, tt.name as trap_type_name, tt.icon as trap_type_icon,
        (SELECT COUNT(*) FROM events e WHERE e.trap_point_id = tp.id) as events_count
      FROM trap_points tp
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      WHERE tp.sketch_id = ? AND tp.is_active = 1
      ORDER BY tp.code
    `).all(sketch_id);

    res.json(traps);
  } catch (err) {
    console.error('List traps error:', err);
    res.status(500).json({ error: 'Error al obtener trampas' });
  }
});

// GET /api/traps/:id - Get specific trap with history
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const trap = db.prepare(`
      SELECT tp.*, tt.name as trap_type_name, tt.icon as trap_type_icon, sk.site_id
      FROM trap_points tp
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      JOIN sketches sk ON sk.id = tp.sketch_id
      WHERE tp.id = ?
    `).get(req.params.id);

    if (!trap) {
      return res.status(404).json({ error: 'Trampa no encontrada' });
    }

    // Get history of events for this trap
    const events = db.prepare(`
      SELECT e.*, et.name as event_type_name, p.name as plague_name,
             u.full_name as technician_name, v.visit_date
      FROM events e
      LEFT JOIN event_types et ON et.id = e.event_type_id
      LEFT JOIN plagues p ON p.id = e.plague_id
      JOIN visits v ON v.id = e.visit_id
      JOIN users u ON u.id = v.technician_id
      WHERE e.trap_point_id = ?
      ORDER BY e.created_at DESC
    `).all(trap.id);

    trap.events = events;
    res.json(trap);
  } catch (err) {
    console.error('Get trap error:', err);
    res.status(500).json({ error: 'Error al obtener trampa' });
  }
});

// POST /api/traps - Create a new trap point
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { sketch_id, trap_type_id, code, x, y, status, install_date, notes } = req.body;

    if (!sketch_id || code == null || x == null || y == null) {
      return res.status(400).json({ error: 'sketch_id, código, x e y son requeridos' });
    }

    // Check code uniqueness within the sketch
    const existing = db.prepare('SELECT 1 FROM trap_points WHERE sketch_id = ? AND code = ? AND is_active = 1').get(sketch_id, code);
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una trampa con ese código en este croquis' });
    }

    const result = db.prepare(`
      INSERT INTO trap_points (sketch_id, trap_type_id, code, x, y, status, install_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sketch_id, trap_type_id || null, code, x, y, status || 'activa', install_date || null, notes || null);

    const trap = db.prepare(`
      SELECT tp.*, tt.name as trap_type_name
      FROM trap_points tp
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      WHERE tp.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(trap);
  } catch (err) {
    console.error('Create trap error:', err);
    res.status(500).json({ error: 'Error al crear trampa' });
  }
});

// PUT /api/traps/:id - Update trap point
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { trap_type_id, code, x, y, status, install_date, notes, is_active } = req.body;

    const trap = db.prepare('SELECT * FROM trap_points WHERE id = ?').get(req.params.id);
    if (!trap) {
      return res.status(404).json({ error: 'Trampa no encontrada' });
    }

    // Check code uniqueness if changing
    if (code && code !== trap.code) {
      const existing = db.prepare('SELECT 1 FROM trap_points WHERE sketch_id = ? AND code = ? AND is_active = 1 AND id != ?')
        .get(trap.sketch_id, code, req.params.id);
      if (existing) {
        return res.status(400).json({ error: 'Ya existe una trampa con ese código en este croquis' });
      }
    }

    db.prepare(`
      UPDATE trap_points
      SET trap_type_id = ?, code = ?, x = ?, y = ?, status = ?, install_date = ?,
          notes = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      trap_type_id !== undefined ? trap_type_id : trap.trap_type_id,
      code || trap.code,
      x !== undefined ? x : trap.x,
      y !== undefined ? y : trap.y,
      status || trap.status,
      install_date !== undefined ? install_date : trap.install_date,
      notes !== undefined ? notes : trap.notes,
      is_active !== undefined ? is_active : trap.is_active,
      req.params.id
    );

    const updated = db.prepare(`
      SELECT tp.*, tt.name as trap_type_name
      FROM trap_points tp
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      WHERE tp.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Update trap error:', err);
    res.status(500).json({ error: 'Error al actualizar trampa' });
  }
});

// DELETE /api/traps/:id (soft delete)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE trap_points SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
    res.json({ message: 'Trampa desactivada correctamente' });
  } catch (err) {
    console.error('Delete trap error:', err);
    res.status(500).json({ error: 'Error al eliminar trampa' });
  }
});

module.exports = router;