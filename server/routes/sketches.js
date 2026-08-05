const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Setup multer for image uploads
const uploadsDir = path.join(__dirname, '..', 'uploads', 'sketches');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/sketches?site_id=X - List sketches for a site
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { site_id } = req.query;
    if (!site_id) {
      return res.status(400).json({ error: 'site_id es requerido' });
    }

    const sketches = db.prepare(`
      SELECT sk.*, u.full_name as created_by_name
      FROM sketches sk
      LEFT JOIN users u ON u.id = sk.created_by
      WHERE sk.site_id = ? AND sk.is_active = 1
      ORDER BY sk.version DESC
    `).all(site_id);

    res.json(sketches);
  } catch (err) {
    console.error('List sketches error:', err);
    res.status(500).json({ error: 'Error al obtener croquis' });
  }
});

// GET /api/sketches/:id - Get a specific sketch with its trap points
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const sketch = db.prepare(`
      SELECT sk.*, u.full_name as created_by_name
      FROM sketches sk
      LEFT JOIN users u ON u.id = sk.created_by
      WHERE sk.id = ?
    `).get(req.params.id);

    if (!sketch) {
      return res.status(404).json({ error: 'Croquis no encontrado' });
    }

    // Parse canvas_data from JSON string to object
    if (sketch.canvas_data) {
      sketch.canvas_data = JSON.parse(sketch.canvas_data);
    }

    // Get trap points for this sketch
    const trapPoints = db.prepare(`
      SELECT tp.*, tt.name as trap_type_name, tt.icon as trap_type_icon,
        (SELECT COUNT(*) FROM events e WHERE e.trap_point_id = tp.id) as events_count
      FROM trap_points tp
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      WHERE tp.sketch_id = ? AND tp.is_active = 1
      ORDER BY tp.code
    `).all(sketch.id);

    sketch.trap_points = trapPoints;
    res.json(sketch);
  } catch (err) {
    console.error('Get sketch error:', err);
    res.status(500).json({ error: 'Error al obtener croquis' });
  }
});

// POST /api/sketches - Create a new sketch
router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { site_id, name, canvas_data } = req.body;

    if (!site_id || !name) {
      return res.status(400).json({ error: 'site_id y nombre son requeridos' });
    }

    // Get current max version for this site
    const maxVersion = db.prepare('SELECT MAX(version) as max_v FROM sketches WHERE site_id = ?').get(site_id);
    const newVersion = (maxVersion?.max_v || 0) + 1;

    const result = db.prepare(`
      INSERT INTO sketches (site_id, name, version, canvas_data, is_active, created_by)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(site_id, name, newVersion, canvas_data ? JSON.stringify(canvas_data) : null, req.user.id);

    const sketch = db.prepare('SELECT * FROM sketches WHERE id = ?').get(result.lastInsertRowid);
    if (sketch.canvas_data) sketch.canvas_data = JSON.parse(sketch.canvas_data);
    res.status(201).json(sketch);
  } catch (err) {
    console.error('Create sketch error:', err);
    res.status(500).json({ error: 'Error al crear croquis' });
  }
});

// PUT /api/sketches/:id - Update sketch (creates new version if canvas_data changed)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { name, canvas_data, is_active } = req.body;
    const sketch = db.prepare('SELECT * FROM sketches WHERE id = ?').get(req.params.id);
    if (!sketch) {
      return res.status(404).json({ error: 'Croquis no encontrado' });
    }

    db.prepare(`
      UPDATE sketches
      SET name = ?, canvas_data = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || sketch.name,
      canvas_data ? JSON.stringify(canvas_data) : sketch.canvas_data,
      is_active !== undefined ? is_active : sketch.is_active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM sketches WHERE id = ?').get(req.params.id);
    if (updated.canvas_data) updated.canvas_data = JSON.parse(updated.canvas_data);
    res.json(updated);
  } catch (err) {
    console.error('Update sketch error:', err);
    res.status(500).json({ error: 'Error al actualizar croquis' });
  }
});

// POST /api/sketches/:id/background - Upload background image
router.post('/:id/background', authenticateToken, upload.single('image'), (req, res) => {
  try {
    const db = getDb();
    const sketch = db.prepare('SELECT * FROM sketches WHERE id = ?').get(req.params.id);
    if (!sketch) {
      return res.status(404).json({ error: 'Croquis no encontrado' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ninguna imagen' });
    }

    const imagePath = '/uploads/sketches/' + req.file.filename;
    db.prepare('UPDATE sketches SET background_image = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(imagePath, req.params.id);

    res.json({ background_image: imagePath });
  } catch (err) {
    console.error('Upload background error:', err);
    res.status(500).json({ error: 'Error al subir imagen de fondo' });
  }
});

// DELETE /api/sketches/:id
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE sketches SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Croquis desactivado correctamente' });
  } catch (err) {
    console.error('Delete sketch error:', err);
    res.status(500).json({ error: 'Error al eliminar croquis' });
  }
});

module.exports = router;