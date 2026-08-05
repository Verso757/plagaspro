const express = require('express');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/invoices - List all invoices or filter by client/status
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { client_id, status } = req.query;

    let query = `
      SELECT i.*, c.name as client_name, s.name as site_name
      FROM invoices i
      JOIN clients c ON c.id = i.client_id
      LEFT JOIN sites s ON s.id = i.site_id
      WHERE 1=1
    `;
    const params = [];

    if (client_id) { query += ' AND i.client_id = ?'; params.push(client_id); }
    if (status) { query += ' AND i.status = ?'; params.push(status); }

    query += ' ORDER BY i.created_at DESC LIMIT 100';
    const invoices = db.prepare(query).all(...params);

    res.json(invoices);
  } catch (err) {
    console.error('Invoices error:', err);
    res.status(500).json({ error: 'Error al obtener facturas' });
  }
});

// GET /api/invoices/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, s.name as site_name
    FROM invoices i
    JOIN clients c ON c.id = i.client_id
    LEFT JOIN sites s ON s.id = i.site_id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json(invoice);
});

// POST /api/invoices
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { client_id, site_id, quotation_id, number, amount, tax, total, status, issue_date, due_date, payment_method, notes } = req.body;

    if (!client_id || !number || amount == null || total == null) {
      return res.status(400).json({ error: 'Campos requeridos: client_id, number, amount, total' });
    }

    const result = db.prepare(`
      INSERT INTO invoices (client_id, site_id, quotation_id, number, amount, tax, total, status, issue_date, due_date, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      client_id, site_id || null, quotation_id || null,
      number, amount, tax || 0, total,
      status || 'pendiente', issue_date || null, due_date || null,
      payment_method || null, notes || null
    );

    res.status(201).json({ id: result.lastInsertRowid, number });
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Error al crear factura' });
  }
});

// PUT /api/invoices/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { number, amount, tax, total, status, issue_date, due_date, paid_date, payment_method, notes } = req.body;

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

    db.prepare(`
      UPDATE invoices SET
        number = ?, amount = ?, tax = ?, total = ?,
        status = ?, issue_date = ?, due_date = ?, paid_date = ?,
        payment_method = ?, notes = ?
      WHERE id = ?
    `).run(
      number || invoice.number,
      amount != null ? amount : invoice.amount,
      tax != null ? tax : invoice.tax,
      total != null ? total : invoice.total,
      status || invoice.status,
      issue_date !== undefined ? issue_date : invoice.issue_date,
      due_date !== undefined ? due_date : invoice.due_date,
      paid_date !== undefined ? paid_date : invoice.paid_date,
      payment_method !== undefined ? payment_method : invoice.payment_method,
      notes !== undefined ? notes : invoice.notes,
      req.params.id
    );

    res.json({ message: 'Factura actualizada' });
  } catch (err) {
    console.error('Update invoice error:', err);
    res.status(500).json({ error: 'Error al actualizar factura' });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE invoices SET status = 'cancelada' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Factura cancelada' });
});

module.exports = router;