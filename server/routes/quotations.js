const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/quotations - List all quotations
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { client_id, status } = req.query;

    let query = `
      SELECT q.*, c.name as client_name, s.name as site_name,
             u.full_name as created_by_name
      FROM quotations q
      JOIN clients c ON c.id = q.client_id
      LEFT JOIN sites s ON s.id = q.site_id
      JOIN users u ON u.id = q.created_by
      WHERE 1=1
    `;
    const params = [];

    if (client_id) { query += ' AND q.client_id = ?'; params.push(client_id); }
    if (status) { query += ' AND q.status = ?'; params.push(status); }

    // Technicians only see own quotations
    if (req.user.role === 'tecnico') {
      query += ' AND q.created_by = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY q.created_at DESC';

    const quotations = db.prepare(query).all(...params);
    res.json(quotations);
  } catch (err) {
    console.error('List quotations error:', err);
    res.status(500).json({ error: 'Error al obtener cotizaciones' });
  }
});

// GET /api/quotations/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const quotation = db.prepare(`
      SELECT q.*, c.name as client_name, c.address as client_address,
             c.phone as client_phone, c.email as client_email,
             s.name as site_name, s.address as site_address,
             u.full_name as created_by_name
      FROM quotations q
      JOIN clients c ON c.id = q.client_id
      LEFT JOIN sites s ON s.id = q.site_id
      JOIN users u ON u.id = q.created_by
      WHERE q.id = ?
    `).get(req.params.id);

    if (!quotation) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    // Get items
    const items = db.prepare(`
      SELECT qi.*, sc.name as service_name, sc.description as service_description
      FROM quotation_items qi
      LEFT JOIN service_catalog sc ON sc.id = qi.service_catalog_id
      WHERE qi.quotation_id = ?
      ORDER BY qi.id
    `).all(quotation.id);

    quotation.items = items;
    res.json(quotation);
  } catch (err) {
    console.error('Get quotation error:', err);
    res.status(500).json({ error: 'Error al obtener cotización' });
  }
});

// POST /api/quotations
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { client_id, site_id, valid_until, notes, items } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id es requerido' });
    }

    // Calculate total
    let total = 0;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        total += (item.quantity || 1) * (item.unit_price || 0);
      }
    }

    const result = db.prepare(`
      INSERT INTO quotations (client_id, site_id, created_by, status, total, valid_until, notes)
      VALUES (?, ?, ?, 'borrador', ?, ?, ?)
    `).run(client_id, site_id || null, req.user.id, total, valid_until || null, notes || null);

    const quotationId = result.lastInsertRowid;

    // Insert items
    if (items && Array.isArray(items)) {
      const insertItem = db.prepare(`
        INSERT INTO quotation_items (quotation_id, service_catalog_id, description, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
        insertItem.run(quotationId, item.service_catalog_id || null, item.description || null,
                      item.quantity || 1, item.unit_price || 0, itemTotal);
      }
    }

    const quotation = db.prepare(`
      SELECT q.*, c.name as client_name, u.full_name as created_by_name
      FROM quotations q
      JOIN clients c ON c.id = q.client_id
      JOIN users u ON u.id = q.created_by
      WHERE q.id = ?
    `).get(quotationId);

    // Get items
    quotation.items = db.prepare(`
      SELECT qi.*, sc.name as service_name
      FROM quotation_items qi
      LEFT JOIN service_catalog sc ON sc.id = qi.service_catalog_id
      WHERE qi.quotation_id = ?
    `).all(quotationId);

    res.status(201).json(quotation);
  } catch (err) {
    console.error('Create quotation error:', err);
    res.status(500).json({ error: 'Error al crear cotización' });
  }
});

// PUT /api/quotations/:id
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { site_id, status, valid_until, notes, items } = req.body;

    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
    if (!quotation) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    // Only admin can change status to sent/accepted/rejected
    if (req.user.role !== 'admin' && status && status !== 'borrador') {
      return res.status(403).json({ error: 'Solo el administrador puede cambiar el estado' });
    }

    // Calculate total if items provided
    let total = quotation.total;
    if (items && Array.isArray(items)) {
      total = 0;
      for (const item of items) {
        total += (item.quantity || 1) * (item.unit_price || 0);
      }

      // Delete old items and re-insert
      db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(req.params.id);
      const insertItem = db.prepare(`
        INSERT INTO quotation_items (quotation_id, service_catalog_id, description, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        const itemTotal = (item.quantity || 1) * (item.unit_price || 0);
        insertItem.run(req.params.id, item.service_catalog_id || null, item.description || null,
                      item.quantity || 1, item.unit_price || 0, itemTotal);
      }
    }

    db.prepare(`
      UPDATE quotations
      SET site_id = ?, status = ?, total = ?, valid_until = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      site_id !== undefined ? site_id : quotation.site_id,
      status || quotation.status,
      total,
      valid_until !== undefined ? valid_until : quotation.valid_until,
      notes !== undefined ? notes : quotation.notes,
      req.params.id
    );

    const updated = db.prepare(`
      SELECT q.*, c.name as client_name, u.full_name as created_by_name
      FROM quotations q
      JOIN clients c ON c.id = q.client_id
      JOIN users u ON u.id = q.created_by
      WHERE q.id = ?
    `).get(req.params.id);

    updated.items = db.prepare(`
      SELECT qi.*, sc.name as service_name
      FROM quotation_items qi
      LEFT JOIN service_catalog sc ON sc.id = qi.service_catalog_id
      WHERE qi.quotation_id = ?
    `).all(req.params.id);

    res.json(updated);
  } catch (err) {
    console.error('Update quotation error:', err);
    res.status(500).json({ error: 'Error al actualizar cotización' });
  }
});

// DELETE /api/quotations/:id
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM quotations WHERE id = ?').run(req.params.id);
    res.json({ message: 'Cotización eliminada correctamente' });
  } catch (err) {
    console.error('Delete quotation error:', err);
    res.status(500).json({ error: 'Error al eliminar cotización' });
  }
});

module.exports = router;