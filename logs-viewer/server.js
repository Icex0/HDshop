const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const port = 3050;

// Configuration
const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://app:3000';

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to fetch logs from the main application
app.get('/api/logs', async (req, res) => {
    try {
        console.log(`Fetching logs from: ${MAIN_APP_URL}/api/access-logs`);
        
        // Fetch logs from main application (no authentication needed)
        const response = await axios.get(`${MAIN_APP_URL}/api/access-logs`, {
            timeout: 10000 // 10 second timeout
        });

        console.log('Successfully fetched logs:', response.data.total || 0, 'entries');
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching logs:', error.message);
        
        let errorMessage = 'Failed to fetch logs from main application';
        if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Cannot connect to main application - is it running?';
        } else if (error.response) {
            errorMessage = `Main app returned ${error.response.status}: ${error.response.statusText}`;
        }
        
        res.status(500).json({
            success: false,
            error: errorMessage,
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'Log Viewer Service Running',
        port: port,
        mainAppUrl: MAIN_APP_URL
    });
});

// Serve the main log viewer page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test connection to main app on startup
async function testConnection() {
    try {
        console.log(`Testing connection to main app at: ${MAIN_APP_URL}`);
        const response = await axios.get(`${MAIN_APP_URL}/api/access-logs`, { timeout: 5000 });
        console.log('✅ Successfully connected to main application');
        console.log(`📊 Found ${response.data.total || 0} log entries`);
    } catch (error) {
        console.log('⚠️  Could not connect to main application on startup');
        console.log(`   Will retry when requests are made...`);
        console.log(`   Error: ${error.message}`);
    }
}

app.listen(port, () => {
    console.log(`🔍 Log Viewer running at http://localhost:${port}`);
    console.log(`🔗 Main app URL: ${MAIN_APP_URL}`);
    
    // Test connection after a short delay
    setTimeout(testConnection, 3000);
}); 