const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check - root
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'APK Generator is running!',
        timestamp: new Date().toISOString()
    });
});

// Generate endpoint - returns a test response
app.post('/api/generate', (req, res) => {
    const { url, appName } = req.body;
    
    if (!url || !appName) {
        return res.status(400).json({
            success: false,
            error: 'URL dan App Name diperlukan'
        });
    }

    console.log(`📱 Request received for: ${appName} (${url})`);

    // Return a test response (for now)
    res.json({
        success: true,
        appName: appName,
        url: url,
        downloadUrl: 'https://example.com/test.apk',
        message: 'APK berjaya dihasilkan! 🎉 (Test mode)'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/`);
});

// Handle errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});
