const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const app = express();
const port = 3000;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Create access log stream
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });

// Setup the logger - using combined format for detailed logs
// Skip logging for the access-logs endpoint to avoid noise from the log viewer
app.use(morgan('combined', { 
    stream: accessLogStream,
    skip: function (req, res) {
        return req.url === '/api/access-logs';
    }
}));

// Also log to console in development (but skip access-logs endpoint)
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev', {
        skip: function (req, res) {
            return req.url === '/api/access-logs';
        }
    }));
}

// Vulnerable CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        // Vulnerable: Allow any origin that makes the request
        // This echoes back whatever origin the client sends
        callback(null, origin || '*');
    },
    credentials: true, // Vulnerable: Access-Control-Allow-Credentials set to true
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
}));

// No input validation middleware
app.use(bodyParser.json());
app.use(cookieParser());

// Middleware to prevent caching on all API endpoints
// This ensures all API responses return 200 OK instead of 304 Not Modified
app.use('/api', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
});

// Custom middleware to capture POST request bodies for logging
// IMPORTANT: This must come AFTER bodyParser.json() so req.body is available
app.use((req, res, next) => {
    // Skip logging for the access-logs endpoint
    if (req.url === '/api/access-logs') {
        return next();
    }

    // Capture POST request bodies for security monitoring
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
        const originalSend = res.send;
        
        res.send = function(data) {
            // Create a detailed log entry for POST requests
            const timestamp = new Date().toISOString();
            const ip = req.ip || req.connection.remoteAddress || req.socket?.remoteAddress || 'unknown';
            const userAgent = req.get('User-Agent') || 'unknown';
            
            // Log all data without masking for security testing
            const logEntry = `[${timestamp}] POST_DATA: ${req.url} - IP: ${ip} - Data: ${JSON.stringify(req.body)} - UserAgent: ${userAgent}\n`;
            
            console.log('Logging POST data:', logEntry.trim()); // Debug log
            
            // Write to log file
            accessLogStream.write(logEntry);
            
            // Call original send
            originalSend.call(this, data);
        };
    }
    
    next();
});

