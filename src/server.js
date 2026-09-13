require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { pool, initSchema } = require('./db');
const { uploadFile } = require('./s3');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', { method: req.method, path: req.path });
  next();
});

// Health check - used by load balancers / monitoring to verify the app is alive
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected (MariaDB)', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// List all notes
app.get('/api/notes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM notes ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    logger.error('Failed to fetch notes', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Create a note, optionally with a file upload to S3
app.post('/api/notes', upload.single('file'), async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    let fileUrl = null;
    if (req.file) {
      fileUrl = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    }

    const [result] = await pool.query(
      'INSERT INTO notes (title, content, file_url) VALUES (?, ?, ?)',
      [title, content || null, fileUrl]
    );
    const [rows] = await pool.query('SELECT * FROM notes WHERE id = ?', [result.insertId]);
    logger.info('Note created', { id: result.insertId });
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error('Failed to create note', { error: err.message });
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Delete a note
app.delete('/api/notes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notes WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    logger.error('Failed to delete note', { error: err.message });
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

async function start() {
  try {
    await initSchema();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

start();
