const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/clients - List all clients (admin sees all, tecnico sees assigned)
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    let clients;

    if (req.user.role === 'admin') {
      clients = db.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM sites s WHERE s.client_id = c.id AND s.active = 1) as sites_count
        FROM clients c
        ORDER BY c.name
      `).all();
    } else {
      // Technicians see only clients with assigned sites
      clients = db.prepare(`
        SELECT DISTINCT c.*,
          (SELECT COUNT(*) FROM sites s WHERE s.client_id = c.id AND s.active = 1) as sites_count
        FROM clients c
        JOIN sites s ON s.client_id = c.id
        JOIN site_technicians st ON st.site_id = s.id
        WHERE st.user_id = ? AND c.active = 1
        ORDER BY c.name
      `).all(req.user.id);
    }

    res.json(clients);
  } catch (err) {
    console.error('List clients error:', err);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// GET /api/clients/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Check access for tecnico role
    if (req.user.role === 'tecnico') {
      const hasAccess = db.prepare(`
        SELECT 1 FROM sites s
        JOIN site_technicians st ON st.site_id = s.id
        WHERE s.client_id = ? AND st.user_id = ?
      `).get(client.id, req.user.id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'No tienes acceso a este cliente' });
      }
    }

    // Get sites for this client
    const sites = db.prepare(`
      SELECT s.*,
        (SELECT GROUP_CONCAT(u.full_name, ', ') FROM site_technicians st2 JOIN users u ON u.id = st2.user_id WHERE st2.site_id = s.id) as technicians
      FROM sites s
      WHERE s.client_id = ? AND s.active = 1
    `).all(client.id);

    res.json({ ...client, sites });
  } catch (err) {
    console.error('Get client error:', err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// POST /api/clients
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, contact_person, phone, email, address, business_type, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre del cliente es requerido' });
    }

    const result = db.prepare(`
      INSERT INTO clients (name, contact_person, phone, email, address, business_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, contact_person || null, phone || null, email || null, address || null,
           business_type || null, notes || null);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(client);
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

// PUT /api/clients/:id
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { name, contact_person, phone, email, address, business_type, notes, active } = req.body;

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    db.prepare(`
      UPDATE clients
      SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?,
          business_type = ?, notes = ?, active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || client.name,
      contact_person !== undefined ? contact_person : client.contact_person,
      phone !== undefined ? phone : client.phone,
      email !== undefined ? email : client.email,
      address !== undefined ? address : client.address,
      business_type !== undefined ? business_type : client.business_type,
      notes !== undefined ? notes : client.notes,
      active !== undefined ? active : client.active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

// DELETE /api/clients/:id (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE clients SET active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
    res.json({ message: 'Cliente desactivado correctamente' });
  } catch (err) {
    console.error('Delete client error:', err);
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

module.exports = router;