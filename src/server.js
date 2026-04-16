const express = require('express');
const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const session = require('express-session');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'health-report-secret-key-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true }
}));

// ===== AWS S3 Configuration =====
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: 'v4'
});

// ===== Upload Configuration =====
// Keep the file in memory, then upload to S3 inside the route handler.
const upload = multer({ storage: multer.memoryStorage() });

async function resolvePhotoUrl(photoValue) {
  if (!photoValue) {
    return null;
  }

  if (/^https?:\/\//i.test(photoValue)) {
    return photoValue;
  }

  return s3.getSignedUrlPromise('getObject', {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: photoValue,
    Expires: 3600
  });
}

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

// ===== Initialize Database Tables =====
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Drop old users table if it exists (to reset schema)
    try {
      await connection.query('DROP TABLE IF EXISTS users');
      console.log('✓ Dropped old users table');
    } catch (error) {
      console.warn('Could not drop users table:', error.message);
    }
    
    // Create users table with correct schema
    const createTableSQL = `
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.query(createTableSQL);
    console.log('✓ Users table created successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  }
}

// ===== API Routes =====

// 1. HOME PAGE
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

// ===== AUTHENTICATION ROUTES =====

// Register
app.post('/api/auth/register', async (req, res) => {
  let connection = null;
  try {
    const { name, email, password, passwordConfirm } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    connection = await pool.getConnection();

    // Check if email already exists
    try {
      const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing && existing.length > 0) {
        connection.release();
        return res.status(400).json({ error: 'Email already registered' });
      }
    } catch (queryError) {
      console.error('Error checking existing email:', queryError);
      connection.release();
      return res.status(500).json({ error: 'Database error during email check' });
    }

    // Hash password
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (bcryptError) {
      console.error('Error hashing password:', bcryptError);
      connection.release();
      return res.status(500).json({ error: 'Password encryption failed' });
    }

    // Insert user
    try {
      await connection.query(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, hashedPassword]
      );
    } catch (insertError) {
      console.error('Error inserting user:', insertError);
      connection.release();
      
      if (insertError.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Email already registered' });
      }
      return res.status(500).json({ error: 'Failed to create user account' });
    }

    connection.release();

    res.status(201).json({ message: 'User registered successfully! Please login.' });
  } catch (error) {
    console.error('Error registering user:', error);
    if (connection) connection.release();
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  let connection = null;
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    connection = await pool.getConnection();
    
    let user;
    try {
      const [users] = await connection.query('SELECT id, name, email, password FROM users WHERE email = ?', [email]);
      if (!users || users.length === 0) {
        connection.release();
        return res.status(401).json({ error: 'Email or password incorrect' });
      }
      user = users[0];
    } catch (queryError) {
      console.error('Error querying user:', queryError);
      connection.release();
      return res.status(500).json({ error: 'Database error' });
    }

    // Verify password
    let isValidPassword;
    try {
      isValidPassword = await bcrypt.compare(password, user.password);
    } catch (bcryptError) {
      console.error('Error comparing passwords:', bcryptError);
      connection.release();
      return res.status(500).json({ error: 'Password verification failed' });
    }

    if (!isValidPassword) {
      connection.release();
      return res.status(401).json({ error: 'Email or password incorrect' });
    }

    connection.release();

    // Set session
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email
    };

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    if (connection) connection.release();
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// ===== END AUTHENTICATION ROUTES =====

// 2. GET All Reports (untuk dashboard)
app.get('/api/reports', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT id, report_type, location, description, photo_url, status, created_at 
       FROM health_reports ORDER BY created_at DESC`
    );
    connection.release();

    const reports = await Promise.all(
      rows.map(async (report) => ({
        ...report,
        photo_url: await resolvePhotoUrl(report.photo_url)
      }))
    );

    res.json(reports);
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
app.post('/api/reports', (req, res) => {
  upload.single('photo')(req, res, async (uploadError) => {
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(400).json({
        error: 'Invalid image upload',
        details: uploadError.message
      });
    }

    try {
      const { report_type, location, description, reporter_name, reporter_phone } = req.body;
      let photoUrl = null;

      if (req.file) {
        const fileExtension = path.extname(req.file.originalname) || '.jpg';
        const s3Key = `reports/${Date.now()}-${uuidv4()}${fileExtension}`;

        const uploadResult = await s3.upload({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: s3Key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        }).promise();

        photoUrl = uploadResult.Key;
      }

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
      console.error('Error creating report:', error);
      res.status(500).json({
        error: 'Failed to create report',
        details: error.message
      });
    }
  });
});

// 5. PUT - Update Report Status or Details
app.put('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, report_type, location, description } = req.body;

    const connection = await pool.getConnection();

    // Check if updating status (admin) or details (user edit)
    if (status) {
      // Admin update status
      await connection.query(
        `UPDATE health_reports SET status = ?, admin_notes = ? WHERE id = ?`,
        [status, admin_notes || null, id]
      );
    } else if (report_type || location || description) {
      // User edit report details
      await connection.query(
        `UPDATE health_reports SET report_type = ?, location = ?, description = ? WHERE id = ?`,
        [report_type, location, description, id]
      );
    } else {
      connection.release();
      return res.status(400).json({ error: 'Nothing to update' });
    }

    connection.release();
    res.json({ message: 'Report updated successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// 5b. DELETE - Delete Report
app.delete('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    
    // Get the report to find photo URL if needed
    const [reports] = await connection.query(
      'SELECT photo_url FROM health_reports WHERE id = ?',
      [id]
    );

    if (reports.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Report not found' });
    }

    // Delete from database
    await connection.query('DELETE FROM health_reports WHERE id = ?', [id]);
    connection.release();

    // If there's a photo in S3, you could delete it here if desired
    // For now, we'll keep it simple and just delete from DB

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
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

async function startServer() {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
