const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/sites - List sites
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { client_id } = req.query;
    let sites;

    if (req.user.role === 'admin') {
      let query = `
        SELECT s.*, c.name as client_name,
          (SELECT GROUP_CONCAT(u.full_name, ', ') FROM site_technicians st2 JOIN users u ON u.id = st2.user_id WHERE st2.site_id = s.id) as technicians
        FROM sites s
        JOIN clients c ON c.id = s.client_id
        WHERE s.active = 1
      `;
      const params = [];
      if (client_id) {
        query += ' AND s.client_id = ?';
        params.push(client_id);
      }
      query += ' ORDER BY s.name';
      sites = db.prepare(query).all(...params);
    } else {
      sites = db.prepare(`
        SELECT s.*, c.name as client_name,
          (SELECT GROUP_CONCAT(u.full_name, ', ') FROM site_technicians st2 JOIN users u ON u.id = st2.user_id WHERE st2.site_id = s.id) as technicians
        FROM sites s
        JOIN clients c ON c.id = s.client_id
        JOIN site_technicians st ON st.site_id = s.id
        WHERE st.user_id = ? AND s.active = 1
        ORDER BY s.name
      `).all(req.user.id);
    }

    res.json(sites);
  } catch (err) {
    console.error('List sites error:', err);
    res.status(500).json({ error: 'Error al obtener sitios' });
  }
});

// GET /api/sites/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const site = db.prepare(`
      SELECT s.*, c.name as client_name
      FROM sites s
      JOIN clients c ON c.id = s.client_id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!site) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    // Check access for tecnico
    if (req.user.role === 'tecnico') {
      const hasAccess = db.prepare('SELECT 1 FROM site_technicians WHERE site_id = ? AND user_id = ?').get(site.id, req.user.id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'No tienes acceso a este sitio' });
      }
    }

    // Get sketches for this site
    const sketches = db.prepare(`
      SELECT sk.*, u.full_name as created_by_name
      FROM sketches sk
      LEFT JOIN users u ON u.id = sk.created_by
      WHERE sk.site_id = ? AND sk.is_active = 1
      ORDER BY sk.version DESC
    `).all(site.id);

    // Get technicians assigned
    const technicians = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone
      FROM site_technicians st
      JOIN users u ON u.id = st.user_id
      WHERE st.site_id = ?
    `).all(site.id);

    site.sketches = sketches;
    site.technicians = technicians;

    res.json(site);
  } catch (err) {
    console.error('Get site error:', err);
    res.status(500).json({ error: 'Error al obtener sitio' });
  }
});

// POST /api/sites
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { client_id, name, address, service_frequency, notes, technician_ids } = req.body;

    if (!client_id || !name) {
      return res.status(400).json({ error: 'Cliente y nombre del sitio son requeridos' });
    }

    const result = db.prepare(`
      INSERT INTO sites (client_id, name, address, service_frequency, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(client_id, name, address || null, service_frequency || null, notes || null);

    const siteId = result.lastInsertRowid;

    // Assign technicians if provided
    if (technician_ids && Array.isArray(technician_ids)) {
      const insertSt = db.prepare('INSERT OR IGNORE INTO site_technicians (site_id, user_id) VALUES (?, ?)');
      for (const techId of technician_ids) {
        insertSt.run(siteId, techId);
      }
    }

    const site = db.prepare(`
      SELECT s.*, c.name as client_name
      FROM sites s JOIN clients c ON c.id = s.client_id
      WHERE s.id = ?
    `).get(siteId);
    res.status(201).json(site);
  } catch (err) {
    console.error('Create site error:', err);
    res.status(500).json({ error: 'Error al crear sitio' });
  }
});

// PUT /api/sites/:id
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, address, service_frequency, notes, active, technician_ids } = req.body;

    const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    db.prepare(`
      UPDATE sites
      SET name = ?, address = ?, service_frequency = ?, notes = ?,
          active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || site.name,
      address !== undefined ? address : site.address,
      service_frequency !== undefined ? service_frequency : site.service_frequency,
      notes !== undefined ? notes : site.notes,
      active !== undefined ? active : site.active,
      req.params.id
    );

    // Update technician assignments if provided
    if (technician_ids && Array.isArray(technician_ids)) {
      db.prepare('DELETE FROM site_technicians WHERE site_id = ?').run(req.params.id);
      const insertSt = db.prepare('INSERT INTO site_technicians (site_id, user_id) VALUES (?, ?)');
      for (const techId of technician_ids) {
        insertSt.run(req.params.id, techId);
      }
    }

    const updated = db.prepare(`
      SELECT s.*, c.name as client_name
      FROM sites s JOIN clients c ON c.id = s.client_id
      WHERE s.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Update site error:', err);
    res.status(500).json({ error: 'Error al actualizar sitio' });
  }
});

// DELETE /api/sites/:id (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE sites SET active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
    res.json({ message: 'Sitio desactivado correctamente' });
  } catch (err) {
    console.error('Delete site error:', err);
    res.status(500).json({ error: 'Error al eliminar sitio' });
  }
});

module.exports = router;