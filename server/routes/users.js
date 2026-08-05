const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - List users (admin sees all, others see technicians)
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    let users;

    if (req.user.role === 'admin') {
      users = db.prepare(`
        SELECT id, email, full_name, role, phone, active, created_at
        FROM users
        ORDER BY role, full_name
      `).all();
    } else {
      // Technicians can see other technicians (for reference)
      users = db.prepare(`
        SELECT id, email, full_name, role, phone, active, created_at
        FROM users WHERE role = 'tecnico' AND active = 1
        ORDER BY full_name
      `).all();
    }

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// GET /api/users/technicians - List only technicians (for assignment dropdowns)
router.get('/technicians', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const technicians = db.prepare(`
      SELECT id, email, full_name, role, phone
      FROM users WHERE role = 'tecnico' AND active = 1
      ORDER BY full_name
    `).all();
    res.json(technicians);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener técnicos' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(`
      SELECT id, email, full_name, role, phone, active, created_at
      FROM users WHERE id = ?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Get assigned sites for technicians
    if (user.role === 'tecnico') {
      user.assigned_sites = db.prepare(`
        SELECT s.id, s.name, c.name as client_name
        FROM site_technicians st
        JOIN sites s ON s.id = st.site_id
        JOIN clients c ON c.id = s.client_id
        WHERE st.user_id = ? AND s.active = 1
        ORDER BY s.name
      `).all(user.id);
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// POST /api/users - Create user (admin only)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { email, password, full_name, role, phone } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Email, contraseña, nombre completo y rol son requeridos' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, password_hash, full_name, role, phone || null);

    const user = db.prepare('SELECT id, email, full_name, role, phone, active FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { email, password, full_name, role, phone, active } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    let password_hash = user.password_hash;
    if (password) {
      password_hash = bcrypt.hashSync(password, 10);
    }

    db.prepare(`
      UPDATE users
      SET email = ?, password_hash = ?, full_name = ?, role = ?, phone = ?, active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      email || user.email,
      password_hash,
      full_name || user.full_name,
      role || user.role,
      phone !== undefined ? phone : user.phone,
      active !== undefined ? active : user.active,
      req.params.id
    );

    const updated = db.prepare('SELECT id, email, full_name, role, phone, active FROM users WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/users/:id (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

module.exports = router;