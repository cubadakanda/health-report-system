const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ===== Upload Configuration =====
// Photo upload is accepted by the form, but storage is disabled for now to keep
// report submission stable while the seeded database data remains usable.
const upload = multer();

// ===== Database Connection Pool =====
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ===== API Routes =====

// 1. HOME PAGE
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

// 2. GET All Reports (untuk dashboard)
app.get('/api/reports', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT id, report_type, location, description, photo_url, status, created_at 
       FROM health_reports ORDER BY created_at DESC`
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. GET Report Statistics (untuk monitoring)
app.get('/api/statistics', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [stats] = await connection.query(`
      SELECT 
        report_type,
        COUNT(*) as total,
        status,
        SUBSTRING(location, 1, 10) as area
      FROM health_reports
      GROUP BY report_type, status
    `);
    
    const [totalByStatus] = await connection.query(`
      SELECT status, COUNT(*) as count FROM health_reports GROUP BY status
    `);
    
    connection.release();
    
    res.json({
      byType: stats,
      byStatus: totalByStatus
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 4. POST - Create New Health Report (FITUR 1: Laporan)
app.post('/api/reports', upload.single('photo'), async (req, res) => {
  try {
    const { report_type, location, description, reporter_name, reporter_phone } = req.body;
    const photoUrl = null;

    if (!report_type || !location || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const connection = await pool.getConnection();
    const result = await connection.query(
      `INSERT INTO health_reports (report_type, location, description, photo_url, reporter_name, reporter_phone, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [report_type, location, description, photoUrl, reporter_name, reporter_phone]
    );
    connection.release();

    res.status(201).json({
      id: result[0].insertId,
      message: 'Report submitted successfully',
      photoUrl: photoUrl
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// 5. PUT - Update Report Status (FITUR 2: Admin manage)
app.put('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status required' });
    }

    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE health_reports SET status = ?, admin_notes = ? WHERE id = ?`,
      [status, admin_notes || null, id]
    );
    connection.release();

    res.json({ message: 'Report updated successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// 6. GET - Disease Monitoring by Location (FITUR 3: Surveilans)
app.get('/api/disease-monitoring', async (req, res) => {
  try {
    const location = req.query.location || '';
    
    const connection = await pool.getConnection();
    let query = `
      SELECT 
        report_type,
        location,
        COUNT(*) as count,
        status
      FROM health_reports
      WHERE status = 'verified'
    `;
    
    if (location) {
      query += ` AND location LIKE ?`;
    }
    
    query += ` GROUP BY location, report_type, status ORDER BY count DESC`;
    
    const [rows] = location 
      ? await connection.query(query, [`%${location}%`])
      : await connection.query(query);
    
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 7. GET - Admin Dashboard
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [totalReports] = await connection.query('SELECT COUNT(*) as total FROM health_reports');
    const [pendingReports] = await connection.query('SELECT COUNT(*) as total FROM health_reports WHERE status = "pending"');
    const [verifiedReports] = await connection.query('SELECT COUNT(*) as total FROM health_reports WHERE status = "verified"');
    
    connection.release();
    
    res.json({
      totalReports: totalReports[0].total,
      pendingReports: pendingReports[0].total,
      verifiedReports: verifiedReports[0].total
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
