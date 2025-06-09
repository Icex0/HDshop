const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const port = 80;

// Configuration
const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://app:3000';

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Middleware to prevent caching on static files
// This ensures static files return 200 OK instead of 304 Not Modified
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: function (res, path, stat) {
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        });
    }
}));

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

// Endpoint to fetch and search logs from the main application
app.get('/api/logs', async (req, res) => {
    try {
        console.log(`Fetching raw logs from: ${MAIN_APP_URL}/api/access-logs`);
        
        // Fetch raw logs from main application (no authentication needed)
        const response = await axios.get(`${MAIN_APP_URL}/api/access-logs`, {
            timeout: 10000 // 10 second timeout
        });

        if (!response.data.success) {
            return res.status(500).json(response.data);
        }

        const allLogLines = response.data.logs || [];
        const totalLogsInFile = allLogLines.length;

        console.log('Successfully fetched raw logs:', totalLogsInFile, 'entries');
        console.log('Search parameters:', req.query);

        // Get search parameters
        const searchTerm = req.query.search;
        const caseSensitive = req.query.caseSensitive === 'true';
        const regexSearch = req.query.regex === 'true';
        const postDataOnly = req.query.postDataOnly === 'true';
        const excludePattern = req.query.exclude;
        const maxResults = parseInt(req.query.limit) || 100;

        let resultLogs = allLogLines;

        // If no search term, return last 100 logs (default behavior)
        if (!searchTerm && !excludePattern && !postDataOnly) {
            resultLogs = allLogLines.slice(-maxResults);
            res.json({
                success: true,
                logs: resultLogs,
                total: resultLogs.length,
                totalInFile: totalLogsInFile,
                searchApplied: false
            });
            return;
        }

        // Apply POST data filter first if requested
        if (postDataOnly) {
            resultLogs = resultLogs.filter(log => log.includes('POST'));
        }

        // Apply exclude filter if provided
        if (excludePattern && excludePattern.trim()) {
            try {
                const excludePatterns = excludePattern.split(',').map(p => p.trim()).filter(p => p);
                resultLogs = resultLogs.filter(log => {
                    let logText = caseSensitive ? log : log.toLowerCase();
                    let excludeText = caseSensitive ? excludePattern : excludePattern.toLowerCase();

                    if (regexSearch) {
                        try {
                            const regex = new RegExp(excludeText, caseSensitive ? 'g' : 'gi');
                            return !regex.test(logText);
                        } catch (e) {
                            return !logText.includes(excludeText);
                        }
                    } else {
                        return !excludePatterns.some(pattern => {
                            const patternText = caseSensitive ? pattern : pattern.toLowerCase();
                            if (pattern.includes(' AND ')) {
                                const andTerms = pattern.split(' AND ').map(term => term.trim());
                                return andTerms.every(term => logText.includes(caseSensitive ? term : term.toLowerCase()));
                            } else {
                                return logText.includes(patternText);
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('Exclude filter error:', error);
            }
        }

        // Apply search filter if provided
        if (searchTerm && searchTerm.trim()) {
            try {
                resultLogs = resultLogs.filter(log => {
                    let logText = caseSensitive ? log : log.toLowerCase();
                    let searchText = caseSensitive ? searchTerm : searchTerm.toLowerCase();

                    if (regexSearch) {
                        try {
                            const regex = new RegExp(searchText, caseSensitive ? 'g' : 'gi');
                            return regex.test(logText);
                        } catch (e) {
                            return logText.includes(searchText);
                        }
                    } else {
                        return logText.includes(searchText);
                    }
                });
            } catch (error) {
                console.error('Search error:', error);
            }
        }

        // Limit results for performance (but keep all matches information)
        const totalMatches = resultLogs.length;
        const limitedResults = resultLogs.slice(-maxResults); // Get the most recent matches

        res.json({
            success: true,
            logs: limitedResults,
            total: limitedResults.length,
            totalMatches: totalMatches,
            totalInFile: totalLogsInFile,
            searchApplied: true,
            searchTerm: searchTerm,
            truncated: totalMatches > maxResults
        });
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
    // Set cache-control headers to prevent 304 responses
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
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

app.listen(port, '0.0.0.0', () => {
    console.log(`🔍 Log Viewer running at http://0.0.0.0:${port}`);
    console.log(`🔗 Main app URL: ${MAIN_APP_URL}`);
    
    // Test connection after a short delay
    setTimeout(testConnection, 3000);
}); 