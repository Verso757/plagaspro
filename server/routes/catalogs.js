const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// ==================== TRAP TYPES ====================
router.get('/trap-types', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const types = db.prepare('SELECT * FROM trap_types WHERE active = 1 ORDER BY name').all();
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tipos de trampa' });
  }
});

router.post('/trap-types', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = db.prepare('INSERT INTO trap_types (name, description, icon) VALUES (?, ?, ?)').run(name, description || null, icon || 'default');
    const item = db.prepare('SELECT * FROM trap_types WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear tipo de trampa' });
  }
});

router.put('/trap-types/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description, icon, active } = req.body;
    const item = db.prepare('SELECT * FROM trap_types WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    db.prepare('UPDATE trap_types SET name=?, description=?, icon=?, active=? WHERE id=?')
      .run(name || item.name, description !== undefined ? description : item.description,
           icon || item.icon, active !== undefined ? active : item.active, req.params.id);
    const updated = db.prepare('SELECT * FROM trap_types WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

router.delete('/trap-types/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE trap_types SET active=0 WHERE id=?').run(req.params.id);
    res.json({ message: 'Desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ==================== PLAGUES ====================
router.get('/plagues', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM plagues WHERE active = 1 ORDER BY name').all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener plagas' });
  }
});

router.post('/plagues', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = db.prepare('INSERT INTO plagues (name, description) VALUES (?, ?)').run(name, description || null);
    const item = db.prepare('SELECT * FROM plagues WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear plaga' });
  }
});

router.put('/plagues/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description, active } = req.body;
    const item = db.prepare('SELECT * FROM plagues WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    db.prepare('UPDATE plagues SET name=?, description=?, active=? WHERE id=?')
      .run(name || item.name, description !== undefined ? description : item.description,
           active !== undefined ? active : item.active, req.params.id);
    const updated = db.prepare('SELECT * FROM plagues WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

router.delete('/plagues/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE plagues SET active=0 WHERE id=?').run(req.params.id);
    res.json({ message: 'Desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ==================== EVENT TYPES ====================
router.get('/event-types', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM event_types WHERE active = 1 ORDER BY name').all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tipos de evento' });
  }
});

router.post('/event-types', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = db.prepare('INSERT INTO event_types (name, description) VALUES (?, ?)').run(name, description || null);
    const item = db.prepare('SELECT * FROM event_types WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear tipo de evento' });
  }
});

router.put('/event-types/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description, active } = req.body;
    const item = db.prepare('SELECT * FROM event_types WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    db.prepare('UPDATE event_types SET name=?, description=?, active=? WHERE id=?')
      .run(name || item.name, description !== undefined ? description : item.description,
           active !== undefined ? active : item.active, req.params.id);
    res.json(db.prepare('SELECT * FROM event_types WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

router.delete('/event-types/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE event_types SET active=0 WHERE id=?').run(req.params.id);
    res.json({ message: 'Desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ==================== SERVICE CATALOG ====================
router.get('/services', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM service_catalog WHERE active = 1 ORDER BY name').all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

router.post('/services', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description, default_price, unit } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = db.prepare('INSERT INTO service_catalog (name, description, default_price, unit) VALUES (?, ?, ?, ?)')
      .run(name, description || null, default_price || 0, unit || 'servicio');
    const item = db.prepare('SELECT * FROM service_catalog WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear servicio' });
  }
});

router.put('/services/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, description, default_price, unit, active } = req.body;
    const item = db.prepare('SELECT * FROM service_catalog WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    db.prepare('UPDATE service_catalog SET name=?, description=?, default_price=?, unit=?, active=? WHERE id=?')
      .run(name || item.name, description !== undefined ? description : item.description,
           default_price !== undefined ? default_price : item.default_price,
           unit || item.unit, active !== undefined ? active : item.active, req.params.id);
    res.json(db.prepare('SELECT * FROM service_catalog WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

router.delete('/services/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE service_catalog SET active=0 WHERE id=?').run(req.params.id);
    res.json({ message: 'Desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ==================== ALL CATALOGS IN ONE ====================
router.get('/all', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    res.json({
      trap_types: db.prepare('SELECT * FROM trap_types WHERE active = 1 ORDER BY name').all(),
      plagues: db.prepare('SELECT * FROM plagues WHERE active = 1 ORDER BY name').all(),
      event_types: db.prepare('SELECT * FROM event_types WHERE active = 1 ORDER BY name').all(),
      services: db.prepare('SELECT * FROM service_catalog WHERE active = 1 ORDER BY name').all(),
      action_types: db.prepare('SELECT * FROM action_types WHERE active = 1 ORDER BY name').all()
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener catálogos' });
  }
});

module.exports = router;