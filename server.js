const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
const port = 3000;

// Using default CORS settings
app.use(cors());

// No input validation middleware
app.use(bodyParser.json());
app.use(cookieParser());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vulnerable_app',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Session storage (in-memory for simplicity)
const sessions = new Map();

// Generate secure session ID
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// Registration endpoint
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    // Check if username already exists
    const checkQuery = `SELECT * FROM users WHERE username = '${username}'`;
    const existingUser = await pool.query(checkQuery);
    
    if (existingUser.rows.length > 0) {
      return res.json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Insert new user with default role
    const insertQuery = `
      INSERT INTO users (username, email, password, role)
      VALUES ('${username}', '${email}', '${password}', 'user')
      RETURNING id, username, email, role
    `;
    
    const result = await pool.query(insertQuery);
    
    res.json({
      success: true,
      message: 'Registration successful',
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Login endpoint with SQL error-based injection vulnerability
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Vulnerable: Username enumeration with SQL injection possibility
    const userCheckQuery = `SELECT * FROM users WHERE username = '${username}'`;
    const userResult = await pool.query(userCheckQuery);
    
    if (userResult.rows.length === 0) {
      // Vulnerable: Username enumeration - revealing that username doesn't exist
      return res.json({ 
        success: false, 
        message: `User "${username}" does not exist` 
      });
    }

    // Vulnerable: Direct string concatenation in SQL query
    // Vulnerable: Error-based SQL injection - errors are exposed to client
    const loginQuery = `
      SELECT id, username, email 
      FROM users 
      WHERE username = '${username}' 
      AND password = '${password}'
    `;
    
    const result = await pool.query(loginQuery);
    
    if (result.rows.length > 0) {
      // Generate session
      const sessionId = generateSessionId();
      const user = result.rows[0];
      
      // Store session
      sessions.set(sessionId, {
        userId: user.id,
        username: user.username,
        email: user.email
      });

      // Set session cookie
      // Vulnerable: Missing HttpOnly and Secure flags
      res.cookie('sessionId', sessionId, {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      res.json({ 
        success: true, 
        message: 'Login successful',
        user: user
      });
    } else {
      // Vulnerable: Username enumeration - revealing that username exists but password is wrong
      res.json({ 
        success: false, 
        message: `Invalid password for user "${username}"` 
      });
    }
  } catch (error) {
    // Vulnerable: Exposing SQL errors to client
    res.status(500).json({ 
      success: false, 
      error: error.message,
      detail: error.detail,
      hint: error.hint
    });
  }
});

// Profile update endpoint
app.post('/api/profile/update', async (req, res) => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  const session = sessions.get(sessionId);
  const { username, email, currentPassword, newPassword } = req.body;

  try {
    // Check if username is being changed and if it's already taken
    if (username !== session.username) {
      const checkQuery = 'SELECT * FROM users WHERE username = $1';
      const existingUser = await pool.query(checkQuery, [username]);
      
      if (existingUser.rows.length > 0) {
        return res.json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    // Build update query based on what's being changed
    let updateQuery = 'UPDATE users SET username = $1, email = $2';
    const queryParams = [username, email];
    
    // If changing password, verify current password
    if (newPassword) {
      const verifyQuery = 'SELECT * FROM users WHERE id = $1 AND password = $2';
      const verifyResult = await pool.query(verifyQuery, [session.userId, currentPassword]);
      
      if (verifyResult.rows.length === 0) {
        return res.json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
      
      updateQuery += ', password = $3';
      queryParams.push(newPassword);
    }
    
    updateQuery += ' WHERE id = $' + (queryParams.length + 1) + ' RETURNING id, username, email, role';
    queryParams.push(session.userId);
    
    const result = await pool.query(updateQuery, queryParams);
    
    // Update session data
    session.username = result.rows[0].username;
    session.email = result.rows[0].email;
    session.role = result.rows[0].role;
    sessions.set(sessionId, session);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Session check endpoint
app.get('/api/session', (req, res) => {
  const sessionId = req.cookies.sessionId;
  if (sessionId && sessions.has(sessionId)) {
    res.json({ 
      success: true, 
      user: sessions.get(sessionId)
    });
  } else {
    res.json({ 
      success: false, 
      message: 'Not authenticated'
    });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  const sessionId = req.cookies.sessionId;
  if (sessionId) {
    sessions.delete(sessionId);
    res.clearCookie('sessionId');
  }
  res.json({ success: true });
});

// IDOR-vulnerable endpoint to get user information
app.get('/api/user/:userId', async (req, res) => {
  // Check for valid session
  const sessionId = req.cookies.sessionId;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  // Prevent caching to avoid 304 Not Modified responses
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  try {
    // Vulnerable: No authorization check - allows fetching any user's data
    const query = 'SELECT id, username, email, role FROM users WHERE id = $1';
    const result = await pool.query(query, [req.params.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Vulnerable: Endpoint that returns all users without proper authorization
app.get('/api/users', async (req, res) => {
  // Check for valid session
  const sessionId = req.cookies.sessionId;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  try {
    // Vulnerable: No authorization check - allows any authenticated user to get all users
    const query = 'SELECT id, username, email, role FROM users';
    const result = await pool.query(query);
    
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Vulnerable: Endpoint for processing purchases
app.post('/api/purchase', async (req, res) => {
  // Check for valid session
  const sessionId = req.cookies.sessionId;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  try {
    const session = sessions.get(sessionId);
    const { items, total } = req.body;

    // Vulnerable: No validation of items or prices
    // Vulnerable: No inventory check
    // Vulnerable: No payment processing
    // Vulnerable: No order tracking
    const orderQuery = `
      INSERT INTO orders (user_id, total_amount, items)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    
    const result = await pool.query(orderQuery, [
      session.userId,
      total,
      JSON.stringify(items)
    ]);

    res.json({
      success: true,
      message: 'Purchase completed successfully',
      orderId: result.rows[0].id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Vulnerable: Endpoint to get user orders
app.get('/api/user/:userId/orders', async (req, res) => {
  // Check for valid session
  const sessionId = req.cookies.sessionId;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  try {
    // Vulnerable: No authorization check - allows fetching any user's orders
    const query = `
      SELECT id, total_amount, items, created_at 
      FROM orders 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [req.params.userId]);
    
    res.json({
      success: true,
      orders: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Vulnerable: No rate limiting
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 