// Serve Swagger UI at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Access logs viewing endpoint
app.get('/api/access-logs', (req, res) => {
    // Set CORS headers explicitly for this endpoint
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    try {
        const logPath = path.join(logsDir, 'access.log');
        if (fs.existsSync(logPath)) {
            const logs = fs.readFileSync(logPath, 'utf8');
            const logLines = logs.split('\n').filter(line => line.trim() !== '').slice(-100); // Last 100 lines
            res.json({
                success: true,
                logs: logLines,
                total: logLines.length
            });
        } else {
            res.json({
                success: true,
                logs: [],
                total: 0,
                message: 'No access logs found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to read access logs'
        });
    }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Vulnerable: No file type validation, allows SVG files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Vulnerable: Using original filename without sanitization
        cb(null, file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    // Vulnerable: No file size limits
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

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
  const { username, email, currentPassword, newPassword, role } = req.body;

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
    // Vulnerable: Include role without any authorization check - allows privilege escalation
    let updateQuery = 'UPDATE users SET username = $1, email = $2, role = $3';
    const queryParams = [username, email, role || session.role];
    
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
      
      updateQuery += ', password = $4';
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
    const session = sessions.get(sessionId);
    // Get user data including profile image
    pool.query('SELECT id, username, email, role, profile_image FROM users WHERE id = $1', [session.userId])
      .then(result => {
        if (result.rows.length > 0) {
          const userData = result.rows[0];
          res.json({ 
            success: true, 
            user: {
              ...session,
              role: userData.role, // Include role from database
              profile_image: userData.profile_image
            }
          });
        } else {
          res.json({ 
            success: false, 
            message: 'User not found'
          });
        }
      })
      .catch(error => {
        res.json({ 
          success: false, 
          message: 'Error fetching user data'
        });
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

  try {
    // Vulnerable: No authorization check - allows fetching any user's data
    const query = 'SELECT id, username, email, role, profile_image FROM users WHERE id = $1';
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

// Vulnerable: Profile image upload endpoint
app.post('/api/user/:userId/image', upload.single('profileImage'), async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }

    try {
        const session = sessions.get(sessionId);
        const imagePath = '/uploads/' + req.file.filename;

        // Update user's profile image in database
        const query = 'UPDATE users SET profile_image = $1 WHERE id = $2 RETURNING profile_image';
        const result = await pool.query(query, [imagePath, req.params.userId]);

        res.json({
            success: true,
            message: 'Profile image updated successfully',
            imagePath: result.rows[0].profile_image
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Vulnerable: Profile image retrieval endpoint with LFI vulnerability
app.get('/api/user/:userId/image', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }

    try {
        // Get the image path from query parameter or database
        let imagePath = req.query.file;
        
        if (!imagePath || imagePath.trim() === '') {
            // If no file provided or empty, get from database
            const query = 'SELECT profile_image FROM users WHERE id = $1';
            const result = await pool.query(query, [req.params.userId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            imagePath = result.rows[0].profile_image;
        }

        if (!imagePath || imagePath.trim() === '') {
            return res.status(404).json({
                success: false,
                message: 'No profile image found'
            });
        }

        // Vulnerable: Direct file path construction without validation
        // This allows LFI attacks like ../../../../../../etc/passwd
        let fullPath;
        if (imagePath.startsWith('/')) {
            // Absolute path from database
            fullPath = path.join(__dirname, 'public', imagePath);
        } else {
            // Relative path from query parameter - VULNERABLE TO LFI
            fullPath = path.join(__dirname, 'public', 'uploads', imagePath);
        }

        // Vulnerable: No path validation or sanitization
        // This allows traversal attacks
        console.log('Attempting to read file:', fullPath);

        // Check if file exists and read it
        if (fs.existsSync(fullPath)) {
            const fileStats = fs.statSync(fullPath);
            if (fileStats.isFile()) {
                // Set appropriate content type based on file extension
                const ext = path.extname(fullPath).toLowerCase();
                let contentType = 'application/octet-stream';
                
                if (ext === '.jpg' || ext === '.jpeg') {
                    contentType = 'image/jpeg';
                } else if (ext === '.png') {
                    contentType = 'image/png';
                } else if (ext === '.gif') {
                    contentType = 'image/gif';
                } else if (ext === '.svg') {
                    contentType = 'image/svg+xml';
                } else {
                    // For non-image files (like /etc/passwd), return as plain text
                    contentType = 'text/plain';
                }

                res.setHeader('Content-Type', contentType);
                
                // Read and send the file
                const fileContent = fs.readFileSync(fullPath);
                res.send(fileContent);
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Path is not a file'
                });
            }
        } else {
            res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }
    } catch (error) {
        // Vulnerable: Exposing detailed error information
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Vulnerable: Password reset endpoint without proper authorization checks
app.put('/api/user/:userId/reset-password', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }

    try {
        const session = sessions.get(sessionId);
        const targetUserId = req.params.userId;
        const { newPassword } = req.body;

        // Get current user's role from database to ensure it's up-to-date
        const userRoleQuery = 'SELECT role FROM users WHERE id = $1';
        const userRoleResult = await pool.query(userRoleQuery, [session.userId]);
        
        if (userRoleResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const currentUserRole = userRoleResult.rows[0].role;

        // Vulnerable: Basic role check but no further authorization
        // An admin can reset any user's password without knowing the current password
        if (currentUserRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin privileges required'
            });
        }

        // Vulnerable: No password complexity validation
        if (!newPassword || newPassword.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        // Check if target user exists
        const checkQuery = 'SELECT username FROM users WHERE id = $1';
        const userCheck = await pool.query(checkQuery, [targetUserId]);
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const username = userCheck.rows[0].username;

        // Vulnerable: Password stored in plaintext (no hashing)
        const updateQuery = 'UPDATE users SET password = $1 WHERE id = $2';
        await pool.query(updateQuery, [newPassword, targetUserId]);

        // Invalidate all sessions for the target user (force re-login)
        for (const [key, value] of sessions.entries()) {
            if (value.userId.toString() === targetUserId.toString()) {
                sessions.delete(key);
            }
        }

        res.json({
            success: true,
            message: `Password reset successfully for user "${username}"`
        });
    } catch (error) {
        // Vulnerable: Exposing detailed error information
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Vulnerable: Delete user endpoint without proper authorization checks
app.delete('/api/user/:userId', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }

    try {
        const session = sessions.get(sessionId);
        const targetUserId = req.params.userId;

        // Get current user's role from database to ensure it's up-to-date
        const userRoleQuery = 'SELECT role FROM users WHERE id = $1';
        const userRoleResult = await pool.query(userRoleQuery, [session.userId]);
        
        if (userRoleResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const currentUserRole = userRoleResult.rows[0].role;

        // Vulnerable: Basic role check but no further authorization
        // An admin can delete any user, including other admins
        if (currentUserRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin privileges required'
            });
        }

        // Prevent users from deleting themselves
        if (session.userId.toString() === targetUserId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete yourself'
            });
        }

        // Check if user exists
        const checkQuery = 'SELECT username FROM users WHERE id = $1';
        const userCheck = await pool.query(checkQuery, [targetUserId]);
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const username = userCheck.rows[0].username;

        // Delete related orders first (to maintain referential integrity)
        await pool.query('DELETE FROM orders WHERE user_id = $1', [targetUserId]);
        
        // Delete the user
        const deleteQuery = 'DELETE FROM users WHERE id = $1';
        await pool.query(deleteQuery, [targetUserId]);

        // Remove any active sessions for the deleted user
        for (const [key, value] of sessions.entries()) {
            if (value.userId.toString() === targetUserId.toString()) {
                sessions.delete(key);
            }
        }

        res.json({
            success: true,
            message: `User "${username}" deleted successfully`
        });
    } catch (error) {
        // Vulnerable: Exposing detailed error information
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Vulnerable: No rate limiting
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 