require('dotenv').config();

const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const ALLOWED_ORIGINS = new Set([
  'null',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
]);

// MySQL Configuration - supports environment variables or defaults
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT) || 3306,
  database: 'urbaneats',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let db;
let dbReady = false;

async function initializeDatabase() {
  try {
    // First, create a connection without specifying database to create it
    const rootConnection = await mysql.createConnection({
      host: DB_CONFIG.host,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      port: DB_CONFIG.port
    });

    await rootConnection.query('CREATE DATABASE IF NOT EXISTS urbaneats');
    await rootConnection.end();

    // Now create the connection pool
    db = await mysql.createPool(DB_CONFIG);

    const connection = await db.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        image_url TEXT NULL,
        price_lkr DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const [imageColumn] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'menu_items'
         AND COLUMN_NAME = 'image_url'`,
      [DB_CONFIG.database]
    );

    if (!imageColumn[0].count) {
      await connection.query('ALTER TABLE menu_items ADD COLUMN image_url TEXT NULL');
    }

    const [menuItems] = await connection.query('SELECT COUNT(*) as count FROM menu_items');
    if (menuItems[0].count === 0) {
      const seedItems = [
        ['Classic Cheeseburger', 'Juicy beef patty, cheddar, lettuce, tomato, and special sauce.', 'burgers', 14.99],
        ['Margherita Pizza', 'Mozzarella, basil, tomato sauce, and olive oil on hand-tossed dough.', 'pizza', 16.99],
        ['Spicy Chicken Pad Thai', 'Stir-fried noodles with chicken, shrimp, eggs, and aromatic spices.', 'asian', 13.99],
        ['Grilled Salmon', 'Fresh salmon fillet with lemon butter sauce and seasonal vegetables.', 'seafood', 24.99],
        ['Tacos al Pastor', 'Marinated pork tacos with pineapple, onion, cilantro, and lime.', 'mexican', 12.99],
        ['Vegetarian Buddha Bowl', 'Quinoa, roasted vegetables, chickpeas, avocado, and tahini.', 'bowls', 11.99]
      ];

      for (const [name, description, category, price] of seedItems) {
        await connection.query(
          'INSERT INTO menu_items (name, description, category, price_lkr) VALUES (?, ?, ?, ?)',
          [name, description, category, price]
        );
      }
    }

    connection.release();
    dbReady = true;
  } catch (error) {
    console.error('Database initialization error:', error.message);
    throw error;
  }
}

app.use(function(req, res, next) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.get('/api/health', function(req, res) {
  res.json({
    ok: true,
    databaseReady: dbReady
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'urbaneats-change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

function normalizeCategory(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-');
}

function requireAdmin(req, res, next) {
  if (!req.session.adminId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

app.get('/api/admin/status', async function(req, res) {
  try {
    const connection = await db.getConnection();
    const [admins] = await connection.query('SELECT COUNT(*) as count FROM admins');
    connection.release();

    res.json({
      hasAdmin: admins[0].count > 0,
      isAuthenticated: Boolean(req.session.adminId),
      username: req.session.adminUsername || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Database error' });
  }
});

app.post('/api/admin/register', async function(req, res) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || password.length < 6) {
    return res.status(400).json({ message: 'Username and password (min 6 chars) are required.' });
  }

  try {
    const connection = await db.getConnection();
    const [admins] = await connection.query('SELECT COUNT(*) as count FROM admins');

    if (admins[0].count > 0) {
      connection.release();
      return res.status(409).json({ message: 'Admin account already exists. Please log in.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const [result] = await connection.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, passwordHash]);

    connection.release();

    req.session.adminId = result.insertId;
    req.session.adminUsername = username;

    return res.status(201).json({ message: 'Admin account created.', username: username });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username already exists.' });
    }
    return res.status(500).json({ message: 'Could not create admin account.' });
  }
});

app.post('/api/admin/login', async function(req, res) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const connection = await db.getConnection();
    const [admins] = await connection.query('SELECT id, username, password_hash FROM admins WHERE username = ?', [username]);
    connection.release();

    if (!admins.length || !bcrypt.compareSync(password, admins[0].password_hash)) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    req.session.adminId = admins[0].id;
    req.session.adminUsername = admins[0].username;

    return res.json({ message: 'Login successful.', username: admins[0].username });
  } catch (error) {
    return res.status(500).json({ message: 'Database error' });
  }
});

app.post('/api/admin/logout', function(req, res) {
  req.session.destroy(function() {
    res.json({ message: 'Logged out.' });
  });
});

app.post('/api/users/register', async function(req, res) {
  const username = String(req.body.username || '').trim();
  const fullName = String(req.body.fullName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!username || !fullName || !email || password.length < 6) {
    return res.status(400).json({
      message: 'Username, full name, email, and password (min 6 chars) are required.'
    });
  }

  try {
    const connection = await db.getConnection();
    const passwordHash = bcrypt.hashSync(password, 10);

    const [result] = await connection.query(
      'INSERT INTO users (username, full_name, email, password_hash) VALUES (?, ?, ?, ?)',
      [username, fullName, email, passwordHash]
    );

    connection.release();

    req.session.userId = result.insertId;
    req.session.userUsername = username;

    return res.status(201).json({
      message: 'User account created successfully.',
      username: username
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username or email already exists.' });
    }

    return res.status(500).json({ message: 'Could not create user account.' });
  }
});

app.post('/api/users/login', async function(req, res) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const connection = await db.getConnection();
    const [users] = await connection.query(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      [username]
    );
    connection.release();

    if (!users.length || !bcrypt.compareSync(password, users[0].password_hash)) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    req.session.userId = users[0].id;
    req.session.userUsername = users[0].username;

    return res.json({
      message: 'User login successful.',
      username: users[0].username
    });
  } catch (error) {
    return res.status(500).json({ message: 'Database error' });
  }
});

app.post('/api/users/logout', function(req, res) {
  req.session.userId = null;
  req.session.userUsername = null;
  res.json({ message: 'User logged out.' });
});

app.get('/api/admin/me', requireAdmin, function(req, res) {
  res.json({ username: req.session.adminUsername });
});

app.get('/api/menu', async function(req, res) {
  try {
    const connection = await db.getConnection();
    const [items] = await connection.query(
      'SELECT id, name, description, category, image_url AS imageUrl, price_lkr AS priceLkr, created_at AS createdAt FROM menu_items ORDER BY id DESC'
    );
    connection.release();

    res.json({ items: items });
  } catch (error) {
    res.status(500).json({ message: 'Database error' });
  }
});

app.post('/api/admin/menu', requireAdmin, async function(req, res) {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const category = normalizeCategory(req.body.category || 'other');
  const imageUrl = String(req.body.imageUrl || '').trim();
  const priceLkr = Number(req.body.priceLkr);

  if (!name || !description || !category || !Number.isFinite(priceLkr) || priceLkr <= 0) {
    return res.status(400).json({
      message: 'Valid name, description, category, and positive price are required.'
    });
  }

  try {
    const connection = await db.getConnection();
    const [result] = await connection.query(
      'INSERT INTO menu_items (name, description, category, image_url, price_lkr) VALUES (?, ?, ?, ?, ?)',
      [name, description, category, imageUrl || null, priceLkr]
    );

    const [items] = await connection.query(
      'SELECT id, name, description, category, image_url AS imageUrl, price_lkr AS priceLkr, created_at AS createdAt FROM menu_items WHERE id = ?',
      [result.insertId]
    );
    connection.release();

    res.status(201).json({ message: 'Menu item added.', item: items[0] });
  } catch (error) {
    res.status(500).json({ message: 'Database error' });
  }
});

app.delete('/api/admin/menu/:id', requireAdmin, async function(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid item id.' });
  }

  try {
    const connection = await db.getConnection();
    const [result] = await connection.query('DELETE FROM menu_items WHERE id = ?', [id]);
    connection.release();

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Menu item not found.' });
    }

    res.json({ message: 'Menu item deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Database error' });
  }
});

app.use(express.static(__dirname));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function() {
  console.log('UrbanEats backend running at http://localhost:' + PORT);
  initializeDatabase().then(function() {
    console.log('MySQL database: urbaneats on ' + DB_CONFIG.host);
  }).catch(function(error) {
    console.error('Failed to initialize database:', error.message);
    console.error('');
    console.error('MySQL Connection Configuration:');
    console.error('- Host: ' + DB_CONFIG.host + ' (set with DB_HOST env var)');
    console.error('- User: ' + DB_CONFIG.user + ' (set with DB_USER env var)');
    console.error('- Password: ' + (DB_CONFIG.password ? '****' : '(none)') + ' (set with DB_PASSWORD env var)');
    console.error('');
    console.error('Make sure MySQL is running and accessible.');
  });
});
